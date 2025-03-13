// src/routes/summaryRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { checkFeatureAccess } = require('../middleware/subscriptionCheck');
const { aiOperationsLimiter } = require('../middleware/rateLimiter');
const {
  getUserSummaries,
  getCachedSummaries,
  generateProjectSummaries,
  invalidateProjectSummaries
} = require('../controllers/summaryController');

// Get summaries for the current user (rate limited)
router.get('/', auth, aiOperationsLimiter, getUserSummaries);

// Get cached summaries (faster but might be stale) - no rate limit
router.get('/cached', auth, getCachedSummaries);

// Generate summaries for all users in a project (Manager/Admin only)
router.post('/projects/:projectId', 
  auth, 
  aiOperationsLimiter,
  generateProjectSummaries
);

// Invalidate summaries for a project after major updates
router.post('/projects/:projectId/invalidate', 
  auth, 
  invalidateProjectSummaries
);

module.exports = router;
