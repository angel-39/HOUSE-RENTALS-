const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Property title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Property description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Owner is required']
  },
  address: {
    street: {
      type: String,
      required: [true, 'Street address is required'],
      trim: true
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true
    },
    zipCode: {
      type: String,
      required: [true, 'Zip code is required'],
      trim: true
    },
    country: {
      type: String,
      default: 'USA'
    }
  },
  propertyType: {
    type: String,
    enum: ['apartment', 'house', 'condo', 'townhouse', 'studio', 'other'],
    required: [true, 'Property type is required']
  },
  bedrooms: {
    type: Number,
    required: [true, 'Number of bedrooms is required'],
    min: [0, 'Bedrooms cannot be negative']
  },
  bathrooms: {
    type: Number,
    required: [true, 'Number of bathrooms is required'],
    min: [0.5, 'Bathrooms must be at least 0.5']
  },
  squareFootage: {
    type: Number,
    min: [1, 'Square footage must be positive']
  },
  rentPrice: {
    type: Number,
    required: [true, 'Rent price is required'],
    min: [0, 'Rent price cannot be negative']
  },
  securityDeposit: {
    type: Number,
    required: [true, 'Security deposit is required'],
    min: [0, 'Security deposit cannot be negative']
  },
  amenities: [{
    type: String,
    trim: true
  }],
  images: [{
    url: String,
    caption: String,
    isPrimary: { type: Boolean, default: false }
  }],
  availability: {
    isAvailable: {
      type: Boolean,
      default: true
    },
    availableFrom: {
      type: Date,
      default: Date.now
    },
    leaseTerm: {
      type: String,
      enum: ['month-to-month', '6-months', '1-year', '2-years'],
      default: '1-year'
    }
  },
  utilities: {
    included: [{
      type: String,
      enum: ['electricity', 'gas', 'water', 'internet', 'cable', 'trash', 'parking']
    }],
    cost: {
      type: Number,
      default: 0
    }
  },
  policies: {
    petsAllowed: { type: Boolean, default: false },
    smokingAllowed: { type: Boolean, default: false },
    petDeposit: { type: Number, default: 0 }
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  viewCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for geospatial queries
propertySchema.index({ location: '2dsphere' });
propertySchema.index({ owner: 1 });
propertySchema.index({ 'availability.isAvailable': 1 });
propertySchema.index({ rentPrice: 1 });
propertySchema.index({ propertyType: 1 });

// Virtual for full address
propertySchema.virtual('fullAddress').get(function() {
  const { street, city, state, zipCode } = this.address;
  return `${street}, ${city}, ${state} ${zipCode}`;
});

// Method to increment view count
propertySchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  return this.save();
};

module.exports = mongoose.model('Property', propertySchema);