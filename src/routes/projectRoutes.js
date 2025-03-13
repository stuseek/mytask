const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { checkFeatureAccess } = require('../middleware/subscriptionCheck');
const {
  createProject,
  getAllProjects,
  updateProject
} = require('../controllers/projectController');
const {
  getProjectSettings,
  updateProjectStatuses,
  migrateTaskStatuses
} = require('../controllers/projectSettingsController');

// Basic project routes - protected by JWT auth
router.post('/', auth, createProject);
router.get('/', auth, getAllProjects);
router.put('/:id', auth, updateProject);

// Project settings routes
router.get('/:projectId/settings', auth, getProjectSettings);

// Custom status routes - require subscription
router.patch(
  '/:projectId/settings/statuses', 
  auth, 
  checkFeatureAccess('custom-statuses'),
  updateProjectStatuses
);

// Task status migration route
router.post(
  '/:projectId/migrate-statuses', 
  auth, 
  checkFeatureAccess('custom-statuses'),
  migrateTaskStatuses
);

module.exports = router;
