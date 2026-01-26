// backend/routes/twoFactorRoutes.js
import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
    setup2FA,
    enable2FA,
    disable2FA,
    generateBackupCodes,
    get2FAStatus,
} from '../controllers/twoFactorController.js';

const router = express.Router();

// All 2FA routes require authentication
router.use(protect);

// Get 2FA status
router.get('/status', get2FAStatus);

// Setup 2FA (generate QR code)
router.post('/setup', setup2FA);

// Enable 2FA (verify token and activate)
router.post('/enable', enable2FA);

// Disable 2FA
router.post('/disable', disable2FA);

// Generate new backup codes
router.post('/backup-codes', generateBackupCodes);

export default router;
