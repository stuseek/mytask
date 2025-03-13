const Notification = require('../models/notificationModel');

// Basic function to create a notification entry
async function createNotification(userId, message, url) {
  const notification = new Notification({ userId, message, url });
  await notification.save();
  return notification;
}

module.exports = {
  createNotification
};
