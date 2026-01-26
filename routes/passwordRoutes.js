// backend/routes/passwordRoutes.js
import express from 'express';
import {
    checkPasswordStrength,
    changePassword,
    checkPasswordExpiry,
} from '../controllers/passwordController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validatePasswordSecurity, validateNewPasswordSecurity } from '../middleware/passwordValidator.js';

const router = express.Router();

// ===== Public Routes =====

// Check password strength (for real-time feedback on frontend)
router.post('/check-strength', checkPasswordStrength);

// ===== Protected Routes =====

// Change password (with validation)
router.post('/change', protect, validateNewPasswordSecurity, changePassword);

// Get password expiry status
router.get('/expiry-status', protect, checkPasswordExpiry);

export default router;
