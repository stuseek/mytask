const Notification = require('../models/notificationModel');
const aiService = require('./aiService');
const User = require('../models/userModel');

/**
 * Create a notification and send it via WebSocket if available
 * @param {String} userId - User ID to notify
 * @param {String} message - Notification message
 * @param {String} url - Optional URL to include
 * @param {Object} metadata - Optional metadata
 * @returns {Promise<Object>} The created notification
 */
async function createNotification(userId, message, url = null, metadata = {}) {
  try {
    const notification = new Notification({ 
      userId, 
      message, 
      url,
      metadata,
      read: false,
      createdAt: new Date()
    });
    
    await notification.save();
    
    // If global WebSocket function exists, send the notification
    if (global.sendUserNotification) {
      global.sendUserNotification(userId, {
        id: notification._id,
        message,
        url,
        metadata,
        timestamp: notification.createdAt
      });
    }
    
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Send an AI-generated summary as a notification
 * @param {String} userId - User ID to notify
 * @param {String} projectId - Project ID for context
 * @returns {Promise<Object>} The created notification
 */
async function sendAISummary(userId, projectId) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Generate a fresh summary
    const summaries = await aiService.generateUserSummaries(userId, projectId);
    
    // Get the latest summary for this project
    const projectSummaries = summaries.summaries[projectId];
    if (!projectSummaries || projectSummaries.length === 0) {
      return null;
    }
    
    const latestSummary = projectSummaries[0];
    
    // Create and send notification with the summary
    return await createNotification(
      userId,
      latestSummary.content,
      `/projects/${projectId}`,
      {
        type: 'ai_summary',
        projectId,
        summaryId: latestSummary.id,
        timestamp: latestSummary.timestamp
      }
    );
  } catch (error) {
    console.error('Error sending AI summary notification:', error);
    return null;
  }
}

/**
 * Create a notification for task assignment
 * @param {String} userId - User being assigned the task
 * @param {Object} task - Task object
 * @param {String} assignedByUserId - User who assigned the task
 * @returns {Promise<Object>} The created notification
 */
async function notifyTaskAssignment(userId, task, assignedByUserId) {
  try {
    const message = `You have been assigned to task: ${task.title}`;
    const url = `/projects/${task.projectId}/tasks/${task._id}`;
    const metadata = {
      type: 'task_assignment',
      taskId: task._id,
      projectId: task.projectId,
      priority: task.priority,
      dueDate: task.dueDate,
      assignedBy: assignedByUserId
    };
    
    return await createNotification(userId, message, url, metadata);
  } catch (error) {
    console.error('Error creating task assignment notification:', error);
    return null;
  }
}

/**
 * Create a notification for task status change
 * @param {String} userId - User to notify
 * @param {Object} task - Task object
 * @param {String} oldStatus - Previous status
 * @param {String} changedByUserId - User who changed the status
 * @returns {Promise<Object>} The created notification
 */
async function notifyTaskStatusChange(userId, task, oldStatus, changedByUserId) {
  try {
    const message = `Task status changed from ${oldStatus} to ${task.status}: ${task.title}`;
    const url = `/projects/${task.projectId}/tasks/${task._id}`;
    const metadata = {
      type: 'task_status_change',
      taskId: task._id,
      projectId: task.projectId,
      oldStatus,
      newStatus: task.status,
      changedBy: changedByUserId
    };
    
    return await createNotification(userId, message, url, metadata);
  } catch (error) {
    console.error('Error creating task status notification:', error);
    return null;
  }
}

/**
 * Create a notification for approaching task deadline
 * @param {String} userId - User to notify
 * @param {Object} task - Task object
 * @param {Number} daysRemaining - Days remaining until deadline
 * @returns {Promise<Object>} The created notification
 */
async function notifyTaskDeadline(userId, task, daysRemaining) {
  try {
    const message = daysRemaining === 0 
      ? `Task due today: ${task.title}`
      : `Task due in ${daysRemaining} days: ${task.title}`;
      
    const url = `/projects/${task.projectId}/tasks/${task._id}`;
    const metadata = {
      type: 'task_deadline',
      taskId: task._id,
      projectId: task.projectId,
      daysRemaining,
      dueDate: task.dueDate
    };
    
    return await createNotification(userId, message, url, metadata);
  } catch (error) {
    console.error('Error creating deadline notification:', error);
    return null;
  }
}

/**
 * Send a daily AI summary to all users in a project
 * @param {String} projectId - Project ID
 * @returns {Promise<Array>} Array of created notifications
 */
async function sendDailySummaries(projectId) {
  try {
    // Find all users associated with this project
    const users = await User.find({
      $or: [
        { assignedProjects: projectId },
        { ownedProjects: projectId }
      ]
    });
    
    const results = [];
    
    // Generate and send summaries for each user
    for (const user of users) {
      try {
        const notification = await sendAISummary(user._id, projectId);
        if (notification) {
          results.push({
            userId: user._id,
            notificationId: notification._id,
            status: 'success'
          });
        }
      } catch (error) {
        results.push({
          userId: user._id,
          status: 'error',
          message: error.message
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error sending daily summaries:', error);
    throw error;
  }
}

module.exports = {
  createNotification,
  sendAISummary,
  notifyTaskAssignment,
  notifyTaskStatusChange,
  notifyTaskDeadline,
  sendDailySummaries
};
