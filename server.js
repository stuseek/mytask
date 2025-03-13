// server.js - Optimized for concurrent users
require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const app = require('./src/app');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});

// Determine if we should run in cluster mode in production
const isProduction = process.env.NODE_ENV === 'production';
const shouldCluster = isProduction && !process.env.DISABLE_CLUSTERING;

// Implement basic clustering for production environment
if (shouldCluster && cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);
  
  // Fork workers based on CPU cores (max 4 to avoid excessive memory usage)
  const workerCount = Math.min(numCPUs, 4);
  
  for (let i = 0; i < workerCount; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
} else {
  // This code runs in worker processes or if clustering is disabled
  
  // Database connection string
  const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mytask';
  console.log(`Connecting to database: ${DB_URI}`);
  
  // Connect to MongoDB with optimized connection pool
  mongoose
    .connect(DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 50,  // Increase connection pool for concurrent users
      serverSelectionTimeoutMS: 5000, // Fail fast if DB unavailable
    })
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => {
      console.error('MongoDB connection error:', err);
      process.exit(1);
    });
  
  // Create HTTP server
  const server = http.createServer(app);
  
  // Setup Socket.IO for real-time notifications
  const { Server } = require('socket.io');
  const io = new Server(server, {
    cors: { origin: process.env.CLIENT_URL || '*' },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000, // Increase timeout for potentially slow connections
    maxHttpBufferSize: 1e6, // 1MB - prevent large payload attacks
  });
  
  // Pass `io` to our notification socket logic
  require('./src/websocket/notificationSocket')(io);
  
  // Start server
  const PORT = process.env.PORT || 4000;
  server.listen(PORT, () => {
    console.log(`Worker ${process.pid} listening on port ${PORT}`);
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION! 💥 Shutting down...');
    console.error(err.name, err.message, err.stack);
    server.close(() => {
      process.exit(1);
    });
  });
  
  // Handle SIGTERM signal
  process.on('SIGTERM', () => {
    console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
    server.close(() => {
      console.log('💥 Process terminated!');
    });
  });
}
