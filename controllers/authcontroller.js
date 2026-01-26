// backend/controllers/authController.js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/user.js';
import { verify2FA } from './twoFactorController.js';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendAccountLockedEmail,
} from '../utils/emailService.js';
import { logCustomEvent } from '../middleware/auditLogger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key';

// ===== SIGNUP WITH EMAIL VERIFICATION =====
export const signup = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const lowercasedEmail = email.toLowerCase();
    const existingUser = await User.findOne({ email: lowercasedEmail });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists with this email." });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = Date.now() + 3600000; // 1 hour

    // Assign role based on email
    const role = lowercasedEmail === 'admin@example.com' ? 'admin' : 'user';

    const newUser = new User({
      name,
      email: lowercasedEmail,
      password: hashedPassword,
      role,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
      isEmailVerified: false,
    });

    await newUser.save();

    // Send verification email
    await sendVerificationEmail(lowercasedEmail, name, verificationToken);

    console.log(`[SIGNUP] User ${lowercasedEmail} registered. Verification email sent.`);
    res.status(201).json({
      message: "Registration successful! Please check your email to verify your account.",
      emailSent: true,
    });

    // Log custom audit event
    await logCustomEvent({
      action: 'USER_CREATED',
      userId: newUser._id,
      resource: 'POST /api/auth/signup',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS',
      metadata: {
        email: lowercasedEmail,
        name: name,
        role: role
      },
      severity: 'LOW'
    });

  } catch (error) {
    console.error("Signup Error:", error);
    return res.status(500).json({ message: "Server error during registration." });
  }
};

// ===== VERIFY EMAIL =====
export const verifyEmail = async (req, res) => {
  const { token } = req.params;

  try {
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired verification token.",
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    console.log(`[EMAIL VERIFICATION] User ${user.email} verified successfully.`);
    res.status(200).json({
      message: "Email verified successfully! You can now log in.",
    });

    // Log custom audit event
    await logCustomEvent({
      action: 'EMAIL_VERIFICATION',
      userId: user._id,
      resource: 'GET /api/auth/verify-email/:token',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS',
      metadata: {
        email: user.email
      },
      severity: 'LOW'
    });

  } catch (error) {
    console.error("Email Verification Error:", error);
    res.status(500).json({ message: "Server error during email verification." });
  }
};

// ===== RESEND VERIFICATION EMAIL =====
export const resendVerificationEmail = async (req, res) => {
  const { email } = req.body;

  try {
    const lowercasedEmail = email.toLowerCase();
    const user = await User.findOne({ email: lowercasedEmail });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ message: "Email is already verified." });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = Date.now() + 3600000; // 1 hour

    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = verificationExpires;
    await user.save();

    // Send verification email
    await sendVerificationEmail(lowercasedEmail, user.name, verificationToken);

    res.status(200).json({
      message: "Verification email sent successfully.",
    });

  } catch (error) {
    console.error("Resend Verification Error:", error);
    res.status(500).json({ message: "Server error." });
  }
};

// ===== LOGIN WITH BRUTE-FORCE PROTECTION AND 2FA =====
export const login = async (req, res) => {
  const { email, password, twoFactorToken } = req.body;

  try {
    const lowercasedEmail = email.toLowerCase();
    const user = await User.findOne({ email: lowercasedEmail });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Check if account is locked
    if (user.isLocked) {
      const lockTimeRemaining = Math.ceil((user.lockUntil - Date.now()) / 60000);

      // Send lockout email if not already sent recently
      if (!user.lastLoginAttempt || (Date.now() - user.lastLoginAttempt) > 60000) {
        await sendAccountLockedEmail(user.email, user.name, 15);
      }

      // Log account lockout event
      await logCustomEvent({
        action: 'ACCOUNT_LOCKED',
        userId: user._id,
        resource: 'POST /api/auth/login',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        result: 'BLOCKED',
        metadata: {
          email: user.email,
          lockTimeRemaining,
          loginAttempts: user.loginAttempts
        },
        severity: 'HIGH'
      });

      return res.status(423).json({
        message: `Account is locked due to multiple failed login attempts. Please try again in ${lockTimeRemaining} minutes.`,
        locked: true,
        lockTimeRemaining,
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in.",
        emailNotVerified: true,
      });
    }

    // Check if password is expired
    if (user.isPasswordExpired) {
      return res.status(403).json({
        message: "Your password has expired. Please change your password to continue.",
        passwordExpired: true,
        requiresPasswordChange: true,
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Increment failed login attempts
      await user.incLoginAttempts();

      const updatedUser = await User.findById(user._id);
      const remainingAttempts = 5 - updatedUser.loginAttempts;

      return res.status(400).json({
        message: "Invalid credentials.",
        remainingAttempts: remainingAttempts > 0 ? remainingAttempts : 0,
        requireCaptcha: updatedUser.loginAttempts >= 3,
      });
    }

    // Fix role if missing
    let userRole = user.role;
    if (!userRole) {
      console.log(`[LOGIN] User ${user.email} found without a role. Fixing now.`);
      userRole = lowercasedEmail === 'admin@example.com' ? 'admin' : 'user';
      user.role = userRole;
      await user.save();
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      // If 2FA token not provided, request it
      if (!twoFactorToken) {
        return res.status(200).json({
          message: "2FA required",
          require2FA: true,
          userId: user._id, // Temporary ID for 2FA verification
        });
      }

      // Verify 2FA token
      const verification = await verify2FA(user._id, twoFactorToken);
      if (!verification.success) {
        return res.status(400).json({
          message: verification.message,
          require2FA: true,
        });
      }

      // If backup code was used, inform user
      if (verification.backupCodeUsed) {
        console.log(`[LOGIN] User ${user.email} used backup code. Remaining: ${verification.remainingBackupCodes}`);
      }
    }

    // Reset login attempts after successful login
    await user.resetLoginAttempts();

    // Create session instead of JWT token
    req.session.userId = user._id;
    req.session.email = user.email;
    req.session.role = userRole;
    req.session.lastActivity = Date.now();

    // Regenerate session ID to prevent session fixation
    req.session.regenerate((err) => {
      if (err) {
        console.error('[LOGIN] Session regeneration error:', err);
        return res.status(500).json({ message: 'Server error during login.' });
      }

      // Re-set session data after regeneration
      req.session.userId = user._id;
      req.session.email = user.email;
      req.session.role = userRole;
      req.session.lastActivity = Date.now();

      const sessionExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

      const responseData = {
        message: "Login successful",
        sessionExpiry: sessionExpiry.toISOString(),
        user: {
          email: user.email,
          name: user.name,
          role: userRole,
          twoFactorEnabled: user.twoFactorEnabled,
        }
      };

      console.log(`[LOGIN] User ${user.email} logged in successfully. Role: '${userRole}', Session ID: ${req.session.id}`);
      return res.status(200).json(responseData);
    });

  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ message: "Server error during login." });
  }
};

