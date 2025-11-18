import mongoose from 'mongoose';

const propertySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Property name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: 0
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  state: {
    type: String,
    enum: ['sold', 'premium', 'sell', 'rent'],
    default: 'sell'
  },
  type: {
    type: String,
    enum: ['land', 'building', 'house', 'apartment', 'commercial', 'villa', 'penthouse', 'Land', 'Building', 'House', 'Apartment', 'Commercial', 'Villa', 'Penthouse', 'Condo', 'Townhouse', 'condo', 'townhouse'],
    required: [true, 'Property type is required']
  },
  squareFeet: {
    type: Number,
    required: [true, 'Square feet is required'],
    min: 0
  },
  bedrooms: {
    type: Number,
    default: 0,
    min: 0
  },
  bathrooms: {
    type: Number,
    default: 0,
    min: 0
  },
  images: [{
    type: String
  }],
  features: [{
    type: String
  }],
  // Admin tracking fields
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  publishedToFrontend: {
    type: Boolean,
    default: false
  },
  viewCount: {
    type: Number,
    default: 0
  },
  inquiryCount: {
    type: Number,
    default: 0
  },
  // Additional details
  yearBuilt: {
    type: Number
  },
  parkingSpaces: {
    type: Number,
    default: 0
  },
  amenities: [{
    type: String
  }],
  status: {
    type: String,
    enum: ['available', 'under_contract', 'sold', 'rented'],
    default: 'available'
  }
}, {
  timestamps: true
});

// Index for search optimization
propertySchema.index({ name: 'text', location: 'text', description: 'text' });
propertySchema.index({ type: 1, state: 1, status: 1 });
propertySchema.index({ price: 1 });

const Property = mongoose.model('Property', propertySchema);

export default Property;
