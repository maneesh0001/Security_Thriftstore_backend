// backend/middleware/inputSanitizer.js
import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';

// Create a DOM window for DOMPurify
const window = new JSDOM('').window;
const dompurify = DOMPurify(window);

// Configure DOMPurify for security
const purifyConfig = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 'i', 'b',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre'
  ],
  ALLOWED_ATTR: ['class'],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'object', 'embed', 'iframe', 'form', 'input', 'button'],
  FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur'],
  SANITIZE_DOM: true,
  SAFE_FOR_TEMPLATES: true,
  WHOLE_DOCUMENT: false,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  RETURN_DOM_IMPORT: false
};

// Main sanitization function
export const sanitizeInput = (input, options = {}) => {
  if (typeof input !== 'string') {
    return input;
  }

  // Merge custom options with default config
  const config = { ...purifyConfig, ...options };
  
  try {
    return dompurify.sanitize(input, config);
  } catch (error) {
    console.error('Input sanitization error:', error);
    // Return empty string if sanitization fails
    return '';
  }
};

// Sanitize object recursively
export const sanitizeObject = (obj, options = {}) => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeInput(obj, options);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, options));
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip sensitive fields from sanitization
      if (['password', 'currentPassword', 'newPassword', 'token', 'secret'].includes(key)) {
        sanitized[key] = value;
      } else {
        sanitized[key] = sanitizeObject(value, options);
      }
    }
    return sanitized;
  }

  return obj;
};

// Middleware for request body sanitization
export const sanitizeBody = (options = {}) => {
  return (req, res, next) => {
    try {
      if (req.body) {
        req.body = sanitizeObject(req.body, options);
      }
      next();
    } catch (error) {
      console.error('Body sanitization error:', error);
      res.status(400).json({
        message: 'Invalid input data',
        error: 'Sanitization failed'
      });
    }
  };
};

// Middleware for query parameter sanitization
export const sanitizeQuery = (options = {}) => {
  return (req, res, next) => {
    try {
      if (req.query) {
        req.query = sanitizeObject(req.query, options);
      }
      next();
    } catch (error) {
      console.error('Query sanitization error:', error);
      res.status(400).json({
        message: 'Invalid query parameters',
        error: 'Sanitization failed'
      });
    }
  };
};

// Middleware for parameter sanitization
export const sanitizeParams = (options = {}) => {
  return (req, res, next) => {
    try {
      if (req.params) {
        req.params = sanitizeObject(req.params, options);
      }
      next();
    } catch (error) {
      console.error('Params sanitization error:', error);
      res.status(400).json({
        message: 'Invalid parameters',
        error: 'Sanitization failed'
      });
    }
  };
};

// Combined middleware for all request inputs
export const sanitizeInputs = (options = {}) => {
  return [
    sanitizeBody(options),
    sanitizeQuery(options),
    sanitizeParams(options)
  ];
};

// Validation helpers
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPhone = (phone) => {
  // Allow various phone formats
  const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,15}$/;
  return phoneRegex.test(phone);
};

export const isValidName = (name) => {
  // Allow letters, spaces, hyphens, apostrophes
  const nameRegex = /^[a-zA-Z\s\-\']{2,50}$/;
  return nameRegex.test(name);
};

export const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Custom sanitization for specific fields
export const sanitizeName = (name) => {
  if (!name || typeof name !== 'string') return '';
  
  // Remove special characters except spaces, hyphens, apostrophes
  return name.replace(/[^a-zA-Z\s\-\']/g, '').trim();
};

export const sanitizeEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  
  // Convert to lowercase and remove extra spaces
  return email.toLowerCase().trim();
};

export const sanitizePhone = (phone) => {
  if (!phone || typeof phone !== 'string') return '';
  
  // Keep only digits, plus, spaces, hyphens, parentheses
  return phone.replace(/[^\d\+\s\-\(\)]/g, '').trim();
};

export const sanitizeBio = (bio) => {
  if (!bio || typeof bio !== 'string') return '';
  
  // Allow basic HTML tags for bio but sanitize everything else
  const bioConfig = {
    ...purifyConfig,
    ALLOWED_TAGS: [...purifyConfig.ALLOWED_TAGS, 'a'],
    ALLOWED_ATTR: [...purifyConfig.ALLOWED_ATTR, 'href', 'target']
  };
  
  return dompurify.sanitize(bio, bioConfig).substring(0, 500); // Limit to 500 chars
};

export default {
  sanitizeInput,
  sanitizeObject,
  sanitizeBody,
  sanitizeQuery,
  sanitizeParams,
  sanitizeInputs,
  isValidEmail,
  isValidPhone,
  isValidName,
  isValidUrl,
  sanitizeName,
  sanitizeEmail,
  sanitizePhone,
  sanitizeBio
};
