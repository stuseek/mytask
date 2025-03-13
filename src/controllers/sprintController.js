// src/controllers/sprintController.js
const Sprint = require('../models/sprintModel');
const Project = require('../models/projectModel');
const Task = require('../models/taskModel');
const { logAction } = require('../utils/logger');
const { createNotification } = require('../services/notificationService');
const mongoose = require('mongoose');
const { validateSprintInput } = require('../validators/sprintValidator');
const APIFeatures = require('../middleware/queryFeatures');
const { AppError } = require('../middleware/errorHandler');
const { emitToProject, emitToSprint } = require('../services/socketService');
const { getOrSet, invalidate } = require('../services/cacheService');

/**
 * Create a new Sprint for a given project
 * @route POST /api/projects/:projectId/sprints
 * @access Private - Project Owner or Manager
 */
exports.createSprint = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const { projectId } = req.params;
        const { name, description, startDate, endDate } = req.body;
        
        // Validate input
        const validationError = validateSprintInput(req.body);
        if (validationError) {
            return next(new AppError(validationError, 400));
        }

        // Check if project exists and user has permission
        const project = await Project.findById(projectId);
        if (!project) {
            return next(new AppError('Project not found', 404));
        }

        // Check user permissions
        if (!await hasProjectPermission(project, req.user._id)) {
            return next(new AppError('Not authorized to create a sprint', 403));
        }

        // Create the sprint
        const sprint = new Sprint({
            name,
            description,
            projectId: project._id,
            startDate,
            endDate,
            taskIds: [],
            createdBy: req.user._id,
            updatedBy: req.user._id
        });

        await sprint.save({ session });
        
        // Log action
        await logAction(
            req.user._id,
            'CREATE_SPRINT',
            'Sprint',
            sprint._id,
            { name, projectId },
            req.ip
        );

        // Notify project members
        await notifyProjectMembers(project._id, `New sprint created: ${name}`, sprint._id);
        
        // Emit socket event for real-time updates
        emitToProject(project._id, 'sprint:created', {
            sprint: {
                _id: sprint._id,
                name: sprint.name,
                startDate: sprint.startDate,
                endDate: sprint.endDate,
                status: sprint.status
            }
        });
        
        // Invalidate project sprints cache
        invalidate(`project:${project._id}:sprints`);
        
        await session.commitTransaction();
        session.endSession();
        
        res.status(201).json({ 
            success: true,
            data: sprint
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        
        next(error);
    }
};

/**
 * Get all sprints for a specific project with advanced filtering, sorting, and pagination
 * @route GET /api/projects/:projectId/sprints
 * @access Private - Project Members
 */
