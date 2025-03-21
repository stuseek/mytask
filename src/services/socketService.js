// src/services/socketService.js
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

/**
 * Initialize WebSocket server with optimizations for concurrent users
 * @param {Object} server - HTTP server instance
 */
exports.initialize = (server) => {
    io = socketIO(server, {
        cors: {
            origin: process.env.CLIENT_URL || '*',
            methods: ['GET', 'POST'],
            credentials: true
        },
        // Socket.IO optimizations for higher concurrency
        pingInterval: 25000, // Check connection every 25 seconds
        pingTimeout: 60000, // Wait 60 seconds before considering connection as closed
        maxHttpBufferSize: 1e6, // 1MB - prevent large payload attacks
        transports: ['websocket', 'polling'], // Prefer WebSocket over polling
        // Performance/security settings
        connectTimeout: 45000, // Longer timeout for slower connections
        path: '/socket.io', // Explicit path to avoid conflicts
    });
    
    // Socket connection limit monitoring
    setInterval(() => {
        const connectedSockets = io.engine.clientsCount;
        console.log(`Current connected sockets: ${connectedSockets}`);
        
        // Alert if getting close to high connection counts
        if (connectedSockets > 200) {
            console.warn(`High socket connection count: ${connectedSockets}`);
        }
    }, 60000); // Check every minute
    
    // Socket authentication middleware
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            
            if (!token) {
                return next(new Error('Authentication error: Token missing'));
            }
            
            // Verify JWT token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.id;
            
            next();
        } catch (error) {
            next(new Error('Authentication error: Invalid token'));
        }
    });
    
    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.userId}`);
        
        // Join user to their personal room
        socket.join(`user:${socket.userId}`);
        
        // Track socket connections per user to prevent socket accumulation
        incrementUserSocketCount(socket.userId);
        
        // Join project rooms (called when user loads a project)
        socket.on('joinProject', (projectId) => {
            socket.join(`project:${projectId}`);
            console.log(`User ${socket.userId} joined project room: ${projectId}`);
        });
        
        // Leave project room
        socket.on('leaveProject', (projectId) => {
            socket.leave(`project:${projectId}`);
            console.log(`User ${socket.userId} left project room: ${projectId}`);
        });
        
        // Join sprint room (called when user views a specific sprint)
        socket.on('joinSprint', (sprintId) => {
            socket.join(`sprint:${sprintId}`);
            console.log(`User ${socket.userId} joined sprint room: ${sprintId}`);
        });
        
        // Leave sprint room
        socket.on('leaveSprint', (sprintId) => {
            socket.leave(`sprint:${sprintId}`);
            console.log(`User ${socket.userId} left sprint room: ${sprintId}`);
        });
        
        // Disconnect event
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.userId}`);
            decrementUserSocketCount(socket.userId);
        });
        
        // Error handling
        socket.on('error', (error) => {
            console.error(`Socket error for user ${socket.userId}:`, error);
        });
    });
    
    // Add error handling to the IO instance
    io.engine.on('connection_error', (err) => {
        console.error('Connection error:', err);
    });
    
    return io;
};

// User socket connection tracking to prevent leaks
const userSocketCounts = {};

function incrementUserSocketCount(userId) {
    userSocketCounts[userId] = (userSocketCounts[userId] || 0) + 1;
    
    // Log when a user has many open connections
    if (userSocketCounts[userId] > 5) {
        console.warn(`User ${userId} has ${userSocketCounts[userId]} open socket connections`);
    }
}

function decrementUserSocketCount(userId) {
    if (userSocketCounts[userId]) {
        userSocketCounts[userId]--;
    }
}

/**
 * Emit an event to a specific user
 * @param {String} userId - User ID to send to
 * @param {String} event - Event name
 * @param {Object} data - Event data
 */
exports.emitToUser = (userId, event, data) => {
    if (!io) return console.error('Socket.io not initialized');
    
    io.to(`user:${userId}`).emit(event, data);
};

/**
 * Emit an event to all users in a project
 * @param {String} projectId - Project ID
 * @param {String} event - Event name
 * @param {Object} data - Event data
 */
exports.emitToProject = (projectId, event, data) => {
    if (!io) return console.error('Socket.io not initialized');
    
    io.to(`project:${projectId}`).emit(event, data);
};

/**
 * Emit an event to all users viewing a specific sprint
 * @param {String} sprintId - Sprint ID
 * @param {String} event - Event name
 * @param {Object} data - Event data
 */
exports.emitToSprint = (sprintId, event, data) => {
    if (!io) return console.error('Socket.io not initialized');
    
    io.to(`sprint:${sprintId}`).emit(event, data);
};

/**
 * Broadcast an event to all connected users
 * @param {String} event - Event name
 * @param {Object} data - Event data
 */
exports.broadcastToAll = (event, data) => {
    if (!io) return console.error('Socket.io not initialized');
    
    io.emit(event, data);
};

// Export the io instance for direct access if needed
exports.getIO = () => io;
