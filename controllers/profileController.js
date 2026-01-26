// backend/controllers/profileController.js
import User from '../models/user.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizeName, sanitizePhone, sanitizeBio, sanitizeEmail } from '../middleware/inputSanitizer.js';
import { logCustomEvent } from '../middleware/auditLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @desc    Get current user's profile
// @route   GET /api/profile/me
// @access  Private
export const getMyProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password -passwordHistory -twoFactorSecret -backupCodes -emailVerificationToken -resetPasswordToken');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({
            profile: user,
        });
    } catch (error) {
        console.error('Get Profile Error:', error);
        res.status(500).json({ message: 'Error fetching profile' });
    }
};

// @desc    Update user profile
// @route   PUT /api/profile/me
// @access  Private
export const updateProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const {
            name,
            phone,
            address,
            bio,
            dateOfBirth,
            gender,
            socialLinks,
        } = req.body;

        console.log('🔍 [PROFILE UPDATE] Request received');
        console.log('🔍 [PROFILE UPDATE] User ID:', userId);
        console.log('🔍 [PROFILE UPDATE] Request body:', req.body);

        const user = await User.findById(userId);

        if (!user) {
            console.log('❌ [PROFILE UPDATE] User not found:', userId);
            return res.status(404).json({ message: 'User not found' });
        }

        // Update fields with validation
        if (name !== undefined) {
            if (name && name.trim().length < 2) {
                return res.status(400).json({ message: 'Name must be at least 2 characters long' });
            }
            user.name = sanitizeName(name);
        }

        if (phone !== undefined) {
            if (phone && !phone.match(/^[\+]?[0-9\s\-\(\)]{10,15}$/)) {
                return res.status(400).json({ message: 'Invalid phone number format' });
            }
            user.phone = sanitizePhone(phone);
        }

        if (address !== undefined) {
            // Handle address field - it can be an object or undefined
            if (typeof address === 'object' && address !== null) {
                user.address = address;
            } else if (address === null || address === '') {
                user.address = {
                    street: '',
                    city: '',
                    state: '',
                    zipCode: '',
                    country: '',
                };
            }
        }

        if (bio !== undefined) {
            user.bio = sanitizeBio(bio);
        }

        if (dateOfBirth !== undefined) {
            if (dateOfBirth) {
                const dob = new Date(dateOfBirth);
                if (isNaN(dob.getTime())) {
                    return res.status(400).json({ message: 'Invalid date of birth format' });
                }
                user.dateOfBirth = dob;
            }
        }

        if (gender !== undefined) {
            const validGenders = ['male', 'female', 'other', ''];
            if (!validGenders.includes(gender)) {
                return res.status(400).json({ message: 'Invalid gender value' });
            }
            user.gender = gender;
        }

        if (socialLinks !== undefined) {
            if (typeof socialLinks === 'object' && socialLinks !== null) {
                user.socialLinks = socialLinks;
            }
        }

        await user.save();

        console.log('✅ [PROFILE UPDATE] Profile updated successfully');
        res.status(200).json({
            message: 'Profile updated successfully',
            profile: {
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                address: user.address,
                bio: user.bio,
                dateOfBirth: user.dateOfBirth,
                gender: user.gender,
                profilePicture: user.profilePicture,
                socialLinks: user.socialLinks,
                privacySettings: user.privacySettings,
                preferences: user.preferences,
            },
        });
    } catch (error) {
        console.error('❌ [PROFILE UPDATE] Update Profile Error:', error);
        console.error('❌ [PROFILE UPDATE] Error name:', error.name);
        console.error('❌ [PROFILE UPDATE] Error message:', error.message);

        // If this is a validation error, return detailed error information
        if (error.name === 'ValidationError') {
            console.log('❌ [PROFILE UPDATE] Validation errors:', error.errors);
            const validationErrors = Object.keys(error.errors).map(key => ({
                field: key,
                message: error.errors[key].message,
                value: error.errors[key].value,
                kind: error.errors[key].kind
            }));
            console.log('❌ [PROFILE UPDATE] Formatted validation errors:', validationErrors);
            
            return res.status(400).json({
                message: 'Validation failed',
                errors: validationErrors
            });
        }

        // Handle other types of errors
        if (error.message.includes('AuditLog validation failed')) {
            console.log('❌ [PROFILE UPDATE] AuditLog validation issue - this might be a separate issue');
            return res.status(400).json({
                message: 'Profile update failed due to audit logging issue. Please try again.',
                errors: [{ field: 'audit', message: 'Audit logging failed' }]
            });
        }

        res.status(500).json({ 
            message: 'Error updating profile',
            error: error.message,
            name: error.name
        });
    }
};

