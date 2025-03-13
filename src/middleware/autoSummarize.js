// src/middleware/autoSummarize.js
const aiService = require('../services/aiService');
const User = require('../models/userModel');
const Project = require('../models/projectModel');

/**
 * Middleware to trigger summary refresh for a project
 * Can be used after significant project changes
 */
exports.refreshProjectSummaries = async (req, res, next) => {
  // Store the original send method
  const originalSend = res.send;
  
  // Don't await the summary generation - let it happen in the background
  res.send = function(body) {
    // Call the original send method first to respond to client
    originalSend.call(this, body);
    
    // Then trigger the background summary refresh
    try {
      const projectId = req.params.projectId || req.body.projectId;
      
      if (projectId) {
        // Invalidate caches first
        aiService.invalidateProjectSummaries(projectId);
        
        // Only refresh for managers and owners by default
        // This keeps API usage reasonable
        setTimeout(async () => {
          try {
            const project = await Project.findById(projectId);
            if (!project) return;
            
            // Refresh for project owner
            aiService.generateUserSummaries(project.ownerUserId, projectId)
              .catch(e => console.error('Error refreshing owner summary:', e));
              
            // Find project managers
            const managers = await User.find({
              [`projectRoles.${projectId}`]: { $in: ['Manager', 'Superadmin'] }
            });
            
            // Refresh for each manager
            managers.forEach(manager => {
              aiService.generateUserSummaries(manager._id, projectId)
                .catch(e => console.error(`Error refreshing manager ${manager._id} summary:`, e));
            });
          } catch (error) {
            console.error('Error in background summary refresh:', error);
          }
        }, 100); // Slight delay to ensure response is sent first
      }
    } catch (error) {
      console.error('Error scheduling summary refresh:', error);
    }
    
    return body;
  };
  
  next();
};

/**
 * Middleware to trigger summary refresh for a specific user
 * Can be used after task assignments or user updates
 */
exports.refreshUserSummary = async (req, res, next) => {
  // Store the original send method
  const originalSend = res.send;
  
  // Don't await the summary generation - let it happen in the background
  res.send = function(body) {
    // Call the original send method first to respond to client
    originalSend.call(this, body);
    
    // Then trigger the background summary refresh
    try {
      const userId = req.params.userId || req.body.assignedTo;
      const projectId = req.params.projectId || req.body.projectId;
      
      if (userId) {
        setTimeout(async () => {
          try {
            await aiService.generateUserSummaries(userId, projectId || null);
          } catch (error) {
            console.error(`Error refreshing user ${userId} summary:`, error);
          }
        }, 100); // Slight delay to ensure response is sent first
      }
    } catch (error) {
      console.error('Error scheduling user summary refresh:', error);
    }
    
    return body;
  };
  
  next();
};
