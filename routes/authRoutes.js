// backend/routes/authRoutes.js
import express from 'express';
import {
    signup,
    login,
    logout,
    refreshSession,
    verifyEmail,
    resendVerificationEmail,
    requestPasswordReset,
    verifyResetToken,
    resetPassword,
    unlockAccount,
} from '../controllers/authcontroller.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import {
    signupLimiter,
    loginLimiter,
    passwordResetLimiter,
    verifyCaptcha,
} from '../middleware/rateLimitMiddleware.js';
import { verifyTraditionalCaptcha } from '../middleware/traditionalCaptchaMiddleware.js';
import { validatePasswordSecurity } from '../middleware/passwordValidator.js';

const router = express.Router();

// ===== Public Routes =====

// Signup with rate limiting and password validation
router.post('/signup', signupLimiter, validatePasswordSecurity, signup);

// Login with rate limiting and CAPTCHA
router.post('/login', loginLimiter, verifyTraditionalCaptcha, login);

// Email verification
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);

// Password reset
router.post('/forgot-password', passwordResetLimiter, requestPasswordReset);
router.get('/verify-reset-token/:token', verifyResetToken);
router.post('/reset-password/:token', validatePasswordSecurity, resetPassword);

// Session management
router.post('/logout', logout);
router.post('/refresh-session', refreshSession);

// ===== Protected Routes (Admin only) =====

// Unlock user account
router.post('/unlock-account/:userId', protect, admin, unlockAccount);

export default router;