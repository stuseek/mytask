// src/middleware/sprintValidation.js
const mongoose = require('mongoose');
const { validateSprintInput } = require('../validators/sprintValidator');

/**
 * Middleware to validate sprint creation/update requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.validateSprintRequest = (isUpdate = false) => {
    return (req, res, next) => {
        // Validate input data
        const validationError = validateSprintInput(req.body, isUpdate);
        if (validationError) {
            return res.status(400).json({ 
                success: false,
                message: validationError 
            });
        }
        
        // Validate MongoDB ID if present in params
        if (req.params.sprintId && !mongoose.Types.ObjectId.isValid(req.params.sprintId)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid sprint ID format' 
            });
        }
        
        if (req.params.projectId && !mongoose.Types.ObjectId.isValid(req.params.projectId)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid project ID format' 
            });
        }
        
        next();
    };
};

/**
 * Middleware to validate task manipulation in sprints
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.validateTaskOperation = (req, res, next) => {
    const { sprintId, taskId } = req.params;
    
    // Validate MongoDB IDs
    if (!mongoose.Types.ObjectId.isValid(sprintId)) {
        return res.status(400).json({ 
            success: false,
            message: 'Invalid sprint ID format' 
        });
    }
    
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
        return res.status(400).json({ 
            success: false,
            message: 'Invalid task ID format' 
        });
    }
    
    next();
};