// @desc    Upload profile picture
// @route   POST /api/profile/picture
// @access  Private
export const uploadProfilePicture = async (req, res) => {
    try {
        console.log('🔍 [PROFILE UPLOAD] Request received');
        console.log('🔍 [PROFILE UPLOAD] User:', req.user?.email);
        console.log('🔍 [PROFILE UPLOAD] File:', req.file);
        
        const userId = req.user._id;

        if (!req.file) {
            console.log('❌ [PROFILE UPLOAD] No file received');
            return res.status(400).json({ message: 'No file uploaded' });
        }

        console.log('🔍 [PROFILE UPLOAD] File details:', {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            filename: req.file.filename,
            path: req.file.path
        });

        const user = await User.findById(userId);

        if (!user) {
            console.log('❌ [PROFILE UPLOAD] User not found:', userId);
            return res.status(404).json({ message: 'User not found' });
        }

        // Delete old profile picture if exists
        if (user.profilePicture) {
            const oldImagePath = path.join(__dirname, '..', 'public', user.profilePicture.replace('/uploads/', '/uploads/'));
            console.log('🔍 [PROFILE UPLOAD] Checking old image path:', oldImagePath);
            if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath);
                console.log(`[PROFILE PICTURE] Deleted old image: ${oldImagePath}`);
            } else {
                console.log('🔍 [PROFILE UPLOAD] Old image not found:', oldImagePath);
            }
        }

        // Save new profile picture URL
        const imageUrl = `/uploads/profiles/${req.file.filename}`;
        user.profilePicture = imageUrl;
        await user.save();

        console.log(`[PROFILE PICTURE] User ${user.email} uploaded profile picture: ${imageUrl}`);
        console.log(`[PROFILE PICTURE] File saved at: ${req.file.path}`);
        console.log(`[PROFILE PICTURE] Full URL should be: http://localhost:5000${imageUrl}`);
        
        res.status(200).json({
            message: 'Profile picture uploaded successfully',
            profilePicture: imageUrl,
            filePath: req.file.path,
            fullUrl: `http://localhost:5000${imageUrl}`
        });
    } catch (error) {
        console.error('❌ [PROFILE UPLOAD] Upload Profile Picture Error:', error);
        res.status(500).json({ message: 'Error uploading profile picture', error: error.message });
    }
};

// @desc    Delete profile picture
// @route   DELETE /api/profile/picture
// @access  Private
export const deleteProfilePicture = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.profilePicture) {
            return res.status(400).json({ message: 'No profile picture to delete' });
        }

        // Delete image file
        const imagePath = path.join(__dirname, '..', 'public', user.profilePicture.replace('/uploads/', '/uploads/'));
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log(`[PROFILE PICTURE] Deleted image: ${imagePath}`);
        }

        // Remove from database
        user.profilePicture = null;
        await user.save();

        console.log(`[PROFILE PICTURE] User ${user.email} deleted profile picture`);
        res.status(200).json({ message: 'Profile picture deleted successfully' });
    } catch (error) {
        console.error('Delete Profile Picture Error:', error);
        res.status(500).json({ message: 'Error deleting profile picture' });
    }
};

