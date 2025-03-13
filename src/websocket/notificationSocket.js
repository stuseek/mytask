module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // Example: client subscribes to notifications
    socket.on('subscribeToNotifications', (userId) => {
      socket.join(`user_${userId}`);
      console.log(`User ${userId} joined room user_${userId}`);
    });

    // Example: client unsubscribes
    socket.on('unsubscribeFromNotifications', (userId) => {
      socket.leave(`user_${userId}`);
      console.log(`User ${userId} left room user_${userId}`);
    });
  });

  // Provide a helper to broadcast messages
  global.sendUserNotification = (userId, notificationData) => {
    io.to(`user_${userId}`).emit('notification', notificationData);
  };
};
