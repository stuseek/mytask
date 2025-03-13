// src/routes/sprintRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { 
    validateSprintRequest, 
    validateTaskOperation 
} = require('../middleware/sprintValidation');
const { 
    sensitiveOperationsLimiter 
} = require('../middleware/rateLimiter');
const { 
    createSprint,
    getSprintsForProject,
    getSprintById,
    updateSprint,
    deleteSprint,
    addTaskToSprint,
    removeTaskFromSprint,
    recalculateSprintProgress
} = require('../controllers/sprintController');

/**
 * @route   POST /api/projects/:projectId/sprints
 * @desc    Create a new sprint for a project
 * @access  Private - Project Owner or Manager
 */
router.post('/projects/:projectId/sprints', 
    auth, 
    validateSprintRequest(false), 
    createSprint
);

/**
 * @route   GET /api/projects/:projectId/sprints
 * @desc    Get all sprints for a project with filtering and pagination
 * @access  Private - Project Members
 */
router.get('/projects/:projectId/sprints', auth, getSprintsForProject);

/**
 * @route   GET /api/sprints/:sprintId
 * @desc    Get a specific sprint by ID
 * @access  Private - Project Members
 */
router.get('/:sprintId', auth, getSprintById);

/**
 * @route   PUT /api/sprints/:sprintId
 * @desc    Update a sprint
 * @access  Private - Project Owner or Manager
 */
router.put('/:sprintId', 
    auth, 
    validateSprintRequest(true), 
    updateSprint
);

/**
 * @route   DELETE /api/sprints/:sprintId
 * @desc    Delete a sprint
 * @access  Private - Project Owner or Manager
 */
router.delete('/:sprintId', 
    auth, 
    sensitiveOperationsLimiter, 
    deleteSprint
);

/**
 * @route   POST /api/sprints/:sprintId/tasks/:taskId
 * @desc    Add a task to a sprint
 * @access  Private - Project Owner or Manager
 */
router.post('/:sprintId/tasks/:taskId', 
    auth, 
    validateTaskOperation, 
    addTaskToSprint
);

/**
 * @route   DELETE /api/sprints/:sprintId/tasks/:taskId
 * @desc    Remove a task from a sprint
 * @access  Private - Project Owner or Manager
 */
router.delete('/:sprintId/tasks/:taskId', 
    auth, 
    validateTaskOperation, 
    removeTaskFromSprint
);

/**
 * @route   POST /api/sprints/:sprintId/recalculate-progress
 * @desc    Recalculate sprint progress
 * @access  Private - Project Members with edit permission
 */
router.post('/:sprintId/recalculate-progress', auth, recalculateSprintProgress);

/**
 * @route   GET /api/sprints/status/active
 * @desc    Get all currently active sprints
 * @access  Private - Admin only
 */
