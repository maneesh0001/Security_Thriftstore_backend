// backend/middleware/auditLogger.js
import AuditLog from '../models/auditLog.js';

// Helper function to determine action from request
const getActionFromRequest = (req, res) => {
    const method = req.method;
    const path = req.path;
    const user = req.user;
    
    // Authentication actions
    if (path.includes('/auth/login')) {
        if (res.statusCode === 200) return 'LOGIN_SUCCESS';
        if (res.statusCode === 400 || res.statusCode === 401) return 'LOGIN_FAILED';
        if (res.statusCode === 423) return 'ACCOUNT_LOCKED';
        return 'POST__LOGIN'; // Fallback for login attempts
    }
    
    if (path.includes('/auth/logout')) return 'LOGOUT';
    if (path.includes('/auth/signup')) return 'USER_CREATED';
    if (path.includes('/password/change')) return 'PASSWORD_CHANGE';
    if (path.includes('/password/reset')) {
        if (method === 'POST') return 'PASSWORD_RESET_REQUEST';
        if (method === 'PUT' || method === 'PATCH') return 'PASSWORD_RESET_SUCCESS';
    }
    if (path.includes('/verify-email')) return 'EMAIL_VERIFICATION';
    
    // 2FA actions
    if (path.includes('/2fa')) {
        if (path.includes('/enable')) return '2FA_ENABLED';
        if (path.includes('/disable')) return '2FA_DISABLED';
        if (path.includes('/verify')) return '2FA_VERIFICATION';
    }
    
    // Profile actions
    if (path.includes('/profile') || path.includes('/user/profile')) {
        if (method === 'PUT' || method === 'PATCH') return 'PROFILE_UPDATE';
        if (method === 'POST' && path.includes('/picture')) return 'PROFILE_PICTURE_UPLOAD';
        if (method === 'DELETE' && path.includes('/picture')) return 'PROFILE_PICTURE_DELETE';
    }
    
    // Payment actions
    if (path.includes('/payment')) {
        if (path.includes('/initiate')) return 'PAYMENT_INITIATED';
        if (path.includes('/verify')) return 'PAYMENT_SUCCESS';
        if (path.includes('/khalti')) {
            if (path.includes('/initiate')) return 'POST__KHALTI_INITIATE';
            if (path.includes('/verify')) return 'POST__KHALTI_VERIFY';
            return 'PAYMENT_SUCCESS';
        }
    }
    
    // Order actions
    if (path.includes('/order')) {
        if (method === 'POST') return 'ORDER_CREATED';
        if (method === 'DELETE' || (method === 'PATCH' && req.body.status === 'cancelled')) return 'ORDER_CANCELLED';
    }
    
    // Admin actions
    if (path.includes('/admin')) {
        if (path.includes('/users')) {
            if (method === 'POST') return 'USER_CREATED';
            if (method === 'PUT' || method === 'PATCH') return 'USER_UPDATED';
            if (method === 'DELETE') return 'USER_DELETED';
        }
        if (path.includes('/products')) {
            if (method === 'POST') return 'PRODUCT_CREATED';
            if (method === 'PUT' || method === 'PATCH') return 'PRODUCT_UPDATED';
            if (method === 'DELETE') return 'PRODUCT_DELETED';
        }
    }
    
    // Security events
    if (res.statusCode === 401) return 'UNAUTHORIZED_ACCESS';
    if (res.statusCode === 403) return 'UNAUTHORIZED_ACCESS';
    if (res.statusCode === 429) return 'RATE_LIMIT_EXCEEDED';
    
    // Default action
    const cleanPath = path.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
    const actionName = cleanPath || 'ROOT';
    return `${method}_${actionName}`.toUpperCase();
};

// Helper function to determine severity
const getSeverity = (action, result, statusCode) => {
    // Critical security events
    if (['ACCOUNT_LOCKED', 'UNAUTHORIZED_ACCESS', 'RATE_LIMIT_EXCEEDED', 'SUSPICIOUS_ACTIVITY'].includes(action)) {
        return 'HIGH';
    }
    
    // Failed authentication attempts
    if (['LOGIN_FAILED', '2FA_VERIFICATION'].includes(action) && result === 'FAILED') {
        return 'MEDIUM';
    }
    
    // Successful security actions
    if (['LOGIN_SUCCESS', 'PASSWORD_CHANGE', '2FA_ENABLED'].includes(action)) {
        return 'LOW';
    }
    
    // Failed operations
    if (result === 'FAILED' || statusCode >= 400) {
        return 'MEDIUM';
    }
    
    // Default to low
    return 'LOW';
};

// Main audit logging middleware
export const auditLogger = (req, res, next) => {
    // Don't log health checks, static files, or OPTIONS requests
    if (req.path === '/health' || req.path.startsWith('/static') || req.method === 'OPTIONS') {
        return next();
    }
    
    // Store original res.end to capture response
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
        // Get action and result
        const action = getActionFromRequest(req, res);
        const result = res.statusCode < 400 ? 'SUCCESS' : 'FAILED';
        const severity = getSeverity(action, result, res.statusCode);
        
        // Prepare metadata
        const metadata = {
            statusCode: res.statusCode,
            method: req.method,
            path: req.path,
            userAgent: req.get('User-Agent'),
            contentType: req.get('Content-Type'),
            contentLength: req.get('Content-Length')
        };
        
        // Add user-specific metadata if authenticated
        if (req.user) {
            metadata.userRole = req.user.role;
            metadata.email = req.user.email;
        }
        
        // Add error details if available
        if (res.locals.errorMessage) {
            metadata.error = res.locals.errorMessage;
        }
        
        // Add request-specific metadata
        if (req.body && Object.keys(req.body).length > 0) {
            // Sanitize sensitive data
            const sanitizedBody = { ...req.body };
            delete sanitizedBody.password;
            delete sanitizedBody.currentPassword;
            delete sanitizedBody.newPassword;
            delete sanitizedBody.token;
            metadata.requestBody = sanitizedBody;
        }
        
        // Log the event asynchronously (don't block response)
        setImmediate(async () => {
            try {
                await AuditLog.logSecurityEvent({
                    action,
                    userId: req.user?._id || null,
                    resource: `${req.method} ${req.path}`,
                    ipAddress: req.ip || req.connection.remoteAddress,
                    userAgent: req.get('User-Agent'),
                    result,
                    metadata,
                    severity
                });
            } catch (error) {
                console.error('Audit logging error:', error);
                // Don't let logging errors break the application
            }
        });
        
        // Call original end
        originalEnd.call(this, chunk, encoding);
    };
    
    next();
};

// Helper function to log custom events
export const logCustomEvent = async (eventData) => {
    try {
        await AuditLog.logSecurityEvent(eventData);
    } catch (error) {
        console.error('Custom audit logging error:', error);
    }
};

export default {
    auditLogger,
    logCustomEvent
};
