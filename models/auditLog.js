// backend/models/auditLog.js
import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false, // Some actions might be anonymous (e.g., failed login)
    },
    action: {
        type: String,
        required: true,
        enum: [
            // Authentication actions
            'LOGIN_SUCCESS',
            'LOGIN_FAILED',
            'LOGOUT',
            'ACCOUNT_LOCKED',
            'PASSWORD_CHANGE',
            'PASSWORD_RESET_REQUEST',
            'PASSWORD_RESET_SUCCESS',
            'EMAIL_VERIFICATION',
            '2FA_ENABLED',
            '2FA_DISABLED',
            '2FA_VERIFICATION',
            'POST__LOGIN',
            
            // Profile actions
            'PROFILE_UPDATE',
            'PROFILE_PICTURE_UPLOAD',
            'PROFILE_PICTURE_DELETE',
            'PRIVACY_SETTINGS_CHANGE',
            
            // Dashboard actions
            'DASHBOARD_VIEW',
            'GET_API_ADMIN_DASHBOARD_STATS',
            'GET_INVENTORY_ALERTS',
            'GET_SALES_BY_CATEGORY',
            'GET_ORDERS_RECENT',
            'GET_SALES_DATA',
            'GET_ME',
            
            // Transaction actions
            'PAYMENT_INITIATED',
            'PAYMENT_SUCCESS',
            'PAYMENT_FAILED',
            'ORDER_CREATED',
            'ORDER_CANCELLED',
            'POST__KHALTI_INITIATE',
            'POST__KHALTI_VERIFY',
            
            // Admin actions
            'USER_CREATED',
            'USER_UPDATED',
            'USER_DELETED',
            'PRODUCT_CREATED',
            'PRODUCT_UPDATED',
            'PRODUCT_DELETED',
            'ORDERS_VIEW',
            
            // Security actions
            'UNAUTHORIZED_ACCESS',
            'RATE_LIMIT_EXCEEDED',
            'SUSPICIOUS_ACTIVITY',
            'SESSION_EXPIRED',
            
            // Generic actions
            'GET__',
            'GET_ROOT',
            'POST_KHALTI_INITIATE',
            'POST_KHALTI_VERIFY',
            'POST_LOGIN'
        ]
    },
    resource: {
        type: String,
        required: false, // What resource was accessed (e.g., '/api/auth/login')
    },
    timestamp: {
        type: Date,
        default: Date.now,
        required: true
    },
    ipAddress: {
        type: String,
        required: true
    },
    userAgent: {
        type: String,
        required: false
    },
    result: {
        type: String,
        required: true,
        enum: ['SUCCESS', 'FAILED', 'PARTIAL', 'BLOCKED']
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        required: false, // Additional context like error messages, user roles, etc.
    },
    severity: {
        type: String,
        required: true,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: 'LOW'
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// Indexes for better performance
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ ipAddress: 1, timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });

// Static method to log security events
auditLogSchema.statics.logSecurityEvent = function(eventData) {
    return this.create({
        action: eventData.action,
        userId: eventData.userId || null,
        resource: eventData.resource,
        ipAddress: eventData.ipAddress,
        userAgent: eventData.userAgent,
        result: eventData.result || 'SUCCESS',
        metadata: eventData.metadata || {},
        severity: eventData.severity || 'LOW'
    });
};

// Static method to get user activity
auditLogSchema.statics.getUserActivity = function(userId, limit = 50) {
    return this.find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .populate('userId', 'name email');
};

// Static method to get security events
auditLogSchema.statics.getSecurityEvents = function(severity = 'MEDIUM', limit = 100) {
    return this.find({ 
        severity: { $in: ['HIGH', 'CRITICAL'].includes(severity) ? [severity] : ['MEDIUM', 'HIGH', 'CRITICAL'] }
    })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('userId', 'name email');
};

// Static method to cleanup old logs (retention policy)
auditLogSchema.statics.cleanupOldLogs = function(daysToKeep = 90) {
    const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000));
    return this.deleteMany({ timestamp: { $lt: cutoffDate } });
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
