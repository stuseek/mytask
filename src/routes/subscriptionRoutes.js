// src/routes/subscriptionRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getSubscriptionPlans,
  getCurrentSubscription,
  createSubscription,
  cancelSubscription
} = require('../controllers/subscriptionController');

// Public endpoint for viewing plans
router.get('/plans', getSubscriptionPlans);

// Protected endpoints
router.get('/current', auth, getCurrentSubscription);
router.post('/', auth, createSubscription);
router.patch('/:subscriptionId/cancel', auth, cancelSubscription);

module.exports = router;
