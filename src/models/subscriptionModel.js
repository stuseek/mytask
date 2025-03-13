const mongoose = require('mongoose');
const { Schema } = mongoose;

const subscriptionSchema = new Schema({
  name: { type: String, required: true },
  billingCycle: { type: String, enum: ['Monthly', 'Yearly'], required: true },
  features: [{ type: String }],
  userLimit: { type: Number, default: 10 },
  projectLimit: { type: Number, default: 5 },
  status: {
    type: String,
    enum: ['Active', 'Expired', 'Canceled'],
    default: 'Active'
  }
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
