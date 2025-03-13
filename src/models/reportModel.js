const mongoose = require('mongoose');
const { Schema } = mongoose;

const ganttDataSchema = new Schema({
  taskId: { type: Schema.Types.ObjectId, ref: 'Task' },
  title: { type: String },
  startDate: { type: Date },
  endDate: { type: Date }
});

const reportSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  type: {
    type: String,
    enum: ['Daily', 'Weekly', 'Sprint', 'Overall'],
    required: true
  },
  createdAt: { type: Date, default: Date.now },
  aiSummary: { type: String },
  tasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
  ganttData: [ganttDataSchema]
});

module.exports = mongoose.model('Report', reportSchema);
