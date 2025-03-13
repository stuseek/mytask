// src/validators/sprintValidator.js

/**
 * Validates sprint input data
 * @param {Object} data - Sprint data to validate
 * @param {Boolean} isUpdate - Whether this is for update (partial data allowed)
 * @returns {String|null} Error message or null if valid
 */
exports.validateSprintInput = (data, isUpdate = false) => {
    const { name, startDate, endDate } = data;
    
    // For creation, name is required
    if (!isUpdate && !name) {
        return 'Sprint name is required';
    }
    
    // Name length validation (if provided)
    if (name && (name.trim().length < 3 || name.trim().length > 100)) {
        return 'Sprint name must be between 3 and 100 characters';
    }
    
    // Date validation
    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // Check if dates are valid
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return 'Invalid date format';
        }
        
        // Ensure end date is after start date
        if (end < start) {
            return 'End date must be after start date';
        }
    } else if ((startDate && !endDate) || (!startDate && endDate)) {
        // If one date is provided, both should be provided
        if (!isUpdate) {
            return 'Both start and end dates must be provided';
        }
    }
    
    return null;
};

/**
 * Validates task assignment to sprint
 * @param {Object} task - Task to be assigned
 * @param {Object} sprint - Sprint to assign task to
 * @returns {String|null} Error message or null if valid
 */
exports.validateTaskAssignment = (task, sprint) => {
    // Check if task belongs to the same project
    if (String(task.projectId) !== String(sprint.projectId)) {
        return 'Task does not belong to the same project as the sprint';
    }
    
    // Check if task dates fit within sprint dates (if specified)
    if (sprint.startDate && sprint.endDate && task.dueDate) {
        const dueDate = new Date(task.dueDate);
        const sprintStart = new Date(sprint.startDate);
        const sprintEnd = new Date(sprint.endDate);
        
        if (dueDate < sprintStart || dueDate > sprintEnd) {
            return 'Task due date is outside the sprint date range';
        }
    }
    
    return null;
};
