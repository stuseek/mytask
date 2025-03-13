// src/services/cacheService.js
const NodeCache = require('node-cache');

// Standard TTL of 5 minutes, check period of 10 minutes
const cache = new NodeCache({ stdTTL: 300, checkperiod: 600 });

/**
 * Get data from cache or execute function to get fresh data
 * @param {String} key - Cache key
 * @param {Function} fetchFunction - Function to execute if cache miss
 * @param {Number} ttl - Time to live in seconds (optional)
 * @returns {Promise<any>} - Resolved data
 */
exports.getOrSet = async (key, fetchFunction, ttl = null) => {
    const cachedData = cache.get(key);
    
    if (cachedData !== undefined) {
        return cachedData;
    }
    
    try {
        const freshData = await fetchFunction();
        
        // Store in cache (with optional custom TTL)
        if (ttl) {
            cache.set(key, freshData, ttl);
        } else {
            cache.set(key, freshData);
        }
        
        return freshData;
    } catch (error) {
        console.error(`Cache fetch error for key ${key}:`, error);
        throw error;
    }
};

/**
 * Invalidate specific cache entries
 * @param {String} keyPattern - Key or pattern to match
 */
exports.invalidate = (keyPattern) => {
    if (keyPattern.includes('*')) {
        // If pattern contains wildcard, get all keys and filter
        const pattern = new RegExp(keyPattern.replace('*', '.*'));
        const keys = cache.keys().filter(key => pattern.test(key));
        keys.forEach(key => cache.del(key));
    } else {
        // Direct key deletion
        cache.del(keyPattern);
    }
};

/**
 * Clear the entire cache
 */
exports.clear = () => {
    cache.flushAll();
};
