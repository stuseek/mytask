// src/middleware/errorHandler.js
const { logError } = require('../utils/logger');

/**
 * Custom error class with status code
 */
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Handle MongoDB cast errors (e.g., invalid ObjectId)
 */
const handleCastError = (err) => {
    const message = `Invalid ${err.path}: ${err.value}`;
    return new AppError(message, 400);
};

/**
 * Handle MongoDB duplicate key errors
 */
const handleDuplicateFieldsError = (err) => {
    const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
    const message = `Duplicate field value: ${value}. Please use another value.`;
    return new AppError(message, 400);
};

/**
 * Handle Mongoose validation errors
 */
const handleValidationError = (err) => {
    const errors = Object.values(err.errors).map(val => val.message);
    const message = `Invalid input data. ${errors.join('. ')}`;
    return new AppError(message, 400);
};

/**
 * Handle JWT errors
 */
const handleJWTError = () => {
    return new AppError('Invalid token. Please log in again.', 401);
};

/**
 * Handle JWT expiration
 */
const handleJWTExpiredError = () => {
    return new AppError('Your token has expired. Please log in again.', 401);
};

/**
 * Development error response (detailed)
 */
const sendErrorDev = (err, res) => {
    res.status(err.statusCode).json({
        success: false,
        message: err.message,
        error: err,
        stack: err.stack
    });
};

/**
 * Production error response (sanitized)
 */
const sendErrorProd = (err, res) => {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
        res.status(err.statusCode).json({
            success: false,
            message: err.message
        });
    } 
    // Programming or other unknown error: don't leak error details
    else {
        // Log error for internal use
        logError('ERROR', err);
        
        // Send generic message
        res.status(500).json({
            success: false,
            message: 'Something went wrong'
        });
    }
};

/**
 * Global error handling middleware
 */
module.exports = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    
    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(err, res);
    } else {
        let error = { ...err };
        error.message = err.message;
        
        // Handle specific error types
        if (error.name === 'CastError') error = handleCastError(error);
        if (error.code === 11000) error = handleDuplicateFieldsError(error);
        if (error.name === 'ValidationError') error = handleValidationError(error);
        if (error.name === 'JsonWebTokenError') error = handleJWTError();
        if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
        
        sendErrorProd(error, res);
    }
};

// Export the AppError class for use in controllers
module.exports.AppError = AppError;
