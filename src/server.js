// src/server.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');

console.log('Starting the server...');

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    console.error(err.name, err.message, err.stack);
    process.exit(1);
});

// Load environment variables
console.log('Loading environment variables...');
dotenv.config({ path: './.env' });

// Import app
console.log('Importing app...');
try {
    const app = require('./app');
    console.log('App imported successfully');

    // Database connection string
    const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/project-management';
    console.log(`Connecting to database: ${DB_URI}`);

    // Connect to MongoDB
    mongoose
        .connect(DB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        })
        .then(() => console.log('Connected to MongoDB'))
        .catch((err) => {
            console.error('MongoDB connection error:', err);
            process.exit(1);
        });

    // Start server
    const port = process.env.PORT || 5000;
    console.log(`Starting server on port ${port}...`);
    const server = app.listen(port, () => {
        console.log(`Server running on port ${port}`);
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
} catch (error) {
    console.error('Error starting server:', error);
}
