const mongoose = require('mongoose');
const { Schema } = mongoose;

const taskSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String },
  status: {
    type: String,
    default: 'ToDo'
    // No enum constraint to allow custom statuses
  },
  priority: {
    type: String,
    default: 'Medium',
    enum: ['High', 'Medium', 'Low']
  },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  sprintId: { type: Schema.Types.ObjectId, ref: 'Sprint' },
  dueDate: { type: Date },
  labels: [{ type: Schema.Types.ObjectId, ref: 'Label' }],
  attachments: [{ type: Schema.Types.ObjectId, ref: 'Attachment' }],
  comments: [{ type: Schema.Types.ObjectId, ref: 'Comment' }],
  history: [{ type: Schema.Types.ObjectId, ref: 'TaskHistory' }],
  estimatedTime: { type: Number, default: 0 },
  loggedTime: { type: Number, default: 0 },
  startDate: { type: Date },
  endDate: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

// Middleware to validate task status against project settings
taskSchema.pre('save', async function(next) {
  if (this.isModified('status')) {
    try {
      const Project = mongoose.model('Project');
      const project = await Project.findById(this.projectId);
      
      if (!project) {
        return next(new Error('Project not found'));
      }
      
      // Check if status is valid for this project
      if (!project.settings.statuses.includes(this.status)) {
        return next(new Error(`Invalid status '${this.status}' for this project`));
      }
      
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

module.exports = mongoose.model('Task', taskSchema);
