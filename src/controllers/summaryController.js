// src/controllers/summaryController.js
const aiService = require('../services/aiService');
const User = require('../models/userModel');
const Project = require('../models/projectModel');
const { logAction } = require('../utils/logger');

/**
 * Get summaries for current user (all projects or specific project)
 */
exports.getUserSummaries = async (req, res) => {
  try {
    const { projectId } = req.query;
    
    // Generate fresh summaries
    const summaries = await aiService.generateUserSummaries(
      req.user._id,
      projectId || null
    );
    
    res.json(summaries);
  } catch (error) {
    console.error('Error fetching summaries:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get cached summaries without regenerating
 * Faster but might return stale data
 */
exports.getCachedSummaries = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Format response similar to generateUserSummaries
    const response = {
      id: user._id,
      name: user.name,
      role: user.projectRoles,
      summaries: {}
    };
    
    // If projectId specified, only return that project
    const { projectId } = req.query;
    if (projectId) {
      if (user.summaries.has(projectId)) {
        response.summaries[projectId] = user.summaries.get(projectId);
      }
    } else {
      // Convert Map to object
      for (const [key, value] of user.summaries.entries()) {
        response.summaries[key] = value;
      }
    }
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching cached summaries:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Generate summaries for all users in a project
 * Admin/Manager only endpoint
 */
exports.generateProjectSummaries = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Verify the user has management permissions
    const userRole = req.user.projectRoles.get(projectId);
    if (userRole !== 'Manager' && userRole !== 'Superadmin') {
      return res.status(403).json({ 
        message: 'Only managers can generate summaries for all users' 
      });
    }
    
    // Find all project members
    const members = await User.find({
      $or: [
        { assignedProjects: projectId },
        { ownedProjects: projectId }
      ]
    });
    
    // Generate summaries for each user (this could be time consuming)
    const results = [];
    for (const member of members) {
      try {
        await aiService.generateUserSummaries(member._id, projectId);
        results.push({
          userId: member._id,
          name: member.name,
          status: 'success'
        });
      } catch (error) {
        results.push({
          userId: member._id,
          name: member.name,
          status: 'error',
          message: error.message
        });
      }
    }
    
    // Log the action
    await logAction(
      req.user._id,
      'GENERATE_PROJECT_SUMMARIES',
      'Project',
      projectId,
      { usersProcessed: members.length },
      req.ip
    );
    
    res.json({
      message: `Generated summaries for ${members.length} users`,
      results
    });
  } catch (error) {
    console.error('Error generating project summaries:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Invalidate summary cache for a project
 * Useful after major project updates
 */
exports.invalidateProjectSummaries = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Verify the project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Invalidate cache
    aiService.invalidateProjectSummaries(projectId);
    
    // Log the action
    await logAction(
      req.user._id,
      'INVALIDATE_SUMMARIES',
      'Project',
      projectId,
      {},
      req.ip
    );
    
    res.json({
      message: 'Project summaries invalidated successfully'
    });
  } catch (error) {
    console.error('Error invalidating summaries:', error);
    res.status(500).json({ message: error.message });
  }
};
