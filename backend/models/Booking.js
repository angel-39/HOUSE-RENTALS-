const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: [true, 'Property is required']
  },
  renter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Renter is required']
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Owner is required']
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  monthlyRent: {
    type: Number,
    required: [true, 'Monthly rent is required'],
    min: [0, 'Monthly rent cannot be negative']
  },
  securityDeposit: {
    type: Number,
    required: [true, 'Security deposit is required'],
    min: [0, 'Security deposit cannot be negative']
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'active', 'completed', 'cancelled'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'overdue'],
    default: 'pending'
  },
  moveInDate: {
    type: Date
  },
  moveOutDate: {
    type: Date
  },
  specialRequests: {
    type: String,
    trim: true,
    maxlength: [500, 'Special requests cannot exceed 500 characters']
  },
  documents: [{
    name: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  paymentHistory: [{
    amount: Number,
    paymentDate: { type: Date, default: Date.now },
    paymentMethod: {
      type: String,
      enum: ['credit_card', 'bank_transfer', 'check', 'cash']
    },
    description: String,
    transactionId: String
  }],
  communication: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: String,
    timestamp: { type: Date, default: Date.now },
    isRead: { type: Boolean, default: false }
  }],
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancellationReason: {
    type: String,
    trim: true
  },
  cancellationDate: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for better query performance
bookingSchema.index({ property: 1 });
bookingSchema.index({ renter: 1 });
bookingSchema.index({ owner: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ startDate: 1, endDate: 1 });

// Pre-save middleware to calculate total amount
bookingSchema.pre('save', function(next) {
  if (this.isModified('monthlyRent') || this.isModified('securityDeposit') || this.isModified('startDate') || this.isModified('endDate')) {
    const months = Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24 * 30));
    this.totalAmount = (this.monthlyRent * months) + this.securityDeposit;
  }
  next();
});

// Virtual for booking duration in months
bookingSchema.virtual('durationInMonths').get(function() {
  return Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24 * 30));
});

// Method to add payment
bookingSchema.methods.addPayment = function(paymentData) {
  this.paymentHistory.push(paymentData);
  
  // Update payment status
  const totalPaid = this.paymentHistory.reduce((sum, payment) => sum + payment.amount, 0);
  if (totalPaid >= this.totalAmount) {
    this.paymentStatus = 'paid';
  } else if (totalPaid > 0) {
    this.paymentStatus = 'partial';
  }
  
  return this.save();
};

// Method to add communication
bookingSchema.methods.addMessage = function(senderId, message) {
  this.communication.push({
    sender: senderId,
    message: message
  });
  return this.save();
};

module.exports = mongoose.model('Booking', bookingSchema);