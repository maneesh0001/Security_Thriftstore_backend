// 1. Import all necessary modules (except sessionConfig which needs env vars)
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDb from './config/database.js';

import authRoutes from './routes/authRoutes.js';
import twoFactorRoutes from './routes/twoFactorRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import userRoutes from './routes/userRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import passwordRoutes from './routes/passwordRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';

import { globalLimiter } from './middleware/rateLimitMiddleware.js';
import { auditLogger } from './middleware/auditLogger.js';
import { sanitizeInputs } from './middleware/inputSanitizer.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Load environment variables from the .env file FIRST
dotenv.config();

// 3. Import sessionConfig AFTER environment variables are loaded
import createSessionConfig from './config/sessionConfig.js';

// 4. Establish the database connection
connectDb();

// 5. Initialize the Express application
const app = express();

// 6. Define the port
const PORT = process.env.PORT || 5000;

// 7. Apply security middleware
app.use(helmet({
  // Content Security Policy to prevent XSS
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-eval'"], // Allow eval for some frontend libraries
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://a.khalti.com"], // Allow Khalti API
      frameSrc: ["'none'"], // Prevent clickjacking
      objectSrc: ["'none'"], // Prevent plugin vulnerabilities
      mediaSrc: ["'self'"],
      manifestSrc: ["'self'"]
    },
    reportOnly: process.env.NODE_ENV === 'development' // Report only in development
  },
  
  // HTTP Strict Transport Security (force HTTPS in production)
  hsts: {
    maxAge: process.env.NODE_ENV === 'production' ? 31536000 : 0, // 1 year in production
    includeSubDomains: process.env.NODE_ENV === 'production',
    preload: process.env.NODE_ENV === 'production'
  },
  
  // Prevent clickjacking
  frameguard: { 
    action: 'deny' 
  },
  
  // Hide Express server info
  hidePoweredBy: true,
  
  // Prevent MIME type sniffing
  noSniff: true,
  
  // Enable browser XSS protection
  xssFilter: true,
  
  // Referrer Policy
  referrerPolicy: { 
    policy: 'strict-origin-when-cross-origin' 
  },
  
  // Permissions Policy (restrict features)
  permissionsPolicy: {
    features: {
      geolocation: [],
      camera: [],
      microphone: [],
      payment: ['self'], // Allow payment for Khalti
      usb: [],
      magnetometer: [],
      gyroscope: [],
      accelerometer: []
    }
  },
  
  // Cross-Origin Embedder Policy
  crossOriginEmbedderPolicy: false, // Disabled for compatibility with Khalti
  
  // Cross-Origin Resource Policy
  crossOriginResourcePolicy: { 
    policy: "cross-origin" // Allow images to be loaded cross-origin
  }
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true // Allow cookies to be sent
}));
app.use(express.json());
app.use(cookieParser());
app.use(session(createSessionConfig())); // Session middleware - call function to create config

// 7.5. Serve static files from public/uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// 7. Apply global rate limiting
app.use(globalLimiter);

// 7.6. Apply audit logging (after rate limiting, before routes) - temporarily disabled
// app.use(auditLogger);

// 7.7. Apply input sanitization (before routes)
app.use('/api', sanitizeInputs());


// 8. Define and apply API routes
app.use('/api/auth', authRoutes);
app.use('/api/2fa', twoFactorRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/password', passwordRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/admin', dashboardRoutes);

// 9. Define a default root route for health checks
app.get('/', (req, res) => {
  res.send('<h1>🚀 Web Thrift Store API is running successfully!</h1><p>API is active with enhanced security features.</p>');
});

// 10. Start the server
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
  console.log(`🔒 Security features enabled: Rate Limiting, Helmet, 2FA, Email Verification, Session Management`);
});
