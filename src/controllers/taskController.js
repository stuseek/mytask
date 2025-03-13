// src/controllers/taskController.js
const Task = require('../models/taskModel');
const Project = require('../models/projectModel');
const { logAction } = require('../utils/logger');
const { 
    notifyTaskAssignment, 
    notifyTaskStatusChange, 
    notifyTaskDeadline,
    sendAISummary
} = require('../services/notificationService');

/**
 * Create a new task
 */
exports.createTask = async (req, res) => {
    try {
        const { title, description, projectId, assignedTo, priority, status, dueDate } = req.body;

        // Optional: verify the user is allowed to create tasks in this project
        // e.g., check if req.user is part of the project or a manager

        const task = new Task({
            title,
            description,
            projectId,
            assignedTo,
            priority,
            status,
            dueDate
        });
        await task.save();

        await logAction(
            req.user._id,
            'CREATE_TASK',
            'Task',
            task._id,
            { title, projectId },
            req.ip
        );

        // Update the Project to push this task into its `tasks` array
        await Project.findByIdAndUpdate(projectId, {
            $push: { tasks: task._id }
        });

        // Notify the user who was assigned (if assignedTo is set)
        if (assignedTo) {
            await notifyTaskAssignment(assignedTo, task, req.user._id);
            
            // Generate a fresh AI summary for the assigned user
            await sendAISummary(assignedTo, projectId);
        }

        // Also send summary to project owner for awareness
        const project = await Project.findById(projectId);
        if (project && project.ownerUserId) {
            await sendAISummary(project.ownerUserId.toString(), projectId);
        }

        res.status(201).json({ task });
    } catch (error) {
        console.error('Create Task Error:', error);
        res.status(500).json({ message: 'Failed to create task' });
    }
};

/**
 * Get all tasks (optionally filter by project, by user, etc.)
 */
exports.getAllTasks = async (req, res) => {
    try {
        // You can parse query params: /api/tasks?projectId=xxx or /api/tasks?assignedTo=xxx
        const { projectId, assignedTo, status, priority, dueDate } = req.query;
        const query = {};

        if (projectId) {
            query.projectId = projectId;
        }
        if (assignedTo) {
            query.assignedTo = assignedTo;
        }
        if (status) {
            query.status = status;
        }
        if (priority) {
            query.priority = priority;
        }
        if (dueDate) {
            // Handle dueDate filter (e.g., before, after, on a specific date)
            const dateParts = dueDate.split(':');
            if (dateParts.length === 2) {
                const [operator, date] = dateParts;
                if (operator === 'before') {
                    query.dueDate = { $lt: new Date(date) };
                } else if (operator === 'after') {
                    query.dueDate = { $gt: new Date(date) };
                }
            } else {
                // Exact date match
                const targetDate = new Date(dueDate);
                const nextDay = new Date(targetDate);
                nextDay.setDate(nextDay.getDate() + 1);
                
                query.dueDate = {
                    $gte: targetDate,
                    $lt: nextDay
                };
            }
        }

        const tasks = await Task.find(query)
            .populate('assignedTo', 'name email')
            .populate('projectId', 'name');

        res.json({ tasks });
    } catch (error) {
        console.error('Get All Tasks Error:', error);
        res.status(500).json({ message: 'Failed to retrieve tasks' });
    }
};

/**
 * Get a task by ID
 */
exports.getTaskById = async (req, res) => {
    try {
        const { taskId } = req.params;
        const task = await Task.findById(taskId)
            .populate('assignedTo', 'name email')
            .populate('projectId', 'name')
            .populate('comments')
            .populate('labels');

        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        res.json({ task });
    } catch (error) {
        console.error('Get Task By ID Error:', error);
        res.status(500).json({ message: 'Failed to retrieve task' });
    }
};

/**
 * Update a task
 */
exports.updateTask = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { title, description, status, priority, assignedTo, dueDate } = req.body;

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Track changes for notifications
        const oldStatus = task.status;
        const oldAssignedTo = task.assignedTo ? task.assignedTo.toString() : null;
        
        // Update fields
        if (title) task.title = title;
        if (description) task.description = description;
        if (priority) task.priority = priority;
        if (dueDate) task.dueDate = dueDate;
        
        // Handle status change
        if (status && status !== oldStatus) {
            task.status = status;
            
            // If task is now done, record completion date
            if (status === 'Done') {
                task.endDate = new Date();
            } else if (oldStatus === 'Done') {
                // If task was done but now isn't, clear the end date
                task.endDate = null;
            }
            
            // Notify the assigned user about status change
            if (task.assignedTo) {
                await notifyTaskStatusChange(
                    task.assignedTo.toString(), 
                    task, 
                    oldStatus, 
                    req.user._id
                );
            }
        }
        
        // Handle assignee change
        if (assignedTo && assignedTo !== oldAssignedTo) {
            // Notify the new assignee
            await notifyTaskAssignment(assignedTo, task, req.user._id);
            
            // If was previously assigned to someone else, notify them too
            if (oldAssignedTo) {
                await notifyTaskStatusChange(
                    oldAssignedTo,
                    task,
                    'Assigned to you',
                    'Unassigned from you',
                    req.user._id
                );
            }
            
            task.assignedTo = assignedTo;
            
            // If task is being started, record start date
            if (!task.startDate && task.status === 'Doing') {
                task.startDate = new Date();
            }
        }

        await task.save();

        await logAction(
            req.user._id,
            'UPDATE_TASK',
            'Task',
            task._id,
            { 
                title, 
                status, 
                oldStatus, 
                assignedTo, 
                oldAssignedTo 
            },
            req.ip
        );

        // Generate AI summary for affected users
        if (task.assignedTo) {
            await sendAISummary(task.assignedTo.toString(), task.projectId.toString());
        }
        
        // Update AI summary for project owner too
        const project = await Project.findById(task.projectId);
        if (project && project.ownerUserId) {
            await sendAISummary(project.ownerUserId.toString(), task.projectId.toString());
        }

        res.json({ task });
    } catch (error) {
        console.error('Update Task Error:', error);
        res.status(500).json({ message: 'Failed to update task' });
    }
};

