const mongoose = require('mongoose');
const { Schema } = mongoose;

const projectSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  teamIds: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
  ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
  currentSprint: { type: Schema.Types.ObjectId, ref: 'Sprint' },
  settings: {
    statuses: { type: [String], default: ['ToDo', 'Doing', 'Testing', 'Done'] },
    priorities: { type: [String], default: ['High', 'Medium', 'Low'] },
    roles: { type: [String], default: ['Developer', 'Manager', 'QA', 'Client', 'Superadmin'] }
  }
});

module.exports = mongoose.model('Project', projectSchema);
