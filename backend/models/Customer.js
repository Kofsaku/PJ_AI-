const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  customer: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  duration: {
    type: String,
    required: true
  },
  result: {
    type: String,
    required: true
  },
  notes: {
    type: String,
    required: false
  },
  address: {
    type: String,
    required: false
  },
  phone: {
    type: String,
    required: false
  },
  email: {
    type: String,
    required: false
  },
  company: {
    type: String,
    required: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Customer', customerSchema);