// backend/middleware/authMiddleware.js
import User from '../models/user.js';

// Middleware to protect routes using session-based authentication
export const protect = async (req, res, next) => {
  try {
    // 1. Check if session exists and has userId
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        message: 'Not authorized - No active session',
        sessionExpired: true
      });
    }

    // 2. Check if session has expired due to inactivity
    const now = Date.now();
    const lastActivity = req.session.lastActivity || now;
    const inactivityTimeout = 30 * 60 * 1000; // 30 minutes

    if (now - lastActivity > inactivityTimeout) {
      // Session expired due to inactivity
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying expired session:', err);
        }
      });

      return res.status(401).json({
        message: 'Session expired due to inactivity',
        sessionExpired: true
      });
    }

    // 3. Update last activity timestamp
    req.session.lastActivity = now;

    // 4. Get user from session and attach to request object
    req.user = await User.findById(req.session.userId).select('-password');

    // 5. Check if user still exists
    if (!req.user) {
      // User was deleted but session still exists
      req.session.destroy();
      return res.status(401).json({
        message: 'User not found',
        sessionExpired: true
      });
    }

    // 6. Proceed to next middleware or controller
    next();

  } catch (error) {
    console.error('Session authentication error:', error.message);
    return res.status(401).json({
      message: 'Authentication failed',
      sessionExpired: true
    });
  }
};

// Middleware to check for admin role
export const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next(); // User is an admin, proceed
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};