const mongoose = require('mongoose');
const { Schema } = mongoose;

const auditLogSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  action: { type: String },
  entity: { type: String }, // e.g., 'User', 'Project', 'Task'
  entityId: { type: Schema.Types.ObjectId },
  changes: { type: Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now },
  ipAddress: { type: String }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
