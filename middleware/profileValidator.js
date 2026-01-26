// backend/middleware/profileValidator.js
import { body, validationResult } from 'express-validator';

// Validation rules for profile update
export const profileUpdateRules = [
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters'),

    body('phone')
        .optional()
        .matches(/^\+?[0-9\s-]{10,15}$/)
        .withMessage('Invalid phone number format'),

    body('bio')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Bio cannot exceed 500 characters'),

    body('dateOfBirth')
        .optional()
        .custom((value) => {
            if (!value || value.trim() === '') {
                return true; // Allow empty values
            }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                throw new Error('Invalid date format. Use YYYY-MM-DD format');
            }
            
            const birthDate = new Date(value);
            const today = new Date();
            const age = today.getFullYear() - birthDate.getFullYear();

            if (age < 13) {
                throw new Error('You must be at least 13 years old');
            }
            if (age > 120) {
                throw new Error('Invalid date of birth');
            }
            return true;
        }),

    body('gender')
        .optional()
        .isIn(['male', 'female', 'other', 'prefer-not-to-say'])
        .withMessage('Invalid gender value'),

    // Handle address as nested object
    body('address.street')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('Street address cannot exceed 200 characters'),

    body('address.city')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('City cannot exceed 100 characters'),

    body('address.state')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('State cannot exceed 100 characters'),

    body('address.zipCode')
        .optional()
        .trim()
        .isLength({ max: 20 })
        .withMessage('Zip code cannot exceed 20 characters'),

    body('address.country')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Country cannot exceed 100 characters'),

    // Social links validation - make them optional and not required URLs
    body('socialLinks.facebook')
        .optional()
        .custom((value) => {
            if (!value || value.trim() === '') return true;
            try {
                new URL(value);
                return true;
            } catch {
                throw new Error('Invalid Facebook URL');
            }
        }),

    body('socialLinks.twitter')
        .optional()
        .custom((value) => {
            if (!value || value.trim() === '') return true;
            try {
                new URL(value);
                return true;
            } catch {
                throw new Error('Invalid Twitter URL');
            }
        }),

    body('socialLinks.instagram')
        .optional()
        .custom((value) => {
            if (!value || value.trim() === '') return true;
            try {
                new URL(value);
                return true;
            } catch {
                throw new Error('Invalid Instagram URL');
            }
        }),

    body('socialLinks.linkedin')
        .optional()
        .custom((value) => {
            if (!value || value.trim() === '') return true;
            try {
                new URL(value);
                return true;
            } catch {
                throw new Error('Invalid LinkedIn URL');
            }
        }),
];

// Validation rules for privacy settings
export const privacySettingsRules = [
    body('privacySettings.showEmail')
        .optional()
        .isIn(['public', 'private', 'contacts'])
        .withMessage('Invalid privacy setting for email'),

    body('privacySettings.showPhone')
        .optional()
        .isIn(['public', 'private', 'contacts'])
        .withMessage('Invalid privacy setting for phone'),

    body('privacySettings.showAddress')
        .optional()
        .isIn(['public', 'private', 'contacts'])
        .withMessage('Invalid privacy setting for address'),

    body('privacySettings.showDateOfBirth')
        .optional()
        .isIn(['public', 'private', 'contacts'])
        .withMessage('Invalid privacy setting for date of birth'),

    body('privacySettings.profileVisibility')
        .optional()
        .isIn(['public', 'private'])
        .withMessage('Invalid profile visibility setting'),
];

// Validation rules for preferences
export const preferencesRules = [
    body('preferences.emailNotifications')
        .optional()
        .isBoolean()
        .withMessage('Email notifications must be a boolean'),

    body('preferences.orderUpdates')
        .optional()
        .isBoolean()
        .withMessage('Order updates must be a boolean'),

    body('preferences.promotionalEmails')
        .optional()
        .isBoolean()
        .withMessage('Promotional emails must be a boolean'),

    body('preferences.language')
        .optional()
        .isLength({ min: 2, max: 5 })
        .withMessage('Invalid language code'),

    body('preferences.currency')
        .optional()
        .isLength({ min: 3, max: 3 })
        .withMessage('Invalid currency code'),
];

// Middleware to check validation results
export const validateRequest = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        console.log('❌ [PROFILE VALIDATION] Validation errors:', errors.array());
        return res.status(400).json({
            message: 'Validation failed',
            errors: errors.array().map(err => ({
                field: err.param,
                message: err.msg,
                value: err.value,
                location: err.location
            }))
        });
    }

    next();
};

export default {
    profileUpdateRules,
    privacySettingsRules,
    preferencesRules,
    validateRequest,
};
