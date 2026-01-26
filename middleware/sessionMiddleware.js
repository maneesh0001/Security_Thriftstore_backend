// Session validation middleware
const sessionMiddleware = (req, res, next) => {
    // Check if session exists
    if (!req.session || !req.session.userId) {
        return res.status(401).json({
            message: 'Unauthorized - No active session',
            sessionExpired: true
        });
    }

    // Check if session has expired due to inactivity
    const now = Date.now();
    const lastActivity = req.session.lastActivity || now;
    const inactivityTimeout = 30 * 60 * 1000; // 30 minutes

    if (now - lastActivity > inactivityTimeout) {
        // Session expired due to inactivity
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying expired session:', err);
            }
        });

        return res.status(401).json({
            message: 'Session expired due to inactivity',
            sessionExpired: true
        });
    }

    // Update last activity timestamp
    req.session.lastActivity = now;

    // Continue to next middleware
    next();
};

export default sessionMiddleware;
