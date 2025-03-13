const mongoose = require('mongoose');
const { Schema } = mongoose;

const teamSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  settings: {
    roles: { type: [String], default: ['Developer', 'Manager', 'QA', 'Client', 'Superadmin'] },
    permissions: { type: Schema.Types.Mixed }
  }
});

module.exports = mongoose.model('Team', teamSchema);
