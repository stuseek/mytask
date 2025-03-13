const mongoose = require('mongoose');
const { Schema } = mongoose;

const subscriptionSchema = new Schema({
  name: { type: String, required: true },
  billingCycle: { type: String, enum: ['Monthly', 'Yearly'], required: true },
  features: [{ 
    type: String,
    enum: [
      'custom-statuses',       // Allow custom task statuses
      'unlimited-projects',    // Remove project limit cap
      'unlimited-users',       // Remove user limit cap
      'priority-support',      // Priority customer support
      'api-access',            // API access for integrations
      'advanced-reports'       // Advanced reporting features
    ] 
  }],
  userLimit: { type: Number, default: 10 },
  projectLimit: { type: Number, default: 5 },
  price: { type: Number, required: true },
  teamId: { type: Schema.Types.ObjectId, ref: 'Team' },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  status: {
    type: String,
    enum: ['Active', 'Expired', 'Canceled'],
    default: 'Active'
  },
  paymentId: { type: String },  // Reference to payment processor ID
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
