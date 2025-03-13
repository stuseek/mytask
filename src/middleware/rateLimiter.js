// src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

// Create a rate limiter for standard API endpoints
exports.standardLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        success: false,
        message: 'Too many requests, please try again later.'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Create a stricter rate limiter for sensitive operations
exports.sensitiveOperationsLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 30, // Limit each IP to 30 requests per windowMs
    message: {
        success: false,
        message: 'Too many sensitive operations attempted. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
