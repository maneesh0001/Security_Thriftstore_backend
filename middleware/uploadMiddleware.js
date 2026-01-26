// backend/middleware/uploadMiddleware.js
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure upload directories exist
const uploadsDir = path.join(__dirname, '../public/uploads');
const profilesDir = path.join(__dirname, '../public/uploads/profiles');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(profilesDir)) {
    fs.mkdirSync(profilesDir, { recursive: true });
}

// Configure storage for general uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Store uploads in a public/uploads directory
        cb(null, path.join(__dirname, '../public/uploads'));
    },
    filename: function (req, file, cb) {
        // Create unique filename: timestamp-originalname
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// Configure storage for profile pictures
const profileStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../public/uploads/profiles'));
    },
    filename: function (req, file, cb) {
        // Create unique filename: user-id-timestamp.ext
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const userId = req.user ? req.user._id : 'unknown';
        cb(null, `profile-${userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

// File filter to only accept images
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
};

// Create multer upload instance for general uploads
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max file size
    },
    fileFilter: fileFilter,
});

// Create multer upload instance for profile pictures
export const uploadProfilePicture = multer({
    storage: profileStorage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max file size
    },
    fileFilter: fileFilter,
});

// Middleware to validate image dimensions
export const validateImageDimensions = (req, res, next) => {
    if (!req.file) {
        return next();
    }

    // For profile pictures, we could add dimension validation here
    // This would require an image processing library like 'sharp'
    // For now, we'll just pass through
    next();
};

export default upload;

