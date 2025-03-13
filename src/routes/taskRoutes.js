// src/routes/taskRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
    createTask,
    getAllTasks,
    getTaskById,
    updateTask,
    deleteTask,
    assignTask
} = require('../controllers/taskController');

/**
 * @route   POST /api/tasks
 * @desc    Create a new task
 */
router.post('/', auth, createTask);

/**
 * @route   GET /api/tasks
 * @desc    Get all tasks (optionally filtered by project or user)
 */
router.get('/', auth, getAllTasks);

/**
 * @route   GET /api/tasks/:taskId
 * @desc    Get task details by ID
 */
router.get('/:taskId', auth, getTaskById);

/**
 * @route   PUT /api/tasks/:taskId
 * @desc    Update an existing task
 */
router.put('/:taskId', auth, updateTask);

/**
 * @route   DELETE /api/tasks/:taskId
 * @desc    Delete a task
 */
router.delete('/:taskId', auth, deleteTask);

/**
 * @route   POST /api/tasks/:taskId/assign
 * @desc    Assign a task to a user
 */
router.post('/:taskId/assign', auth, assignTask);

module.exports = router;