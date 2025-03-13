// src/models/sprintModel.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const sprintSchema = new Schema({
  name: { 
    type: String, 
    required: [true, 'Sprint name is required'],
    trim: true,
    minlength: [3, 'Sprint name must be at least 3 characters'],
    maxlength: [100, 'Sprint name cannot exceed 100 characters']
  },
  description: { 
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  projectId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Project', 
    required: [true, 'Project ID is required'],
    index: true // Add index for faster queries
  },
  startDate: { 
    type: Date,
    validate: {
      validator: function(value) {
        // Only validate if both dates are set
        return !this.endDate || value <= this.endDate;
      },
      message: 'Start date must be before or equal to end date'
    }
  },
  endDate: { 
    type: Date,
    validate: {
      validator: function(value) {
        // Only validate if both dates are set
        return !this.startDate || value >= this.startDate;
      },
      message: 'End date must be after or equal to start date'
    }
  },
  taskIds: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'Task'
  }],
  progressPercentage: { 
    type: Number, 
    default: 0,
    min: [0, 'Progress percentage cannot be negative'],
    max: [100, 'Progress percentage cannot exceed 100']
  },
  status: {
    type: String,
    enum: ['Planning', 'Active', 'Completed', 'Cancelled'],
    default: 'Planning'
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt fields
  toJSON: { virtuals: true }, // Enable virtuals when converting to JSON
  toObject: { virtuals: true } // Enable virtuals when converting to Object
});

// Virtual for sprint duration in days
sprintSchema.virtual('durationDays').get(function() {
  if (!this.startDate || !this.endDate) return null;
  
  const start = new Date(this.startDate);
  const end = new Date(this.endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
});

// Virtual for remaining days
sprintSchema.virtual('remainingDays').get(function() {
  if (!this.endDate) return null;
  
  const today = new Date();
  const end = new Date(this.endDate);
  
  if (today > end) return 0;
  
  const diffTime = Math.abs(end - today);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
});

// Virtual for tasks count
sprintSchema.virtual('tasksCount').get(function() {
  return this.taskIds ? this.taskIds.length : 0;
});

// Pre-save middleware to update status based on dates
sprintSchema.pre('save', function(next) {
  const now = new Date();
  
  if (this.startDate && this.endDate) {
    if (now < new Date(this.startDate)) {
      this.status = 'Planning';
    } else if (now >= new Date(this.startDate) && now <= new Date(this.endDate)) {
      this.status = 'Active';
    } else if (now > new Date(this.endDate)) {
      this.status = 'Completed';
    }
  }
  
  next();
});

// Index for more efficient querying
sprintSchema.index({ projectId: 1, startDate: -1 });
sprintSchema.index({ status: 1 });

// Static method to find active sprints
sprintSchema.statics.findActive = function() {
  const now = new Date();
  return this.find({
    startDate: { $lte: now },
    endDate: { $gte: now }
  });
};

// Static method to find upcoming sprints
sprintSchema.statics.findUpcoming = function() {
  const now = new Date();
  return this.find({
    startDate: { $gt: now }
  }).sort({ startDate: 1 });
};

module.exports = mongoose.model('Sprint', sprintSchema);