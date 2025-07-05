const express = require('express');
const Property = require('../models/Property');
const { authMiddleware, ownerMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// @route   GET /api/properties
// @desc    Get all properties with filtering and pagination
// @access  Public
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      propertyType,
      minPrice,
      maxPrice,
      bedrooms,
      bathrooms,
      city,
      state,
      isAvailable = true
    } = req.query;

    // Build filter object
    const filter = { isActive: true };
    
    if (isAvailable === 'true') {
      filter['availability.isAvailable'] = true;
    }
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } },
        { 'address.state': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (propertyType) filter.propertyType = propertyType;
    if (minPrice) filter.rentPrice = { ...filter.rentPrice, $gte: Number(minPrice) };
    if (maxPrice) filter.rentPrice = { ...filter.rentPrice, $lte: Number(maxPrice) };
    if (bedrooms) filter.bedrooms = Number(bedrooms);
    if (bathrooms) filter.bathrooms = { $gte: Number(bathrooms) };
    if (city) filter['address.city'] = { $regex: city, $options: 'i' };
    if (state) filter['address.state'] = { $regex: state, $options: 'i' };

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      populate: {
        path: 'owner',
        select: 'name email phone'
      },
      sort: { createdAt: -1 }
    };

    const properties = await Property.find(filter)
      .populate(options.populate)
      .sort(options.sort)
      .limit(options.limit * 1)
      .skip((options.page - 1) * options.limit);

    const total = await Property.countDocuments(filter);

    res.json({
      success: true,
      properties,
      pagination: {
        currentPage: options.page,
        totalPages: Math.ceil(total / options.limit),
        totalProperties: total,
        hasNextPage: options.page < Math.ceil(total / options.limit),
        hasPrevPage: options.page > 1
      }
    });

  } catch (error) {
    console.error('Properties fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching properties'
    });
  }
});

// @route   GET /api/properties/:id
// @desc    Get single property by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const property = await Property.findById(req.params.id)
      .populate('owner', 'name email phone');

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Increment view count
    await property.incrementViewCount();

    res.json({
      success: true,
      property
    });

  } catch (error) {
    console.error('Property fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching property'
    });
  }
});

// @route   POST /api/properties
// @desc    Create new property
// @access  Private (Owner only)
router.post('/', authMiddleware, ownerMiddleware, async (req, res) => {
  try {
    const propertyData = {
      ...req.body,
      owner: req.user._id
    };

    const property = new Property(propertyData);
    await property.save();

    await property.populate('owner', 'name email phone');

    res.status(201).json({
      success: true,
      message: 'Property created successfully',
      property
    });

  } catch (error) {
    console.error('Property creation error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error creating property'
    });
  }
});

// @route   PUT /api/properties/:id
// @desc    Update property
// @access  Private (Owner only - own properties)
router.put('/:id', authMiddleware, ownerMiddleware, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check if user owns this property
    if (property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this property'
      });
    }

    Object.assign(property, req.body);
    await property.save();

    await property.populate('owner', 'name email phone');

    res.json({
      success: true,
      message: 'Property updated successfully',
      property
    });

  } catch (error) {
    console.error('Property update error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error updating property'
    });
  }
});

// @route   DELETE /api/properties/:id
// @desc    Delete property
// @access  Private (Owner only - own properties)
router.delete('/:id', authMiddleware, ownerMiddleware, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check if user owns this property
    if (property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this property'
      });
    }

    await Property.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Property deleted successfully'
    });

  } catch (error) {
    console.error('Property deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting property'
    });
  }
});

// @route   GET /api/properties/owner/my-properties
// @desc    Get owner's properties
// @access  Private (Owner only)
router.get('/owner/my-properties', authMiddleware, ownerMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const properties = await Property.find({ owner: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Property.countDocuments({ owner: req.user._id });

    res.json({
      success: true,
      properties,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalProperties: total
      }
    });

  } catch (error) {
    console.error('Owner properties fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching your properties'
    });
  }
});

module.exports = router;