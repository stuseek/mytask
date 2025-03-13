const mongoose = require('mongoose');
const { Schema } = mongoose;

const taskSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String },
  status: {
    type: String,
    default: 'ToDo',
    enum: ['ToDo', 'Doing', 'Testing', 'Done']
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

module.exports = mongoose.model('Task', taskSchema);
