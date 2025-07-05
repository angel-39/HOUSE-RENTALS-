const express = require('express');
const Booking = require('../models/Booking');
const Property = require('../models/Property');
const { authMiddleware, ownerMiddleware, renterMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// @route   POST /api/bookings
// @desc    Create new booking
// @access  Private (Renter only)
router.post('/', authMiddleware, renterMiddleware, async (req, res) => {
  try {
    const { propertyId, startDate, endDate, specialRequests } = req.body;

    // Find the property
    const property = await Property.findById(propertyId).populate('owner');
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check if property is available
    if (!property.availability.isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Property is not available for booking'
      });
    }

    // Check for conflicting bookings
    const conflictingBooking = await Booking.findOne({
      property: propertyId,
      status: { $in: ['approved', 'active'] },
      $or: [
        { startDate: { $lte: new Date(endDate) }, endDate: { $gte: new Date(startDate) } }
      ]
    });

    if (conflictingBooking) {
      return res.status(400).json({
        success: false,
        message: 'Property is already booked for the selected dates'
      });
    }

    // Create booking
    const booking = new Booking({
      property: propertyId,
      renter: req.user._id,
      owner: property.owner._id,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      monthlyRent: property.rentPrice,
      securityDeposit: property.securityDeposit,
      specialRequests
    });

    await booking.save();
    
    await booking.populate([
      { path: 'property', select: 'title address rentPrice' },
      { path: 'renter', select: 'name email phone' },
      { path: 'owner', select: 'name email phone' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Booking request submitted successfully',
      booking
    });

  } catch (error) {
    console.error('Booking creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating booking'
    });
  }
});

// @route   GET /api/bookings
// @desc    Get user's bookings (different data based on role)
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    let filter = {};

    // Filter based on user role
    if (req.user.role === 'renter') {
      filter.renter = req.user._id;
    } else if (req.user.role === 'owner') {
      filter.owner = req.user._id;
    }

    // Add status filter if provided
    if (status) {
      filter.status = status;
    }

    const bookings = await Booking.find(filter)
      .populate('property', 'title address rentPrice images')
      .populate('renter', 'name email phone')
      .populate('owner', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Booking.countDocuments(filter);

    res.json({
      success: true,
      bookings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalBookings: total
      }
    });

  } catch (error) {
    console.error('Bookings fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching bookings'
    });
  }
});

// @route   GET /api/bookings/:id
// @desc    Get single booking by ID
// @access  Private
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('property')
      .populate('renter', 'name email phone address')
      .populate('owner', 'name email phone address')
      .populate('communication.sender', 'name');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check authorization
    const isAuthorized = booking.renter._id.toString() === req.user._id.toString() ||
                        booking.owner._id.toString() === req.user._id.toString();

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this booking'
      });
    }

    res.json({
      success: true,
      booking
    });

  } catch (error) {
    console.error('Booking fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching booking'
    });
  }
});

// @route   PUT /api/bookings/:id/status
// @desc    Update booking status (owner only)
// @access  Private (Owner only)
router.put('/:id/status', authMiddleware, ownerMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user is the owner of the property
    if (booking.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this booking'
      });
    }

    booking.status = status;
    
    // If approved, set property as unavailable
    if (status === 'approved') {
      await Property.findByIdAndUpdate(booking.property, {
        'availability.isAvailable': false
      });
    }

    await booking.save();
    
    await booking.populate([
      { path: 'property', select: 'title address' },
      { path: 'renter', select: 'name email' }
    ]);

    res.json({
      success: true,
      message: `Booking ${status} successfully`,
      booking
    });

  } catch (error) {
    console.error('Booking status update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating booking status'
    });
  }
});

// @route   POST /api/bookings/:id/payment
// @desc    Add payment to booking
// @access  Private
router.post('/:id/payment', authMiddleware, async (req, res) => {
  try {
    const { amount, paymentMethod, description, transactionId } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check authorization
    const isAuthorized = booking.renter.toString() === req.user._id.toString() ||
                        booking.owner.toString() === req.user._id.toString();

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to add payment for this booking'
      });
    }

    await booking.addPayment({
      amount: Number(amount),
      paymentMethod,
      description,
      transactionId
    });

    res.json({
      success: true,
      message: 'Payment added successfully',
      booking
    });

  } catch (error) {
    console.error('Payment addition error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error adding payment'
    });
  }
});

// @route   POST /api/bookings/:id/message
// @desc    Add message to booking
// @access  Private
router.post('/:id/message', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check authorization
    const isAuthorized = booking.renter.toString() === req.user._id.toString() ||
                        booking.owner.toString() === req.user._id.toString();

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to message for this booking'
      });
    }

    await booking.addMessage(req.user._id, message);

    res.json({
      success: true,
      message: 'Message sent successfully'
    });

  } catch (error) {
    console.error('Message addition error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error sending message'
    });
  }
});

module.exports = router;