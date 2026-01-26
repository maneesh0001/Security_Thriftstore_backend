// backend/controllers/passwordController.js
import zxcvbn from 'zxcvbn';
import bcrypt from 'bcrypt';
import User from '../models/user.js';
import { sendPasswordChangedEmail, sendPasswordExpiryWarningEmail } from '../utils/emailService.js';

// Check password strength (public endpoint for real-time feedback)
export const checkPasswordStrength = async (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ message: 'Password is required' });
        }

        const result = zxcvbn(password);

        res.status(200).json({
            score: result.score, // 0-4
            feedback: {
                warning: result.feedback.warning || '',
                suggestions: result.feedback.suggestions || [],
            },
            crackTime: result.crack_times_display.offline_slow_hashing_1e4_per_second,
            strength: getStrengthLabel(result.score),
        });
    } catch (error) {
        console.error('Check Password Strength Error:', error);
        res.status(500).json({ message: 'Error checking password strength' });
    }
};

// Helper function to get strength label
const getStrengthLabel = (score) => {
    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    return labels[score] || 'Unknown';
};

// Change password with history and complexity checks
export const changePassword = async (req, res) => {
    try {
        const userId = req.user._id;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                message: 'Current password and new password are required',
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        // Check if new password is in history
        const isInHistory = await user.checkPasswordInHistory(newPassword);
        if (isInHistory) {
            return res.status(400).json({
                message: 'You cannot reuse any of your last 5 passwords. Please choose a different password.',
                passwordInHistory: true,
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Add old password to history before updating
        await user.addPasswordToHistory(user.password);

        // Update password
        user.password = hashedPassword;
        user.passwordChangedAt = new Date(); // Update password change timestamp
        user.passwordExpiryWarned = false; // Reset warning flag
        await user.save();

        // Send confirmation email
        await sendPasswordChangedEmail(user.email, user.name);

        console.log(`[PASSWORD CHANGE] Password changed successfully for ${user.email}`);
        res.status(200).json({
            message: 'Password changed successfully',
            passwordStrength: req.passwordStrength, // From middleware
        });
    } catch (error) {
        console.error('Change Password Error:', error);
        res.status(500).json({ message: 'Error changing password' });
    }
};

// Check password expiry status
export const checkPasswordExpiry = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isExpired = user.isPasswordExpired;
        const daysRemaining = user.daysUntilPasswordExpiry;

        // Send warning email if password expires in 7 days and not warned yet
        if (daysRemaining <= 7 && daysRemaining > 0 && !user.passwordExpiryWarned) {
            await sendPasswordExpiryWarningEmail(user.email, user.name, daysRemaining);
            user.passwordExpiryWarned = true;
            await user.save();
        }

        res.status(200).json({
            isExpired,
            daysRemaining,
            passwordChangedAt: user.passwordChangedAt,
            requiresChange: isExpired,
        });
    } catch (error) {
        console.error('Check Password Expiry Error:', error);
        res.status(500).json({ message: 'Error checking password expiry' });
    }
};

export default {
    checkPasswordStrength,
    changePassword,
    checkPasswordExpiry,
};