exports.getSprintsForProject = async (req, res, next) => {
    try {
        const { projectId } = req.params;

        // Check if project exists
        const project = await Project.findById(projectId);
        if (!project) {
            return next(new AppError('Project not found', 404));
        }

        // Check if user is a member of the project (less strict - any member can view)
        if (!await isProjectMember(project, req.user._id)) {
            return next(new AppError('Not authorized to view project sprints', 403));
        }

        // Use cache for frequently accessed data
        const sprintsData = await getOrSet(
            `project:${projectId}:sprints:${JSON.stringify(req.query)}`,
            async () => {
                // Create base query
                const sprintQuery = Sprint.find({ projectId });
                
                // Apply filters, sorting, pagination, etc.
                const features = new APIFeatures(sprintQuery, req.query)
                    .filter()
                    .sort()
                    .limitFields()
                    .paginate()
                    .search(['name', 'description']); // Fields to search in
                
                // Execute query with optional population
                const sprints = await features.query.populate({
                    path: 'taskIds', 
                    select: 'title status priority assignedTo dueDate'
                });
                
                // Get total count for pagination info
                const totalCount = await Sprint.countDocuments({ projectId });
                
                return {
                    sprints,
                    totalCount
                };
            },
            300 // Cache TTL: 5 minutes
        );
            
        // Prepare pagination metadata
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 100;
        
        res.json({ 
            success: true,
            count: sprintsData.sprints.length,
            pagination: {
                total: sprintsData.totalCount,
                page,
                limit,
                pages: Math.ceil(sprintsData.totalCount / limit)
            },
            data: sprintsData.sprints 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get a specific sprint by ID
 * @route GET /api/sprints/:sprintId
 * @access Private - Project Members
 */
exports.getSprintById = async (req, res, next) => {
    try {
        const { sprintId } = req.params;
        
        // Validate MongoDB ID
        if (!mongoose.Types.ObjectId.isValid(sprintId)) {
            return next(new AppError('Invalid sprint ID format', 400));
        }
        
        // Use cache for frequently accessed sprint details
        const sprint = await getOrSet(
            `sprint:${sprintId}`,
            async () => {
                return await Sprint.findById(sprintId)
                    .populate({
                        path: 'taskIds', 
                        select: 'title status priority assignedTo dueDate estimatedHours'
                    });
            },
            300 // Cache TTL: 5 minutes
        );
            
        if (!sprint) {
            return next(new AppError('Sprint not found', 404));
        }
        
        // Check if user is a member of the project
        const project = await Project.findById(sprint.projectId);
        if (!await isProjectMember(project, req.user._id)) {
            return next(new AppError('Not authorized to view this sprint', 403));
        }
        
        res.json({ 
            success: true,
            data: sprint 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update an existing sprint
 * @route PUT /api/sprints/:sprintId
 * @access Private - Project Owner or Manager
 */
exports.updateSprint = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const { sprintId } = req.params;
        const updateData = req.body;
        
        // Validate input
        const validationError = validateSprintInput(updateData, true); // true for update mode
        if (validationError) {
            return next(new AppError(validationError, 400));
        }
        
        // Validate MongoDB ID
        if (!mongoose.Types.ObjectId.isValid(sprintId)) {
            return next(new AppError('Invalid sprint ID format', 400));
        }

        const sprint = await Sprint.findById(sprintId);
        if (!sprint) {
            return next(new AppError('Sprint not found', 404));
        }

        // Check user permission
        const project = await Project.findById(sprint.projectId);
        if (!project) {
            return next(new AppError('Parent project not found', 404));
        }
        
        if (!await hasProjectPermission(project, req.user._id)) {
            return next(new AppError('Not authorized to update sprint', 403));
        }

        // Add audit field
        updateData.updatedBy = req.user._id;

        // Update sprint with only the provided fields
        const updatedSprint = await Sprint.findByIdAndUpdate(
            sprintId, 
            { $set: updateData },
            { new: true, runValidators: true, session }
        ).populate({
            path: 'taskIds',
            select: 'title status'
        });

        await logAction(
            req.user._id,
            'UPDATE_SPRINT',
            'Sprint',
            sprint._id,
            updateData,
            req.ip
        );
        
        // Emit socket event for real-time updates
        emitToProject(project._id, 'sprint:updated', {
            sprint: {
                _id: updatedSprint._id,
                name: updatedSprint.name,
                status: updatedSprint.status,
                progressPercentage: updatedSprint.progressPercentage
            }
        });
        
        // Also emit to anyone viewing this specific sprint
        emitToSprint(sprintId, 'sprint:details:updated', { sprint: updatedSprint });
        
        // Invalidate caches
        invalidate(`sprint:${sprintId}`);
        invalidate(`project:${project._id}:sprints*`);
        
        await session.commitTransaction();
        session.endSession();

        res.json({ 
            success: true,
            data: updatedSprint 
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        
        next(error);
    }
};

/**
 * Delete a sprint
 * @route DELETE /api/sprints/:sprintId
 * @access Private - Project Owner or Manager
 */
exports.deleteSprint = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const { sprintId } = req.params;
        
        // Validate MongoDB ID
        if (!mongoose.Types.ObjectId.isValid(sprintId)) {
            return next(new AppError('Invalid sprint ID format', 400));
        }

        const sprint = await Sprint.findById(sprintId);
        if (!sprint) {
            return next(new AppError('Sprint not found', 404));
        }

        // Check user permission
        const project = await Project.findById(sprint.projectId);
        if (!project) {
            return next(new AppError('Parent project not found', 404));
        }
        
        if (!await hasProjectPermission(project, req.user._id)) {
            return next(new AppError('Not authorized to delete sprint', 403));
        }

        // Store sprint info for notifications and events
        const sprintInfo = {
            id: sprint._id,
            name: sprint.name,
            projectId: sprint.projectId
        };

        // Update all tasks in the sprint to remove sprintId
        await Task.updateMany(
            { _id: { $in: sprint.taskIds } },
            { $unset: { sprintId: '' } },
            { session }
        );

        // Delete the sprint
        await Sprint.deleteOne({ _id: sprintId }, { session });

        await logAction(
            req.user._id, 
            'DELETE_SPRINT', 
            'Sprint', 
            sprintId, 
            { name: sprint.name }, 
            req.ip
        );
        
        // Emit socket event for real-time updates
        emitToProject(project._id, 'sprint:deleted', { sprintId, sprintName: sprint.name });
        
        // Invalidate caches
        invalidate(`sprint:${sprintId}`);
        invalidate(`project:${project._id}:sprints*`);
        
        await session.commitTransaction();
        session.endSession();

        res.json({ 
            success: true,
            message: 'Sprint deleted successfully' 
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        
        next(error);
    }
};

/**
 * Add a task to a sprint
 * @route POST /api/sprints/:sprintId/tasks/:taskId
 * @access Private - Project Owner or Manager
 */
exports.addTaskToSprint = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const { sprintId, taskId } = req.params;
        
        // Validate MongoDB IDs
        if (!mongoose.Types.ObjectId.isValid(sprintId) || !mongoose.Types.ObjectId.isValid(taskId)) {
            return next(new AppError('Invalid ID format', 400));
        }

        const sprint = await Sprint.findById(sprintId);
        if (!sprint) {
            return next(new AppError('Sprint not found', 404));
        }

        // Check project ownership/roles
        const project = await Project.findById(sprint.projectId);
        if (!project) {
            return next(new AppError('Project not found', 404));
        }
        
        if (!await hasProjectPermission(project, req.user._id)) {
            return next(new AppError('Not authorized to modify sprint', 403));
        }

        // Find the task to ensure it belongs to the same project
        const task = await Task.findById(taskId);
        if (!task) {
            return next(new AppError('Task not found', 404));
        }
        
        if (String(task.projectId) !== String(project._id)) {
            return next(new AppError('Task does not belong to this project', 400));
        }

        // Check if task is already in another sprint
        if (task.sprintId && String(task.sprintId) !== String(sprintId)) {
            const otherSprint = await Sprint.findById(task.sprintId);
            if (otherSprint) {
                // Remove from other sprint
                otherSprint.taskIds = otherSprint.taskIds.filter(
                    (tId) => String(tId) !== String(taskId)
                );
                await otherSprint.save({ session });
                
                // Invalidate other sprint's cache
                invalidate(`sprint:${otherSprint._id}`);
                
                // Emit event for the other sprint
                emitToSprint(otherSprint._id, 'sprint:task:removed', { 
                    sprintId: otherSprint._id,
                    taskId: task._id
                });
            }
        }

        // Add the task to the sprint if not already present
        if (!sprint.taskIds.some(id => String(id) === String(taskId))) {
            sprint.taskIds.push(taskId);
            await sprint.save({ session });
        }

        // Update the task
        task.sprintId = sprint._id;
        task.updatedBy = req.user._id;
        await task.save({ session });

        await logAction(
            req.user._id,
            'ADD_TASK_TO_SPRINT',
            'Sprint',
            sprint._id,
            { taskId, taskTitle: task.title },
            req.ip
        );

        // Notify the user assigned to the task
        if (task.assignedTo) {
            await createNotification(
                task.assignedTo,
                `Your task "${task.title}" was added to sprint: ${sprint.name}`,
                `/sprints/${sprint._id}`
            );
        }
        
        // Update sprint progress after task operations
        await updateSprintProgress(sprintId, session);
        
        // Emit socket events for real-time updates
        emitToSprint(sprintId, 'sprint:task:added', { 
            sprintId,
            task: {
                _id: task._id,
                title: task.title,
                status: task.status,
                priority: task.priority,
                assignedTo: task.assignedTo
            }
        });
        
        // Invalidate caches
        invalidate(`sprint:${sprintId}`);
        invalidate(`task:${taskId}`);
        
        await session.commitTransaction();
        session.endSession();

        // Fetch updated sprint with populated tasks
        const updatedSprint = await Sprint.findById(sprintId).populate({
            path: 'taskIds',
            select: 'title status priority assignedTo dueDate'
        });

        res.json({ 
            success: true,
            data: updatedSprint
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        
        next(error);
    }
};

/**
 * Remove a task from a sprint
 * @route DELETE /api/sprints/:sprintId/tasks/:taskId
 * @access Private - Project Owner or Manager
 */
exports.removeTaskFromSprint = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const { sprintId, taskId } = req.params;
        
        // Validate MongoDB IDs
        if (!mongoose.Types.ObjectId.isValid(sprintId) || !mongoose.Types.ObjectId.isValid(taskId)) {
            return next(new AppError('Invalid ID format', 400));
        }

        const sprint = await Sprint.findById(sprintId);
        if (!sprint) {
            return next(new AppError('Sprint not found', 404));
        }

        // Check project ownership/roles
        const project = await Project.findById(sprint.projectId);
        if (!project) {
            return next(new AppError('Project not found', 404));
        }
        
        if (!await hasProjectPermission(project, req.user._id)) {
            return next(new AppError('Not authorized to modify sprint', 403));
        }

        // Find task to notify assigned user
        const task = await Task.findById(taskId);

        // Remove taskId from sprint
        sprint.taskIds = sprint.taskIds.filter((tId) => String(tId) !== String(taskId));
        await sprint.save({ session });

        // Update the task
        if (task) {
            task.sprintId = undefined;
            task.updatedBy = req.user._id;
            await task.save({ session });
            
            // Notify if assigned
            if (task.assignedTo) {
                await createNotification(
                    task.assignedTo,
                    `Your task "${task.title}" was removed from sprint: ${sprint.name}`,
                    `/tasks/${taskId}`
                );
            }
        } else {
            // If task doesn't exist (rare case), ensure it's removed from references
            await Task.findByIdAndUpdate(
                taskId, 
                { $unset: { sprintId: '' } },
                { session }
            );
        }

        await logAction(
            req.user._id,
            'REMOVE_TASK_FROM_SPRINT',
            'Sprint',
            sprint._id,
            { taskId, taskTitle: task?.title },
            req.ip
        );
        
        // Update sprint progress after task operations
        await updateSprintProgress(sprintId, session);
        
        // Emit socket events for real-time updates
        emitToSprint(sprintId, 'sprint:task:removed', { 
            sprintId,
            taskId
        });
        
        // Invalidate caches
        invalidate(`sprint:${sprintId}`);
        if (task) invalidate(`task:${taskId}`);
        
        await session.commitTransaction();
        session.endSession();

        // Fetch updated sprint with populated tasks
        const updatedSprint = await Sprint.findById(sprintId).populate({
            path: 'taskIds',
            select: 'title status priority assignedTo dueDate'
        });

        res.json({ 
            success: true,
            data: updatedSprint
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        
        next(error);
    }
};

/**
 * Update the sprint's progress percentage based on task completion
 * This can be called internally or exposed as an API endpoint
 */
exports.updateSprintProgress = async (sprintId, session = null) => {
    try {
        const sprint = await Sprint.findById(sprintId);
        if (!sprint || sprint.taskIds.length === 0) return null;
        
        const tasks = await Task.find({ _id: { $in: sprint.taskIds } });
        
        if (tasks.length === 0) {
            sprint.progressPercentage = 0;
        } else {
            const completedTasks = tasks.filter(task => task.status === 'Completed');
            sprint.progressPercentage = Math.round((completedTasks.length / tasks.length) * 100);
        }
        
        // Save with session if provided
        if (session) {
            await sprint.save({ session });
        } else {
            await sprint.save();
        }
        
        // Emit event for real-time progress updates
        emitToProject(sprint.projectId, 'sprint:progress:updated', {
            sprintId: sprint._id,
            progress: sprint.progressPercentage
        });
        
        // Invalidate cache
        invalidate(`sprint:${sprintId}`);
        
        return sprint;
    } catch (error) {
        console.error('Update Sprint Progress Error:', error);
        throw error;
    }
};

// Exposed API endpoint version of updateSprintProgress
exports.recalculateSprintProgress = async (req, res, next) => {
    try {
        const { sprintId } = req.params;
        
        // Validate MongoDB ID
        if (!mongoose.Types.ObjectId.isValid(sprintId)) {
            return next(new AppError('Invalid sprint ID format', 400));
        }
        
        const sprint = await Sprint.findById(sprintId);
        if (!sprint) {
            return next(new AppError('Sprint not found', 404));
        }
        
        // Check permissions
        const project = await Project.findById(sprint.projectId);
        if (!await hasProjectPermission(project, req.user._id)) {
            return next(new AppError('Not authorized to modify sprint', 403));
        }
        
        const updatedSprint = await exports.updateSprintProgress(sprintId);
        
        res.json({
            success: true,
            data: {
                sprintId: updatedSprint._id,
                progressPercentage: updatedSprint.progressPercentage
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Helper function to check if a user has permission (owner or manager) for a project
 */
async function hasProjectPermission(project, userId) {
    // Project owner always has permission
    if (String(project.ownerUserId) === String(userId)) {
        return true;
    }
    
    // Check if user has Manager role for this project
    // This would depend on your role implementation
    const userRole = await getUserRoleInProject(project._id, userId);
    return userRole === 'Manager' || userRole === 'Admin';
}

/**
 * Helper function to check if user is a member of the project (any role)
 */
async function isProjectMember(project, userId) {
    // Project owner is always a member
    if (String(project.ownerUserId) === String(userId)) {
        return true;
    }
    
    // Check if user has any role in the project
    const userRole = await getUserRoleInProject(project._id, userId);
    return userRole !== null;
}

/**
 * Helper to get a user's role in a project
 * Replace with your actual implementation based on your auth model
 */
async function getUserRoleInProject(projectId, userId) {
    // This is a placeholder - replace with your actual role lookup logic
    try {
        const ProjectMember = require('../models/projectMemberModel');
        const membership = await ProjectMember.findOne({ 
            projectId, 
            userId 
        });
        
        return membership ? membership.role : null;
    } catch (error) {
        console.error('Get User Role Error:', error);
        return null;
    }
}

/**
 * Helper to notify all members of a project
 */
async function notifyProjectMembers(projectId, message, relatedItemId) {
    try {
        const ProjectMember = require('../models/projectMemberModel');
        const members = await ProjectMember.find({ projectId });
        
        const notifications = members.map(member => 
            createNotification(
                member.userId, 
                message, 
                `/sprints/${relatedItemId}`
            )
        );
        
        await Promise.all(notifications);
    } catch (error) {
        console.error('Notify Project Members Error:', error);
        // Don't throw here, as notification failures shouldn't break the main operation
    }
}