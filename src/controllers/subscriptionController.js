// src/controllers/subscriptionController.js
const Subscription = require('../models/subscriptionModel');
const User = require('../models/userModel');
const Team = require('../models/teamModel');
const { logAction } = require('../utils/logger');

/**
 * Get available subscription plans
 * Public endpoint
 */
exports.getSubscriptionPlans = async (req, res) => {
  try {
    // In a real app, these would be stored in the database
    // or fetched from a payment provider API
    const plans = [
      {
        id: 'basic',
        name: 'Basic',
        description: 'For small teams getting started',
        features: [],
        userLimit: 10,
        projectLimit: 5,
        price: {
          monthly: 0,
          yearly: 0
        }
      },
      {
        id: 'pro',
        name: 'Professional',
        description: 'For growing teams that need more flexibility',
        features: ['custom-statuses', 'priority-support'],
        userLimit: 20,
        projectLimit: 10,
        price: {
          monthly: 9.99,
          yearly: 99.99
        }
      },
      {
        id: 'business',
        name: 'Business',
        description: 'For organizations that need advanced features',
        features: [
          'custom-statuses',
          'unlimited-projects',
          'priority-support',
          'api-access',
          'advanced-reports'
        ],
        userLimit: 50,
        projectLimit: -1, // Unlimited
        price: {
          monthly: 24.99,
          yearly: 249.99
        }
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        description: 'For large organizations with custom needs',
        features: [
          'custom-statuses',
          'unlimited-projects',
          'unlimited-users',
          'priority-support',
          'api-access',
          'advanced-reports'
        ],
        userLimit: -1, // Unlimited
        projectLimit: -1, // Unlimited
        price: {
          monthly: 49.99,
          yearly: 499.99
        }
      }
    ];
    
    res.json({ plans });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get user's current subscription
 */
exports.getCurrentSubscription = async (req, res) => {
  try {
    // Check for user subscription
    const userSubscription = await Subscription.findOne({
      userId: req.user._id,
      status: 'Active'
    });
    
    // Check for team subscriptions
    const teams = await Team.find({ members: req.user._id });
    const teamIds = teams.map(team => team._id);
    
    const teamSubscriptions = await Subscription.find({
      teamId: { $in: teamIds },
      status: 'Active'
    }).populate('teamId', 'name');
    
    res.json({
      userSubscription,
      teamSubscriptions
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Create a new subscription
 * In a real app, this would involve payment processing
 */
exports.createSubscription = async (req, res) => {
  try {
    const { planId, billingCycle, teamId } = req.body;
    
    // In a real app, validate the plan and process payment here
    // Mock implementation for demonstration
    let planDetails;
    
    switch (planId) {
      case 'pro':
        planDetails = {
          name: 'Professional',
          features: ['custom-statuses', 'priority-support'],
          userLimit: 20,
          projectLimit: 10,
          price: billingCycle === 'Yearly' ? 99.99 : 9.99
        };
        break;
      case 'business':
        planDetails = {
          name: 'Business',
          features: [
            'custom-statuses',
            'unlimited-projects',
            'priority-support',
            'api-access',
            'advanced-reports'
          ],
          userLimit: 50,
          projectLimit: -1,
          price: billingCycle === 'Yearly' ? 249.99 : 24.99
        };
        break;
      case 'enterprise':
        planDetails = {
          name: 'Enterprise',
          features: [
            'custom-statuses',
            'unlimited-projects',
            'unlimited-users',
            'priority-support',
            'api-access',
            'advanced-reports'
          ],
          userLimit: -1,
          projectLimit: -1,
          price: billingCycle === 'Yearly' ? 499.99 : 49.99
        };
        break;
      default:
        return res.status(400).json({ message: 'Invalid plan selected' });
    }
    
    // Calculate end date (1 month or 1 year from now)
    const startDate = new Date();
    const endDate = new Date(startDate);
    
    if (billingCycle === 'Monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }
    
    // Create the subscription
    const subscription = new Subscription({
      name: planDetails.name,
      billingCycle,
      features: planDetails.features,
      userLimit: planDetails.userLimit,
      projectLimit: planDetails.projectLimit,
      price: planDetails.price,
      startDate,
      endDate,
      status: 'Active',
      paymentId: `mock_payment_${Date.now()}`
    });
    
    // Assign to user or team
    if (teamId) {
      const team = await Team.findById(teamId);
      if (!team) {
        return res.status(404).json({ message: 'Team not found' });
      }
      
      // Check if user is team owner
      if (team.ownerUserId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ 
          message: 'Only team owners can purchase team subscriptions' 
        });
      }
      
      subscription.teamId = teamId;
    } else {
      subscription.userId = req.user._id;
    }
    
    await subscription.save();
    
    // Log the action
    await logAction(
      req.user._id,
      'CREATE_SUBSCRIPTION',
      'Subscription',
      subscription._id,
      {
        plan: planId,
        billingCycle,
        teamId: teamId || null
      },
      req.ip
    );
    
    res.status(201).json({
      message: 'Subscription created successfully',
      subscription
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Cancel a subscription
 */
exports.cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }
    
    // Verify ownership
    let authorized = false;
    
    if (subscription.userId && subscription.userId.toString() === req.user._id.toString()) {
      authorized = true;
    } else if (subscription.teamId) {
      const team = await Team.findById(subscription.teamId);
      if (team && team.ownerUserId.toString() === req.user._id.toString()) {
        authorized = true;
      }
    }
    
    if (!authorized) {
      return res.status(403).json({ 
        message: 'You are not authorized to cancel this subscription' 
      });
    }
    
    // Update subscription status
    subscription.status = 'Canceled';
    await subscription.save();
    
    // Log the action
    await logAction(
      req.user._id,
      'CANCEL_SUBSCRIPTION',
      'Subscription',
      subscriptionId,
      { previousStatus: 'Active' },
      req.ip
    );
    
    res.json({
      message: 'Subscription canceled successfully',
      subscription
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
