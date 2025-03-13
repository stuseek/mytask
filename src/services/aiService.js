// src/services/aiService.js
const { Configuration, OpenAIApi } = require('openai');
const User = require('../models/userModel');
const Project = require('../models/projectModel');
const Task = require('../models/taskModel');
const Sprint = require('../models/sprintModel');
const NodeCache = require('node-cache');

// OpenAI rate limiting helpers
const RATE_LIMIT_WINDOW = 60000; // 1 minute window
const MAX_REQUESTS_PER_MINUTE = 40; // Adjust based on your OpenAI plan
let requestsInCurrentWindow = 0;
let windowStartTime = Date.now();

// More aggressive caching
const summaryCache = new NodeCache({ 
  stdTTL: 3600 * 4,  // 4 hours cache (increased from 1 hour)
  checkperiod: 600   // Check for expired keys every 10 minutes
});

// Initialize OpenAI configuration
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

// Queue for pending AI requests
const pendingRequests = [];
let isProcessingQueue = false;

/**
 * Reset rate limit counter when the window expires
 */
function checkAndResetRateLimit() {
  const now = Date.now();
  if (now - windowStartTime > RATE_LIMIT_WINDOW) {
    requestsInCurrentWindow = 0;
    windowStartTime = now;
  }
}

/**
 * Process the queue of pending AI requests
 */
async function processRequestQueue() {
  if (isProcessingQueue || pendingRequests.length === 0) return;
  
  isProcessingQueue = true;
  
  try {
    checkAndResetRateLimit();
    
    while (pendingRequests.length > 0 && requestsInCurrentWindow < MAX_REQUESTS_PER_MINUTE) {
      const request = pendingRequests.shift();
      requestsInCurrentWindow++;
      
      try {
        const result = await request.execute();
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      }
    }
  } finally {
    isProcessingQueue = false;
    
    // If there are more requests and we haven't hit the limit, continue processing
    if (pendingRequests.length > 0 && requestsInCurrentWindow < MAX_REQUESTS_PER_MINUTE) {
      processRequestQueue();
    } 
    // If we've hit the rate limit, schedule the next batch
    else if (pendingRequests.length > 0) {
      setTimeout(processRequestQueue, RATE_LIMIT_WINDOW - (Date.now() - windowStartTime) + 100);
    }
  }
}

/**
 * Queue an AI request respecting rate limits
 * @param {Function} executeFn - Function that executes the OpenAI call
 * @returns {Promise} - Promise that resolves with the result
 */
function queueAIRequest(executeFn) {
  return new Promise((resolve, reject) => {
    pendingRequests.push({
      execute: executeFn,
      resolve,
      reject
    });
    
    processRequestQueue();
  });
}

/**
 * Generate a simple text summary
 * @param {String} text - The text to summarize
 * @returns {Promise<String>} The generated summary
 */
exports.generateTextSummary = async (text) => {
  // First check cache
  const cacheKey = `text_summary_${Buffer.from(text.substring(0, 100)).toString('base64')}`;
  const cachedSummary = summaryCache.get(cacheKey);
  
  if (cachedSummary) {
    return cachedSummary;
  }
  
  try {
    const summary = await queueAIRequest(async () => {
      const response = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an assistant that summarizes project updates.'
          },
          {
            role: 'user',
            content: `Summarize this project update: ${text}`
          }
        ]
      });
      return response.data.choices[0].message.content.trim();
    });
    
    summaryCache.set(cacheKey, summary);
    return summary;
  } catch (error) {
    console.error('OpenAI error:', error);
    return 'Unable to generate summary at this time.';
  }
};

/**
 * Generate role-specific project summaries for a user
 * @param {String} userId - The user ID to generate summaries for
 * @param {String} projectId - Optional project ID to limit scope
 * @returns {Promise<Object>} The generated summaries grouped by project
 */
exports.generateUserSummaries = async (userId, projectId = null) => {
  try {
    // Get user data including role and assigned projects
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Determine which projects to summarize
    let projectsToSummarize = [];
    
    if (projectId) {
      // Single project mode
      const project = await Project.findById(projectId);
      if (!project) {
        throw new Error('Project not found');
      }
      projectsToSummarize = [project];
    } else {
      // All user's projects - limit to 3 most recent for performance
      const projectIds = [
        ...user.assignedProjects,
        ...user.ownedProjects
      ];
      
      // Get at most 3 projects to prevent excessive API usage
      projectsToSummarize = await Project.find({ 
        _id: { $in: projectIds } 
      }).sort({ updatedAt: -1 }).limit(3);
    }

    // Get role-specific summaries for each project
    const summaries = {};
    
    for (const project of projectsToSummarize) {
      // Get user's role for this project
      const userRole = user.projectRoles.get(project._id.toString()) || 'Developer';
      
      // Check cache first
      const cacheKey = `${userId}_${project._id}_${userRole}`;
      const cachedSummary = summaryCache.get(cacheKey);
      
      if (cachedSummary) {
        summaries[project._id] = cachedSummary;
        continue;
      }
      
      // Generate new summaries based on role
      const projectSummaries = await this.generateRoleBasedSummaries(
        userId, 
        project._id, 
        userRole
      );
      
      summaries[project._id] = projectSummaries;
      
      // Cache the result
      summaryCache.set(cacheKey, projectSummaries);
      
      // Save summaries to user model for persistence
      user.summaries.set(project._id.toString(), projectSummaries);
    }
    
    await user.save();
    
    return {
      id: user._id,
      name: user.name,
      role: user.projectRoles,
      summaries
    };
  } catch (error) {
    console.error('Summary generation error:', error);
    throw error;
  }
};

// Rest of the code remains the same...