router.get('/status/active', auth, async (req, res, next) => {
    try {
        const Sprint = require('../models/sprintModel');
        
        // Check for admin permission
        if (req.user.role !== 'Admin') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }
        
        const activeSprintIds = await Sprint.findActive()
            .select('_id name projectId startDate endDate')
            .populate({
                path: 'projectId',
                select: 'name ownerUserId'
            });
        
        res.json({
            success: true,
            count: activeSprintIds.length,
            data: activeSprintIds
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/sprints/status/upcoming
 * @desc    Get all upcoming sprints
 * @access  Private - Project Members
 */
router.get('/status/upcoming', auth, async (req, res, next) => {
    try {
        const Sprint = require('../models/sprintModel');
        
        // For a regular user, filter by projects they're members of
        const upcomingSprints = await Sprint.findUpcoming()
            .select('_id name projectId startDate endDate progressPercentage')
            .populate({
                path: 'projectId',
                select: 'name'
            });
        
        // Filter based on project membership (if not admin)
        let filteredSprints = upcomingSprints;
        if (req.user.role !== 'Admin') {
            // Get user's project IDs (this depends on your specific implementation)
            const ProjectMember = require('../models/projectMemberModel');
            const userProjects = await ProjectMember.find({ userId: req.user._id })
                .select('projectId');
            
            const userProjectIds = userProjects.map(p => String(p.projectId));
            
            // Filter sprints to only include those from projects the user is a member of
            filteredSprints = upcomingSprints.filter(sprint => 
                userProjectIds.includes(String(sprint.projectId._id))
            );
        }
        
        res.json({
            success: true,
            count: filteredSprints.length,
            data: filteredSprints
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/sprints/statistics/completion-rate
 * @desc    Get completion statistics for sprints
 * @access  Private - Admin only
 */
router.get('/statistics/completion-rate', auth, async (req, res, next) => {
    try {
        // Check for admin permission
        if (req.user.role !== 'Admin') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }
        
        const Sprint = require('../models/sprintModel');
        const Task = require('../models/taskModel');
        
        // Get all completed sprints
        const completedSprints = await Sprint.find({ status: 'Completed' })
            .select('_id name taskIds progressPercentage');
        
        // Calculate statistics
        let totalSprints = completedSprints.length;
        let totalTasksPlanned = 0;
        let totalTasksCompleted = 0;
        
        for (const sprint of completedSprints) {
            const tasks = await Task.find({ _id: { $in: sprint.taskIds } });
            totalTasksPlanned += tasks.length;
            totalTasksCompleted += tasks.filter(t => t.status === 'Completed').length;
        }
        
        const averageCompletionRate = totalTasksPlanned > 0
            ? (totalTasksCompleted / totalTasksPlanned) * 100
            : 0;
        
        res.json({
            success: true,
            data: {
                totalCompletedSprints: totalSprints,
                totalTasksPlanned,
                totalTasksCompleted,
                averageCompletionRate: Math.round(averageCompletionRate * 10) / 10 // Round to 1 decimal
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/sprints/statistics/burndown/:sprintId
 * @desc    Get burndown chart data for a sprint
 * @access  Private - Project Members
 */
router.get('/statistics/burndown/:sprintId', auth, async (req, res, next) => {
    try {
        const { sprintId } = req.params;
        
        if (!mongoose.Types.ObjectId.isValid(sprintId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid sprint ID format'
            });
        }
        
        const Sprint = require('../models/sprintModel');
        const Task = require('../models/taskModel');
        const TaskHistory = require('../models/taskHistoryModel');
        
        const sprint = await Sprint.findById(sprintId);
        if (!sprint) {
            return res.status(404).json({
                success: false,
                message: 'Sprint not found'
            });
        }
        
        // Check if user has access to this sprint
        const project = await Project.findById(sprint.projectId);
        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }
        
        // Check if user is a member of the project
        if (!await isProjectMember(project, req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this data'
            });
        }
        
        // Get all tasks for this sprint
        const tasks = await Task.find({ _id: { $in: sprint.taskIds } });
        
        // Get task history for burndown data
        const taskHistories = await TaskHistory.find({
            taskId: { $in: tasks.map(t => t._id) },
            timestamp: { 
                $gte: sprint.startDate,
                $lte: sprint.endDate || new Date() 
            }
        }).sort({ timestamp: 1 });
        
        // Process data for burndown chart
        const burndownData = processBurndownData(sprint, tasks, taskHistories);
        
        res.json({
            success: true,
            data: burndownData
        });
    } catch (error) {
        next(error);
    }
});

/**
 * Helper function to process burndown chart data
 */
function processBurndownData(sprint, tasks, taskHistories) {
    // Implementation would depend on your specific requirements
    // This is a placeholder that would normally calculate remaining work over time
    
    const startDate = new Date(sprint.startDate);
    const endDate = sprint.endDate ? new Date(sprint.endDate) : new Date();
    
    // Calculate total estimated hours
    const totalEstimatedHours = tasks.reduce((sum, task) => 
        sum + (task.estimatedHours || 0), 0);
    
    // Create ideal burndown line (straight line from start to end)
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const idealBurndown = [];
    
    for (let i = 0; i <= totalDays; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + i);
        
        idealBurndown.push({
            date: currentDate.toISOString().split('T')[0],
            idealRemaining: totalEstimatedHours - ((totalEstimatedHours / totalDays) * i)
        });
    }
    
    // Use task history to calculate actual burndown
    // This is simplified and would need to be adapted based on your task history model
    const actualBurndown = { ...idealBurndown };
    
    // Return combined data
    return {
        ideal: idealBurndown,
        actual: actualBurndown,
        totalEstimatedHours
    };
}

/**
 * Helper function to check if user is a member of the project
 */
async function isProjectMember(project, userId) {
    // Project owner is always a member
    if (String(project.ownerUserId) === String(userId)) {
        return true;
    }
    
    // Check if user has any role in the project
    try {
        const ProjectMember = require('../models/projectMemberModel');
        const membership = await ProjectMember.findOne({ 
            projectId: project._id, 
            userId 
        });
        
        return membership !== null;
    } catch (error) {
        console.error('Check Project Member Error:', error);
        return false;
    }
}

module.exports = router;