// @desc    Update privacy settings
// @route   PUT /api/profile/privacy
// @access  Private
export const updatePrivacySettings = async (req, res) => {
    try {
        const userId = req.user._id;
        const { privacySettings } = req.body;

        if (!privacySettings) {
            return res.status(400).json({ message: 'Privacy settings are required' });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update privacy settings
        user.privacySettings = {
            showEmail: privacySettings.showEmail || user.privacySettings.showEmail,
            showPhone: privacySettings.showPhone || user.privacySettings.showPhone,
            showAddress: privacySettings.showAddress || user.privacySettings.showAddress,
            showDateOfBirth: privacySettings.showDateOfBirth || user.privacySettings.showDateOfBirth,
            profileVisibility: privacySettings.profileVisibility || user.privacySettings.profileVisibility,
        };

        await user.save();

        console.log(`[PRIVACY UPDATE] User ${user.email} updated privacy settings`);
        res.status(200).json({
            message: 'Privacy settings updated successfully',
            privacySettings: user.privacySettings,
        });
    } catch (error) {
        console.error('Update Privacy Settings Error:', error);
        res.status(500).json({ message: 'Error updating privacy settings' });
    }
};

// @desc    Update user preferences
// @route   PUT /api/profile/preferences
// @access  Private
export const updatePreferences = async (req, res) => {
    try {
        const userId = req.user._id;
        const { preferences } = req.body;

        if (!preferences) {
            return res.status(400).json({ message: 'Preferences are required' });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update preferences
        user.preferences = {
            emailNotifications: preferences.emailNotifications !== undefined ? preferences.emailNotifications : user.preferences.emailNotifications,
            orderUpdates: preferences.orderUpdates !== undefined ? preferences.orderUpdates : user.preferences.orderUpdates,
            promotionalEmails: preferences.promotionalEmails !== undefined ? preferences.promotionalEmails : user.preferences.promotionalEmails,
            language: preferences.language || user.preferences.language,
            currency: preferences.currency || user.preferences.currency,
        };

        await user.save();

        console.log(`[PREFERENCES UPDATE] User ${user.email} updated preferences`);
        res.status(200).json({
            message: 'Preferences updated successfully',
            preferences: user.preferences,
        });
    } catch (error) {
        console.error('Update Preferences Error:', error);
        res.status(500).json({ message: 'Error updating preferences' });
    }
};

// @desc    Get public profile of a user
// @route   GET /api/profile/:userId
// @access  Public
export const getPublicProfile = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId).select('-password -passwordHistory -twoFactorSecret -backupCodes -emailVerificationToken -resetPasswordToken -loginAttempts -lockUntil');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check profile visibility
        if (user.privacySettings.profileVisibility === 'private') {
            return res.status(403).json({ message: 'This profile is private' });
        }

        // Build public profile based on privacy settings
        const publicProfile = {
            _id: user._id,
            name: user.name,
            profilePicture: user.profilePicture,
            bio: user.bio,
            createdAt: user.createdAt,
        };

        // Add fields based on privacy settings
        if (user.privacySettings.showEmail === 'public') {
            publicProfile.email = user.email;
        }

        if (user.privacySettings.showPhone === 'public') {
            publicProfile.phone = user.phone;
        }

        if (user.privacySettings.showAddress === 'public') {
            publicProfile.address = user.address;
        }

        if (user.privacySettings.showDateOfBirth === 'public') {
            publicProfile.dateOfBirth = user.dateOfBirth;
        }

        // Social links are always public if set
        if (user.socialLinks) {
            publicProfile.socialLinks = user.socialLinks;
        }

        res.status(200).json({
            profile: publicProfile,
        });
    } catch (error) {
        console.error('Get Public Profile Error:', error);
        res.status(500).json({ message: 'Error fetching public profile' });
    }
};

export default {
    getMyProfile,
    updateProfile,
    uploadProfilePicture,
    deleteProfilePicture,
    updatePrivacySettings,
    updatePreferences,
    getPublicProfile,
};
