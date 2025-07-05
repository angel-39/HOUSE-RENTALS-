const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'No token provided, authorization denied' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token is not valid' 
      });
    }

    req.user = user;
    next();
    
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Server error during authentication' 
    });
  }
};

// Middleware to check if user is an owner
const ownerMiddleware = (req, res, next) => {
  if (req.user.role !== 'owner') {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. Owner role required.' 
    });
  }
  next();
};

// Middleware to check if user is a renter
const renterMiddleware = (req, res, next) => {
  if (req.user.role !== 'renter') {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. Renter role required.' 
    });
  }
  next();
};

module.exports = {
  authMiddleware,
  ownerMiddleware,
  renterMiddleware
};