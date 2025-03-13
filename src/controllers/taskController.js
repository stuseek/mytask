// src/controllers/taskController.js
const Task = require('../models/taskModel');
const Project = require('../models/projectModel');
const { logAction } = require('../utils/logger');
const { createNotification } = require('../services/notificationService');

/**
 * Create a new task
 */
exports.createTask = async (req, res) => {
    try {
        const { title, description, projectId, assignedTo, priority, status } = req.body;

        // Optional: verify the user is allowed to create tasks in this project
        // e.g., check if req.user is part of the project or a manager

        const task = new Task({
            title,
            description,
            projectId,
            assignedTo,
            priority,
            status
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

        // You can optionally update the Project to push this task into its `tasks` array
        await Project.findByIdAndUpdate(projectId, {
            $push: { tasks: task._id }
        });

        // Notify the user who was assigned (if assignedTo is set)
        if (assignedTo) {
            await createNotification(
                assignedTo,
                `You have been assigned a new task: ${task.title}`,
                `/tasks/${task._id}`
            );
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
        const { projectId, assignedTo } = req.query;
        const query = {};

        if (projectId) {
            query.projectId = projectId;
        }
        if (assignedTo) {
            query.assignedTo = assignedTo;
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
            .populate('projectId', 'name');

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

        // Update fields
        if (title) task.title = title;
        if (description) task.description = description;
        if (status) task.status = status;
        if (priority) task.priority = priority;
        if (assignedTo) {
            // if assignedTo changes from oldUser to newUser, you can notify both
            // oldUser: "Task unassigned"
            // newUser: "Task assigned to you"
            task.assignedTo = assignedTo;
        }
        if (dueDate) task.dueDate = dueDate;

        await task.save();

        await logAction(
            req.user._id,
            'UPDATE_TASK',
            'Task',
            task._id,
            { title, status, assignedTo },
            req.ip
        );

        // Possibly notify the assigned user
        if (assignedTo) {
            await createNotification(
                assignedTo,
                `Task updated: ${task.title}`,
                `/tasks/${task._id}`
            );
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

        await Task.findByIdAndDelete(taskId);

        // Also remove from project's tasks array
        await Project.findByIdAndUpdate(task.projectId, {
            $pull: { tasks: task._id }
        });

        await logAction(
            req.user._id,
            'DELETE_TASK',
            'Task',
            task._id,
            { title: task.title },
            req.ip
        );

        res.json({ message: 'Task deleted' });
    } catch (error) {
        console.error('Delete Task Error:', error);
        res.status(500).json({ message: 'Failed to delete task' });
    }
};

/**
 * Assign a task to a user (alternate approach if you want a dedicated route)
 */
exports.assignTask = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { userId } = req.body; // user to assign

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Perform any necessary checks (e.g., is user in the same project/team?)
        task.assignedTo = userId;
        await task.save();

        await logAction(
            req.user._id,
            'ASSIGN_TASK',
            'Task',
            task._id,
            { assignedTo: userId },
            req.ip
        );

        // Notify the assigned user
        await createNotification(
            userId,
            `You have been assigned a task: ${task.title}`,
            `/tasks/${task._id}`
        );

        res.json({ task });
    } catch (error) {
        console.error('Assign Task Error:', error);
        res.status(500).json({ message: 'Failed to assign task' });
    }
};