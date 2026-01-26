// backend/middleware/passwordValidator.js
import { body, validationResult } from 'express-validator';
import zxcvbn from 'zxcvbn';

/**
 * Password Complexity Rules:
 * - Minimum 12 characters
 * - At least 1 uppercase letter (A-Z)
 * - At least 1 lowercase letter (a-z)
 * - At least 1 number (0-9)
 * - At least 1 special symbol (!@#$%^&*()_+-=[]{}|;:,.<>?)
 */

// Validation rules for password complexity
export const passwordComplexityRules = [
    body('password')
        .isLength({ min: 12 })
        .withMessage('Password must be at least 12 characters long')
        .matches(/[A-Z]/)
        .withMessage('Password must contain at least one uppercase letter')
        .matches(/[a-z]/)
        .withMessage('Password must contain at least one lowercase letter')
        .matches(/[0-9]/)
        .withMessage('Password must contain at least one number')
        .matches(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/)
        .withMessage('Password must contain at least one special symbol (!@#$%^&*()_+-=[]{}|;:,.<>?)'),
];

// Validation rules for newPassword field (used in change password)
export const newPasswordComplexityRules = [
    body('newPassword')
        .isLength({ min: 12 })
        .withMessage('Password must be at least 12 characters long')
        .matches(/[A-Z]/)
        .withMessage('Password must contain at least one uppercase letter')
        .matches(/[a-z]/)
        .withMessage('Password must contain at least one lowercase letter')
        .matches(/[0-9]/)
        .withMessage('Password must contain at least one number')
        .matches(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/)
        .withMessage('Password must contain at least one special symbol (!@#$%^&*()_+-=[]{}|;:,.<>?)'),
];

// Middleware to check validation results
export const validatePassword = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            message: 'Password does not meet complexity requirements',
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg,
            })),
        });
    }

    next();
};

// Middleware to check password strength using zxcvbn
export const checkPasswordStrength = (req, res, next) => {
    const { password } = req.body;

    if (!password) {
        return next();
    }

    const result = zxcvbn(password);

    // Store strength result in request for later use
    req.passwordStrength = {
        score: result.score, // 0-4
        feedback: result.feedback,
        crackTime: result.crack_times_display.offline_slow_hashing_1e4_per_second,
    };

    // Optionally warn if password is weak (score < 2)
    if (result.score < 2) {
        req.passwordStrength.warning = 'Password is weak. Consider using a stronger password.';
    }

    next();
};

// Middleware to check password strength using zxcvbn for newPassword
export const checkNewPasswordStrength = (req, res, next) => {
    const { newPassword } = req.body;

    if (!newPassword) {
        return next();
    }

    const result = zxcvbn(newPassword);

    // Store strength result in request for later use
    req.passwordStrength = {
        score: result.score, // 0-4
        feedback: result.feedback,
        crackTime: result.crack_times_display.offline_slow_hashing_1e4_per_second,
    };

    // Optionally warn if password is weak (score < 2)
    if (result.score < 2) {
        req.passwordStrength.warning = 'Password is weak. Consider using a stronger password.';
    }

    next();
};

// Combined middleware for password validation
export const validatePasswordSecurity = [
    ...passwordComplexityRules,
    validatePassword,
    checkPasswordStrength,
];

// Combined middleware for newPassword validation (for change password)
export const validateNewPasswordSecurity = [
    ...newPasswordComplexityRules,
    validatePassword,
    checkNewPasswordStrength,
];

export default {
    passwordComplexityRules,
    newPasswordComplexityRules,
    validatePassword,
    checkPasswordStrength,
    checkNewPasswordStrength,
    validatePasswordSecurity,
    validateNewPasswordSecurity,
};
