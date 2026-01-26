// backend/routes/profileRoutes.js
import express from 'express';
import {
    getMyProfile,
    updateProfile,
    uploadProfilePicture,
    deleteProfilePicture,
    updatePrivacySettings,
    updatePreferences,
    getPublicProfile,
} from '../controllers/profileController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadProfilePicture as uploadPicture } from '../middleware/uploadMiddleware.js';
import {
    profileUpdateRules,
    privacySettingsRules,
    preferencesRules,
    validateRequest,
} from '../middleware/profileValidator.js';
import { sanitizeInputs } from '../middleware/inputSanitizer.js';

const router = express.Router();

// All routes require authentication except public profile view
router.use(protect);
router.use(sanitizeInputs()); // Apply input sanitization to all profile routes

// Get current user's profile
router.get('/me', getMyProfile);

// Update current user's profile
router.put('/me', profileUpdateRules, validateRequest, updateProfile);

// Upload profile picture
router.post('/picture', uploadPicture.single('profilePicture'), uploadProfilePicture);

// Delete profile picture
router.delete('/picture', deleteProfilePicture);

// Update privacy settings
router.put('/privacy', privacySettingsRules, validateRequest, updatePrivacySettings);

// Update preferences
router.put('/preferences', preferencesRules, validateRequest, updatePreferences);

// Get public profile of a user (no auth required for this one)
router.get('/:userId', getPublicProfile);

export default router;
