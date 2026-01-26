// backend/middleware/rateLimitMiddleware.js
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

// Global rate limiter - 100 requests per 15 minutes
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        message: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Login rate limiter - 5 requests per minute per IP
export const loginLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // Limit each IP to 5 login requests per minute
    message: {
        message: 'Too many login attempts from this IP, please try again after a minute.',
        retryAfter: '1 minute'
    },
    skipSuccessfulRequests: true, // Don't count successful requests
    standardHeaders: true,
    legacyHeaders: false,
});

// Signup rate limiter - 3 signups per hour per IP
export const signupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Limit each IP to 3 signup requests per hour
    message: {
        message: 'Too many accounts created from this IP, please try again after an hour.',
        retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Password reset rate limiter - 3 requests per hour per IP
export const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Limit each IP to 3 password reset requests per hour
    message: {
        message: 'Too many password reset requests, please try again after an hour.',
        retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Progressive delay middleware - slows down requests after repeated attempts
export const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 3, // Allow 3 requests per 15 minutes without delay
    delayMs: (hits) => hits * 500, // Add 500ms delay per request after delayAfter
    maxDelayMs: 5000, // Maximum delay of 5 seconds
});

// CAPTCHA verification middleware for reCAPTCHA v3
export const verifyCaptcha = async (req, res, next) => {
    const { captchaToken } = req.body;

    // Skip CAPTCHA verification if not provided (for initial login attempts)
    if (!captchaToken) {
        return next();
    }

    try {
        const secretKey = process.env.RECAPTCHA_SECRET_KEY;

        if (!secretKey || secretKey === 'your-recaptcha-secret-key') {
            console.warn('⚠️ RECAPTCHA_SECRET_KEY not configured. Skipping CAPTCHA verification.');
            return next();
        }

        // Verify the CAPTCHA token with Google
        const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `secret=${secretKey}&response=${captchaToken}`,
        });

        const data = await response.json();

        if (data.success && data.score >= 0.5) {
            // CAPTCHA verification successful
            return next();
        } else {
            console.warn('CAPTCHA verification failed:', { success: data.success, score: data.score, errors: data['error-codes'] });
            return res.status(400).json({
                message: 'CAPTCHA verification failed. Please refresh the page and try again.',
                captchaRequired: true,
                score: data.score
            });
        }
    } catch (error) {
        console.error('CAPTCHA verification error:', error);
        // In case of error, allow the request to proceed (fail open)
        return next();
    }
};

export default {
    globalLimiter,
    loginLimiter,
    signupLimiter,
    passwordResetLimiter,
    speedLimiter,
    verifyCaptcha,
};
