// middleware/passwordExpiryMiddleware.js
import User from '../models/user.js';

export const checkPasswordExpiry = async (req, res, next) => {
    try {
        // Skip password expiry check for these routes
        const skipRoutes = [
            '/api/auth/login',
            '/api/auth/signup',
            '/api/auth/forgot-password',
            '/api/auth/reset-password',
            '/api/auth/verify-email',
            '/api/password/change' // Allow password change even if expired
        ];

        if (skipRoutes.some(route => req.path.includes(route))) {
            return next();
        }

        // Check if user is authenticated
        if (!req.user || !req.user._id) {
            return next();
        }

        // Get user with password change timestamp
        const user = await User.findById(req.user._id).select('passwordChangedAt email');
        
        if (!user) {
            return next();
        }

        // Check if password has been changed (for existing users without passwordChangedAt)
        const passwordChangedAt = user.passwordChangedAt || user.createdAt;
        const passwordAge = Date.now() - new Date(passwordChangedAt).getTime();
        
        // Password expires after 90 days
        const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds
        
        if (passwordAge > maxAge) {
            // Calculate days overdue
            const daysOverdue = Math.floor(passwordAge / (24 * 60 * 60 * 1000)) - 90;
            
            return res.status(403).json({
                message: 'Password expired. Please change your password to continue.',
                requiresPasswordChange: true,
                daysOverdue,
                expiredAt: new Date(passwordChangedAt.getTime() + maxAge),
                code: 'PASSWORD_EXPIRED'
            });
        }

        // Add warning if password will expire in next 7 days
        const warningThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days
        if (passwordAge > (maxAge - warningThreshold)) {
            const daysUntilExpiry = Math.ceil((maxAge - passwordAge) / (24 * 60 * 60 * 1000));
            
            // Add warning to response headers
            res.set('X-Password-Expiry-Warning', `Password will expire in ${daysUntilExpiry} days`);
            
            // Add warning to request for frontend to use
            req.passwordExpiryWarning = {
                daysUntilExpiry,
                expiresAt: new Date(passwordChangedAt.getTime() + maxAge)
            };
        }

        next();
    } catch (error) {
        console.error('Password expiry check error:', error);
        // Don't block the request if there's an error
        next();
    }
};

// Middleware to update passwordChangedAt after password change
export const updatePasswordTimestamp = async (req, res, next) => {
    try {
        // This should be called after successful password change
        if (req.user && req.user._id && req.path.includes('/password/change')) {
            await User.findByIdAndUpdate(req.user._id, {
                passwordChangedAt: new Date()
            });
        }
        next();
    } catch (error) {
        console.error('Password timestamp update error:', error);
        next();
    }
};