/**
 * Delete a task
 */
exports.deleteTask = async (req, res) => {
    try {
        const { taskId } = req.params;
        const task = await Task.findById(taskId);

        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Optional: verify authorization, e.g. only the project manager or the owner can remove the task

        // Store data for notifications before deleting
        const projectId = task.projectId.toString();
        const assignedTo = task.assignedTo ? task.assignedTo.toString() : null;
        const taskTitle = task.title;

        await Task.findByIdAndDelete(taskId);

        // Also remove from project's tasks array
        await Project.findByIdAndUpdate(projectId, {
            $pull: { tasks: task._id }
        });

        await logAction(
            req.user._id,
            'DELETE_TASK',
            'Task',
            task._id,
            { title: taskTitle, projectId },
            req.ip
        );

        // Notify assigned user if applicable
        if (assignedTo) {
            await notifyTaskStatusChange(
                assignedTo,
                { 
                    _id: taskId, 
                    title: taskTitle, 
                    projectId, 
                    status: 'Deleted' 
                },
                task.status,
                req.user._id
            );
            
            // Update their AI summary
            await sendAISummary(assignedTo, projectId);
        }
        
        // Update project owner's summary
        const project = await Project.findById(projectId);
        if (project && project.ownerUserId) {
            await sendAISummary(project.ownerUserId.toString(), projectId);
        }

        res.json({ message: 'Task deleted' });
    } catch (error) {
        console.error('Delete Task Error:', error);
        res.status(500).json({ message: 'Failed to delete task' });
    }
};

/**
 * Assign a task to a user (dedicated route)
 */
exports.assignTask = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { userId } = req.body; // user to assign

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Store previous assignee if any
        const oldAssignedTo = task.assignedTo ? task.assignedTo.toString() : null;
        
        // Update the task
        task.assignedTo = userId;
        
        // If this is the first assignment and task is in progress, set start date
        if (!task.startDate && task.status === 'Doing') {
            task.startDate = new Date();
        }
        
        await task.save();

        await logAction(
            req.user._id,
            'ASSIGN_TASK',
            'Task',
            task._id,
            { 
                assignedTo: userId,
                oldAssignedTo,
                title: task.title
            },
            req.ip
        );

        // Notify the newly assigned user
        await notifyTaskAssignment(userId, task, req.user._id);
        
        // If it was reassigned, notify the previous assignee
        if (oldAssignedTo && oldAssignedTo !== userId) {
            await notifyTaskStatusChange(
                oldAssignedTo,
                task,
                'Assigned to you',
                'Reassigned to someone else',
                req.user._id
            );
        }
        
        // Update AI summaries for both users
        await sendAISummary(userId, task.projectId.toString());
        
        if (oldAssignedTo && oldAssignedTo !== userId) {
            await sendAISummary(oldAssignedTo, task.projectId.toString());
        }

        res.json({ task });
    } catch (error) {
        console.error('Assign Task Error:', error);
        res.status(500).json({ message: 'Failed to assign task' });
    }
};

/**
 * Check for upcoming deadlines and notify users
 * This would typically be called by a scheduler
 */
exports.checkDeadlines = async () => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const inThreeDays = new Date(today);
        inThreeDays.setDate(inThreeDays.getDate() + 3);
        
        // Find tasks due today
        const tasksDueToday = await Task.find({
            dueDate: {
                $gte: today,
                $lt: tomorrow
            },
            status: { $ne: 'Done' }
        }).populate('assignedTo');
        
        // Find tasks due in the next 3 days
        const tasksDueSoon = await Task.find({
            dueDate: {
                $gte: tomorrow,
                $lt: inThreeDays
            },
            status: { $ne: 'Done' }
        }).populate('assignedTo');
        
        // Notify users with tasks due today
        for (const task of tasksDueToday) {
            if (task.assignedTo) {
                await notifyTaskDeadline(
                    task.assignedTo._id.toString(),
                    task,
                    0
                );
            }
        }
        
        // Notify users with tasks due soon
        for (const task of tasksDueSoon) {
            if (task.assignedTo) {
                const dueDate = new Date(task.dueDate);
                const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                
                await notifyTaskDeadline(
                    task.assignedTo._id.toString(),
                    task,
                    daysUntilDue
                );
            }
        }
        
        return {
            tasksDueToday: tasksDueToday.length,
            tasksDueSoon: tasksDueSoon.length
        };
    } catch (error) {
        console.error('Check Deadlines Error:', error);
        throw error;
    }
};