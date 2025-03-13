const mongoose = require('mongoose');
const { Schema } = mongoose;

const AISummarySchema = new Schema({
  timestamp: { type: Date, default: Date.now },
  content: { type: String }
});

const LayoutViewSchema = new Schema({
  layoutId: { type: Schema.Types.ObjectId },
  sections: [
    {
      name: String,
      visible: Boolean,
      position: Number
    }
  ]
});

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  teams: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
  ownedTeams: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
  assignedProjects: [{ type: Schema.Types.ObjectId, ref: 'Project' }],
  ownedProjects: [{ type: Schema.Types.ObjectId, ref: 'Project' }],
  currentTask: { type: Schema.Types.ObjectId, ref: 'Task' },
  assignedTasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
  recentlyCompletedTasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
  projectRoles: {
    // projectId -> role
    type: Map,
    of: {
      type: String,
      enum: ['Developer', 'Manager', 'QA', 'Client', 'Superadmin']
    },
    default: {}
  },
  summaries: {
    // projectId -> [AISummarySchema]
    type: Map,
    of: [AISummarySchema]
  },
  projectViews: {
    // projectId -> LayoutViewSchema
    type: Map,
    of: LayoutViewSchema
  },
  mfaEnabled: { type: Boolean, default: false },
  mfaSecret: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
