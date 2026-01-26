import MongoStore from 'connect-mongo';

// Export a function that creates the session config
// This ensures environment variables are loaded before accessing them
const createSessionConfig = () => {
    return {
        secret: process.env.SESSION_SECRET || 'your-super-secret-session-key-change-this',
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: process.env.MONGO_URI,
            touchAfter: 24 * 3600, // Lazy session update (24 hours)
            crypto: {
                secret: process.env.SESSION_SECRET || 'your-super-secret-session-key-change-this'
            }
        }),
        cookie: {
            httpOnly: true,        // Prevent XSS attacks
            secure: process.env.NODE_ENV === 'production', // HTTPS only in production
            sameSite: 'strict',    // Prevent CSRF attacks
            maxAge: 30 * 60 * 1000 // 30 minutes
        },
        name: 'sessionId', // Custom session cookie name
        rolling: true // Reset expiration on every response
    };
};

export default createSessionConfig;