// ===== REQUEST PASSWORD RESET =====
export const requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  try {
    const lowercasedEmail = email.toLowerCase();
    const user = await User.findOne({ email: lowercasedEmail });

    // Don't reveal if user exists or not (security best practice)
    if (!user) {
      return res.status(200).json({
        message: "If an account with that email exists, a password reset link has been sent.",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = Date.now() + 3600000; // 1 hour

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetExpires;
    await user.save();

    // Send reset email
    await sendPasswordResetEmail(lowercasedEmail, user.name, resetToken);

    console.log(`[PASSWORD RESET] Reset email sent to ${lowercasedEmail}`);
    res.status(200).json({
      message: "If an account with that email exists, a password reset link has been sent.",
    });

  } catch (error) {
    console.error("Request Password Reset Error:", error);
    res.status(500).json({ message: "Server error." });
  }
};

// ===== VERIFY RESET TOKEN =====
export const verifyResetToken = async (req, res) => {
  const { token } = req.params;

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired reset token.",
        valid: false,
      });
    }

    res.status(200).json({
      message: "Token is valid.",
      valid: true,
    });

  } catch (error) {
    console.error("Verify Reset Token Error:", error);
    res.status(500).json({ message: "Server error." });
  }
};

// ===== RESET PASSWORD =====
export const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired reset token.",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    user.passwordChangedAt = new Date(); // Update password change timestamp
    user.passwordExpiryWarned = false; // Reset warning flag
    await user.save();

    // Send confirmation email
    await sendPasswordChangedEmail(user.email, user.name);

    console.log(`[PASSWORD RESET] Password reset successful for ${user.email}`);
    res.status(200).json({
      message: "Password reset successful. You can now log in with your new password.",
    });

  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ message: "Server error." });
  }
};

// ===== UNLOCK ACCOUNT (Admin only) =====
export const unlockAccount = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    await user.resetLoginAttempts();

    console.log(`[UNLOCK ACCOUNT] Account unlocked for ${user.email}`);
    res.status(200).json({
      message: "Account unlocked successfully.",
    });

  } catch (error) {
    console.error("Unlock Account Error:", error);
    res.status(500).json({ message: "Server error." });
  }
};

// ===== LOGOUT =====
export const logout = async (req, res) => {
  try {
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('[LOGOUT] Error destroying session:', err);
          return res.status(500).json({ message: 'Error logging out.' });
        }

        res.clearCookie('sessionId'); // Clear the session cookie
        console.log('[LOGOUT] User logged out successfully');
        return res.status(200).json({ message: 'Logged out successfully' });
      });
    } else {
      return res.status(200).json({ message: 'No active session' });
    }
  } catch (error) {
    console.error('[LOGOUT] Error:', error);
    return res.status(500).json({ message: 'Server error during logout.' });
  }
};

// ===== REFRESH SESSION =====
export const refreshSession = async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        message: 'No active session',
        sessionExpired: true
      });
    }

    // Update last activity timestamp
    req.session.lastActivity = Date.now();
    const sessionExpiry = new Date(Date.now() + 30 * 60 * 1000);

    console.log(`[SESSION REFRESH] Session refreshed for user ${req.session.email}`);
    return res.status(200).json({
      message: 'Session refreshed',
      sessionExpiry: sessionExpiry.toISOString()
    });
  } catch (error) {
    console.error('[SESSION REFRESH] Error:', error);
    return res.status(500).json({ message: 'Server error during session refresh.' });
  }
};

export default {
  signup,
  login,
  logout,
  refreshSession,
  verifyEmail,
  resendVerificationEmail,
  requestPasswordReset,
  verifyResetToken,
  resetPassword,
  unlockAccount,
};