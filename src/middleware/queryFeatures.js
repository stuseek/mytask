// src/middleware/queryFeatures.js
/**
 * API Features class for advanced query operations
 * Handles filtering, sorting, field selection, and pagination
 */
class APIFeatures {
    /**
     * Constructor for APIFeatures
     * @param {Object} query - Mongoose query object
     * @param {Object} queryString - Express request query object
     */
    constructor(query, queryString) {
        this.query = query;
        this.queryString = queryString;
    }
    
    /**
     * Filter results based on query parameters
     * Handles special MongoDB operators ($gt, $gte, $lt, $lte, $in)
     * @returns {APIFeatures} - Returns this for method chaining
     */
    filter() {
        const queryObj = { ...this.queryString };
        
        // Exclude special fields that aren't for filtering
        const excludedFields = ['page', 'sort', 'limit', 'fields', 'search'];
        excludedFields.forEach(field => delete queryObj[field]);
        
        // Handle special MongoDB operators
        let queryStr = JSON.stringify(queryObj);
        queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);
        
        this.query = this.query.find(JSON.parse(queryStr));
        
        return this;
    }
    
    /**
     * Sort results based on sort parameter
     * @returns {APIFeatures} - Returns this for method chaining
     */
    sort() {
        if (this.queryString.sort) {
            // Handle sort=field1,field2 format
            const sortBy = this.queryString.sort.split(',').join(' ');
            this.query = this.query.sort(sortBy);
        } else {
            // Default sort by creation date (newest first)
            this.query = this.query.sort('-createdAt');
        }
        
        return this;
    }
    
    /**
     * Limit fields returned in response
     * @returns {APIFeatures} - Returns this for method chaining
     */
    limitFields() {
        if (this.queryString.fields) {
            const fields = this.queryString.fields.split(',').join(' ');
            this.query = this.query.select(fields);
        } else {
            // Exclude MongoDB internal __v field by default
            this.query = this.query.select('-__v');
        }
        
        return this;
    }
    
    /**
     * Implement pagination
     * @returns {APIFeatures} - Returns this for method chaining
     */
    paginate() {
        // Set defaults or use provided values
        const page = parseInt(this.queryString.page, 10) || 1;
        const limit = parseInt(this.queryString.limit, 10) || 100;
        const skip = (page - 1) * limit;
        
        this.query = this.query.skip(skip).limit(limit);
        
        return this;
    }
    
    /**
     * Implement basic search functionality
     * @param {Array<String>} fields - Fields to search in
     * @returns {APIFeatures} - Returns this for method chaining
     */
    search(fields) {
        if (this.queryString.search) {
            const searchQuery = {
                $or: fields.map(field => ({
                    [field]: { $regex: this.queryString.search, $options: 'i' }
                }))
            };
            
            this.query = this.query.find(searchQuery);
        }
        
        return this;
    }
}

module.exports = APIFeatures;
