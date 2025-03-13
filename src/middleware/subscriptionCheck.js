// src/middleware/subscriptionCheck.js
const Project = require('../models/projectModel');
const Team = require('../models/teamModel');
const User = require('../models/userModel');
const Subscription = require('../models/subscriptionModel');

/**
 * Middleware to check if user has access to a subscription feature
 * @param {String} featureName - Name of the feature to check access for
 * @returns {Function} Express middleware function
 */
const checkFeatureAccess = (featureName) => {
  return async (req, res, next) => {
    try {
      const projectId = req.params.projectId || req.body.projectId;
      if (!projectId) {
        return res.status(400).json({ message: 'Project ID is required' });
      }
      
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      // Find team and subscription if available
      let hasFeatureAccess = false;
      
      if (project.teamIds && project.teamIds.length > 0) {
        // Check team subscription
        const team = await Team.findById(project.teamIds[0]);
        if (team) {
          const subscription = await Subscription.findOne({ 
            teamId: team._id, 
            status: 'Active' 
          });
          
          if (subscription && subscription.features.includes(featureName)) {
            hasFeatureAccess = true;
          }
        }
      }
      
      // Check if project owner has subscription as fallback
      if (!hasFeatureAccess) {
        const ownerUser = await User.findById(project.ownerUserId);
        if (ownerUser) {
          const subscription = await Subscription.findOne({ 
            userId: ownerUser._id, 
            status: 'Active' 
          });
          
          if (subscription && subscription.features.includes(featureName)) {
            hasFeatureAccess = true;
          }
        }
      }
      
      // If neither team nor owner has subscription for this feature
      if (!hasFeatureAccess) {
        return res.status(403).json({ 
          message: `This feature requires a subscription upgrade`,
          feature: featureName,
          upgradeUrl: '/subscriptions/plans'
        });
      }
      
      // Feature access granted
      next();
    } catch (error) {
      console.error('Subscription check error:', error);
      res.status(500).json({ message: 'Failed to verify subscription status' });
    }
  };
};

module.exports = {
  checkFeatureAccess
};
