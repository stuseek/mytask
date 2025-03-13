// src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

// Create a rate limiter for standard API endpoints - increased for higher concurrency
exports.standardLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Increased from 100 to 500 for more concurrent users
    message: {
        success: false,
        message: 'Too many requests, please try again later.'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Customize which client attributes are used for rate limiting
    keyGenerator: (req) => {
        // Use X-Forwarded-For header if available (important for apps behind load balancers)
        // Otherwise fall back to IP
        return req.headers['x-forwarded-for'] || req.ip;
    },
    // Don't rate limit internal or health check requests
    skip: (req) => {
        return req.path === '/health' || 
               req.ip === '127.0.0.1' || 
               req.ip === '::1';
    }
});

// Create a stricter rate limiter for sensitive operations
exports.sensitiveOperationsLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 60, // Increased from 30 to 60
    message: {
        success: false,
        message: 'Too many sensitive operations attempted. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Special limiter for AI operations to prevent OpenAI rate limit issues
exports.aiOperationsLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute per user for AI operations
    message: {
        success: false,
        message: 'You have exceeded the AI operations rate limit. Please try again shortly.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
