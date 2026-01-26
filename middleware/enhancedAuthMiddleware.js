// middleware/enhancedAuthMiddleware.js
import User from '../models/user.js';
import { checkPasswordExpiry } from './passwordExpiryMiddleware.js';

// Enhanced protect middleware with password expiry checking
export const protectWithPasswordExpiry = async (req, res, next) => {
  try {
    // First run the original protect middleware logic
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        message: 'Not authorized - No active session',
        sessionExpired: true
      });
    }

    // Check if session has expired due to inactivity
    const now = Date.now();
    const lastActivity = req.session.lastActivity || now;
    const inactivityTimeout = 30 * 60 * 1000; // 30 minutes

    if (now - lastActivity > inactivityTimeout) {
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

    // Update last activity timestamp
    req.session.lastActivity = now;

    // Get user from session and attach to request object
    req.user = await User.findById(req.session.userId).select('-password');

    if (!req.user) {
      req.session.destroy();
      return res.status(401).json({
        message: 'User not found',
        sessionExpired: true
      });
    }

    // Now check password expiry
    await checkPasswordExpiry(req, res, (err) => {
      if (err) {
        // If password expiry middleware returns an error, it means password is expired
        return; // The response is already sent by checkPasswordExpiry
      }
      next(); // Password is valid, proceed
    });

  } catch (error) {
    console.error('Enhanced authentication error:', error.message);
    return res.status(401).json({
      message: 'Authentication failed',
      sessionExpired: true
    });
  }
};

// Middleware to check password expiry separately (for specific routes)
export const checkPasswordExpiryOnly = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    await checkPasswordExpiry(req, res, next);
  } catch (error) {
    console.error('Password expiry check error:', error);
    next(); // Don't block the request if there's an error
  }
};
