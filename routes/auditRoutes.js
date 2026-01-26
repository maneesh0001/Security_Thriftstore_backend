// backend/routes/auditRoutes.js
import express from 'express';
import AuditLog from '../models/auditLog.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get user's own activity logs
router.get('/my-activity', protect, async (req, res) => {
    try {
        const userId = req.user._id;
        const { limit = 50, page = 1 } = req.query;
        
        const logs = await AuditLog.getUserActivity(userId, parseInt(limit));
        
        res.status(200).json({
            success: true,
            data: logs,
            count: logs.length
        });
    } catch (error) {
        console.error('Get user activity error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching activity logs' 
        });
    }
});

// Get all security events (Admin only)
router.get('/security-events', protect, admin, async (req, res) => {
    try {
        const { severity = 'MEDIUM', limit = 100, page = 1 } = req.query;
        
        const logs = await AuditLog.getSecurityEvents(severity, parseInt(limit));
        
        res.status(200).json({
            success: true,
            data: logs,
            count: logs.length,
            severity
        });
    } catch (error) {
        console.error('Get security events error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching security events' 
        });
    }
});

// Get all audit logs (Admin only)
router.get('/all', protect, admin, async (req, res) => {
    try {
        const { 
            limit = 100, 
            page = 1, 
            action, 
            severity, 
            userId,
            startDate,
            endDate 
        } = req.query;
        
        // Build filter
        const filter = {};
        if (action) filter.action = action;
        if (severity) filter.severity = severity;
        if (userId) filter.userId = userId;
        if (startDate || endDate) {
            filter.timestamp = {};
            if (startDate) filter.timestamp.$gte = new Date(startDate);
            if (endDate) filter.timestamp.$lte = new Date(endDate);
        }
        
        const logs = await AuditLog.find(filter)
            .populate('userId', 'name email')
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));
        
        const total = await AuditLog.countDocuments(filter);
        
        res.status(200).json({
            success: true,
            data: logs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get all audit logs error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching audit logs' 
        });
    }
});

// Get audit log statistics (Admin only)
router.get('/stats', protect, admin, async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const startDate = new Date(Date.now() - (parseInt(days) * 24 * 60 * 60 * 1000));
        
        // Get various statistics
        const [
            totalLogs,
            securityEvents,
            failedLogins,
            successfulLogins,
            passwordChanges,
            accountLocks
        ] = await Promise.all([
            AuditLog.countDocuments({ timestamp: { $gte: startDate } }),
            AuditLog.countDocuments({ 
                timestamp: { $gte: startDate },
                severity: { $in: ['HIGH', 'CRITICAL'] }
            }),
            AuditLog.countDocuments({ 
                timestamp: { $gte: startDate },
                action: 'LOGIN_FAILED'
            }),
            AuditLog.countDocuments({ 
                timestamp: { $gte: startDate },
                action: 'LOGIN_SUCCESS'
            }),
            AuditLog.countDocuments({ 
                timestamp: { $gte: startDate },
                action: 'PASSWORD_CHANGE'
            }),
            AuditLog.countDocuments({ 
                timestamp: { $gte: startDate },
                action: 'ACCOUNT_LOCKED'
            })
        ]);
        
        // Get recent security events
        const recentSecurityEvents = await AuditLog.getSecurityEvents('HIGH', 10);
        
        res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalLogs,
                    securityEvents,
                    failedLogins,
                    successfulLogins,
                    passwordChanges,
                    accountLocks,
                    daysRange: parseInt(days)
                },
                recentSecurityEvents
            }
        });
    } catch (error) {
        console.error('Get audit stats error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching audit statistics' 
        });
    }
});

// Cleanup old logs (Admin only)
router.delete('/cleanup', protect, admin, async (req, res) => {
    try {
        const { days = 90 } = req.query;
        
        const result = await AuditLog.cleanupOldLogs(parseInt(days));
        
        res.status(200).json({
            success: true,
            message: `Cleaned up ${result.deletedCount} audit logs older than ${days} days`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('Cleanup audit logs error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error cleaning up audit logs' 
        });
    }
});

export default router;
