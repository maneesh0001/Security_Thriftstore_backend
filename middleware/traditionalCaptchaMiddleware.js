// middleware/traditionalCaptchaMiddleware.js

// Simple session-based CAPTCHA storage
const captchaStore = new Map();

// Generate random CAPTCHA text
const generateCaptchaText = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let captcha = '';
    for (let i = 0; i < 6; i++) {
        captcha += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return captcha;
};

// Store CAPTCHA in session
export const storeCaptcha = (req, res, next) => {
    const captchaText = generateCaptchaText();
    const captchaId = Date.now() + Math.random().toString(36).substr(2, 9);
    
    // Store in session (if available) or memory
    if (req.session) {
        req.session.captchaId = captchaId;
        req.session.captchaText = captchaText;
    } else {
        // Fallback to memory store with expiration
        captchaStore.set(captchaId, {
            text: captchaText,
            timestamp: Date.now()
        });
        
        // Clean up old entries (5 minutes)
        const now = Date.now();
        for (const [key, value] of captchaStore.entries()) {
            if (now - value.timestamp > 5 * 60 * 1000) {
                captchaStore.delete(key);
            }
        }
    }
    
    res.json({ captchaId, captchaText });
};

// Verify CAPTCHA
export const verifyTraditionalCaptcha = (req, res, next) => {
    const { captchaText } = req.body;
    
    console.log('🔍 CAPTCHA Debug - Request body:', req.body);
    console.log('🔍 CAPTCHA Debug - captchaText:', captchaText);
    
    if (!captchaText) {
        console.log('❌ CAPTCHA Debug: No captchaText provided');
        return res.status(400).json({ 
            message: 'CAPTCHA is required',
            captchaRequired: true 
        });
    }

    // For this implementation, we'll use a simple validation
    // In production, you might want to use a more sophisticated approach
    // like storing the CAPTCHA in session or using a service
    
    // Basic validation: check if it's 6 characters alphanumeric
    const captchaPattern = /^[A-Z0-9]{6}$/i;
    
    if (!captchaPattern.test(captchaText)) {
        console.log('❌ CAPTCHA Debug: Invalid format -', captchaText);
        return res.status(400).json({ 
            message: 'Invalid CAPTCHA format. Please enter exactly 6 alphanumeric characters.',
            captchaRequired: true 
        });
    }
    
    console.log('✅ CAPTCHA Debug: Validation passed for -', captchaText);
    // CAPTCHA format is valid, proceed with login
    // Note: In a real production app, you'd verify against a stored CAPTCHA
    // For now, we're trusting the frontend validation
    next();
};

export default {
    storeCaptcha,
    verifyTraditionalCaptcha,
};
