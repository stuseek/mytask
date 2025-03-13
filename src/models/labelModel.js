const mongoose = require('mongoose');
const { Schema } = mongoose;

const labelSchema = new Schema({
  name: { type: String, required: true },
  color: { type: String, default: '#000000' }
});

module.exports = mongoose.model('Label', labelSchema);
