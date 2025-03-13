// src/controllers/projectSettingsController.js
const Project = require('../models/projectModel');
const Task = require('../models/taskModel');
const { logAction } = require('../utils/logger');

/**
 * Update project status settings
 * Requires subscription feature: custom-statuses
 */
exports.updateProjectStatuses = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { statuses } = req.body;
    
    // Validate input
    if (!Array.isArray(statuses) || statuses.length < 2) {
      return res.status(400).json({ 
        message: 'Please provide at least 2 statuses'
      });
    }
    
    if (statuses.length > 10) {
      return res.status(400).json({ 
        message: 'Maximum 10 statuses allowed'
      });
    }
    
    // Check for duplicate statuses
    const uniqueStatuses = [...new Set(statuses)];
    if (uniqueStatuses.length !== statuses.length) {
      return res.status(400).json({ 
        message: 'Duplicate statuses are not allowed'
      });
    }
    
    // Get current project statuses
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    const oldStatuses = project.settings.statuses;
    
    // Update project settings
    project.settings.statuses = statuses;
    await project.save();
    
    // Log the action
    await logAction(
      req.user._id,
      'UPDATE_PROJECT_STATUSES',
      'Project',
      projectId,
      { oldStatuses, newStatuses: statuses },
      req.ip
    );
    
    // Check if any tasks need status migration
    const taskCount = await Task.countDocuments({
      projectId,
      status: { $nin: statuses }
    });
    
    res.json({ 
      message: 'Project statuses updated successfully',
      statuses,
      tasksNeedingMigration: taskCount
    });
  } catch (error) {
    console.error('Error updating project statuses:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Migrate tasks with deprecated statuses to new ones
 */
exports.migrateTaskStatuses = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { statusMappings } = req.body;
    
    // Validate input
    if (!statusMappings || typeof statusMappings !== 'object') {
      return res.status(400).json({ 
        message: 'Please provide status mappings object (old status -> new status)'
      });
    }
    
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Check that all target statuses exist in project settings
    const validStatuses = project.settings.statuses;
    for (const targetStatus of Object.values(statusMappings)) {
      if (!validStatuses.includes(targetStatus)) {
        return res.status(400).json({ 
          message: `Status "${targetStatus}" is not a valid status for this project`
        });
      }
    }
    
    // Perform the migration
    const migrationResults = {};
    for (const [oldStatus, newStatus] of Object.entries(statusMappings)) {
      const result = await Task.updateMany(
        { projectId, status: oldStatus },
        { 
          $set: { status: newStatus },
          $push: { 
            history: {
              field: 'status',
              oldValue: oldStatus,
              newValue: newStatus,
              updatedBy: req.user._id,
              reason: 'Status migration'
            }
          }
        }
      );
      
      migrationResults[oldStatus] = {
        newStatus,
        tasksUpdated: result.modifiedCount
      };
    }
    
    // Log the action
    await logAction(
      req.user._id,
      'MIGRATE_TASK_STATUSES',
      'Project',
      projectId,
      { statusMappings, results: migrationResults },
      req.ip
    );
    
    res.json({ 
      message: 'Tasks migrated successfully',
      migrationResults
    });
  } catch (error) {
    console.error('Error migrating task statuses:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get project settings
 */
exports.getProjectSettings = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const project = await Project.findById(projectId)
      .select('settings');
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    res.json({ settings: project.settings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
