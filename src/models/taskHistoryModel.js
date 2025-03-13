const mongoose = require('mongoose');
const { Schema } = mongoose;

const taskHistorySchema = new Schema({
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
  changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  change: { type: String },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TaskHistory', taskHistorySchema);
