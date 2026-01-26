// backend/models/user.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  // This is the corrected schema definition for the 'role' field.
  // It must be exactly like this.
  role: {
    type: String,
    enum: ['user', 'admin'], // Specifies that role can only be one of these two values
    default: 'user',       // Sets a default value if none is provided
    required: true,        // Ensures the field must exist
  },
  
  // ===== Profile Information Fields =====
  profilePicture: {
    type: String,
    default: null, // URL to uploaded profile image
  },
  phone: {
    type: String,
    default: null,
    validate: {
      validator: function(v) {
        // Allow null or valid phone number (10-15 digits with optional + and spaces)
        return v === null || /^\+?[0-9\s-]{10,15}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number!`
    }
  },
  address: {
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    zipCode: { type: String, default: '' },
    country: { type: String, default: '' },
  },
  bio: {
    type: String,
    default: '',
    maxlength: [500, 'Bio cannot exceed 500 characters'],
  },
  dateOfBirth: {
    type: Date,
    default: null,
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer-not-to-say', null],
    default: null,
  },
  
  // ===== Privacy Settings =====
  privacySettings: {
    showEmail: {
      type: String,
      enum: ['public', 'private', 'contacts'],
      default: 'private',
    },
    showPhone: {
      type: String,
      enum: ['public', 'private', 'contacts'],
      default: 'private',
    },
    showAddress: {
      type: String,
      enum: ['public', 'private', 'contacts'],
      default: 'private',
    },
    showDateOfBirth: {
      type: String,
      enum: ['public', 'private', 'contacts'],
      default: 'private',
    },
    profileVisibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
    },
  },
  
  // ===== User Preferences =====
  preferences: {
    emailNotifications: {
      type: Boolean,
      default: true,
    },
    orderUpdates: {
      type: Boolean,
      default: true,
    },
    promotionalEmails: {
      type: Boolean,
      default: false,
    },
    language: {
      type: String,
      default: 'en',
    },
    currency: {
      type: String,
      default: 'NPR',
    },
  },
  
  // ===== Social Links (Optional) =====
  socialLinks: {
    facebook: { type: String, default: '' },
    twitter: { type: String, default: '' },
    instagram: { type: String, default: '' },
    linkedin: { type: String, default: '' },
  },
  
  // ===== Two-Factor Authentication (2FA) Fields =====
  twoFactorSecret: {
    type: String,
    default: null,
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false,
  },
  twoFactorTempSecret: {
    type: String,
    default: null,
  },
  backupCodes: {
    type: [String],
    default: [],
  },
  
  // ===== Email Verification Fields =====
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  emailVerificationToken: {
    type: String,
    default: null,
  },
  emailVerificationExpires: {
    type: Date,
    default: null,
  },
  
  // ===== Password Reset Fields =====
  resetPasswordToken: {
    type: String,
    default: null,
  },
  resetPasswordExpires: {
    type: Date,
    default: null,
  },
  
  // ===== Brute-Force Protection Fields =====
  loginAttempts: {
    type: Number,
    default: 0,
  },
  lockUntil: {
    type: Date,
    default: null,
  },
  lastLoginAttempt: {
    type: Date,
    default: null,
  },
  
  // ===== Password Security Fields =====
  passwordHistory: {
    type: [String], // Array of hashed passwords (last 5)
    default: [],
  },
  passwordChangedAt: {
    type: Date,
    default: Date.now,
  },
  passwordExpiryWarned: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true // Adds createdAt and updatedAt timestamps
});

// Virtual field to check if account is currently locked
userSchema.virtual('isLocked').get(function() {
  // Check if lockUntil exists and is in the future
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Method to increment login attempts and lock account if necessary
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1, lastLoginAttempt: Date.now() },
      $unset: { lockUntil: 1 }
    });
  }
  
  // Otherwise increment attempts
  const updates = {
    $inc: { loginAttempts: 1 },
    $set: { lastLoginAttempt: Date.now() }
  };
  
  // Lock account after 5 failed attempts (15 minutes lockout)
  const maxAttempts = 5;
  const lockTime = 15 * 60 * 1000; // 15 minutes in milliseconds
  
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set.lockUntil = Date.now() + lockTime;
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts after successful login
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $set: { loginAttempts: 0, lastLoginAttempt: Date.now() },
    $unset: { lockUntil: 1 }
  });
};

// ===== Password Security Methods =====

// Method to add password to history (keep last 5)
userSchema.methods.addPasswordToHistory = async function(hashedPassword) {
  // Add current password to history
  this.passwordHistory.unshift(hashedPassword);
  
  // Keep only last 5 passwords
  if (this.passwordHistory.length > 5) {
    this.passwordHistory = this.passwordHistory.slice(0, 5);
  }
  
  // Update password changed timestamp
  this.passwordChangedAt = Date.now();
  this.passwordExpiryWarned = false;
  
  await this.save();
};

// Method to check if password exists in history
userSchema.methods.checkPasswordInHistory = async function(password) {
  const bcrypt = await import('bcrypt');
  
  for (const hashedPassword of this.passwordHistory) {
    const isMatch = await bcrypt.default.compare(password, hashedPassword);
    if (isMatch) {
      return true; // Password found in history
    }
  }
  
  return false; // Password not in history
};

// Virtual field to check if password is expired (90 days)
userSchema.virtual('isPasswordExpired').get(function() {
  if (!this.passwordChangedAt) return false;
  
  const daysSinceChange = Math.floor((Date.now() - this.passwordChangedAt) / (1000 * 60 * 60 * 24));
  return daysSinceChange >= 90;
});

// Virtual field to get days until password expiry
userSchema.virtual('daysUntilPasswordExpiry').get(function() {
  if (!this.passwordChangedAt) return 90;
  
  const daysSinceChange = Math.floor((Date.now() - this.passwordChangedAt) / (1000 * 60 * 60 * 24));
  const daysRemaining = 90 - daysSinceChange;
  
  return daysRemaining > 0 ? daysRemaining : 0;
});

// Ensure virtuals are included when converting to JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

const User = mongoose.model("User", userSchema);

export default User;