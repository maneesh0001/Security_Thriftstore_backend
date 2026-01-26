// backend/controllers/twoFactorController.js
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/user.js';
import { sendTwoFactorEnabledEmail } from '../utils/emailService.js';

// Generate 2FA secret and QR code
export const setup2FA = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.twoFactorEnabled) {
            return res.status(400).json({ message: '2FA is already enabled for this account' });
        }

        // Generate a secret for the user
        const secret = speakeasy.generateSecret({
            name: `Thrift Store (${user.email})`,
            issuer: 'Thrift Store',
            length: 32,
        });

        // Store temporary secret (not enabled yet)
        user.twoFactorTempSecret = secret.base32;
        await user.save();

        // Generate QR code
        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

        res.status(200).json({
            message: '2FA setup initiated',
            qrCode: qrCodeUrl,
            secret: secret.base32,
            manualEntryKey: secret.base32,
        });
    } catch (error) {
        console.error('Setup 2FA Error:', error);
        res.status(500).json({ message: 'Error setting up 2FA' });
    }
};

// Enable 2FA after verifying token
export const enable2FA = async (req, res) => {
    try {
        const userId = req.user._id;
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ message: 'Verification token is required' });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.twoFactorTempSecret) {
            return res.status(400).json({ message: 'Please setup 2FA first' });
        }

        // Verify the token
        const verified = speakeasy.totp.verify({
            secret: user.twoFactorTempSecret,
            encoding: 'base32',
            token: token,
            window: 2, // Allow 2 time steps before/after for clock skew
        });

        if (!verified) {
            return res.status(400).json({ message: 'Invalid verification code' });
        }

        // Generate backup codes
        const backupCodes = [];
        for (let i = 0; i < 10; i++) {
            const code = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
            backupCodes.push(code);
        }

        // Hash backup codes before storing
        const hashedBackupCodes = await Promise.all(
            backupCodes.map(code => bcrypt.hash(code, 10))
        );

        // Enable 2FA
        user.twoFactorSecret = user.twoFactorTempSecret;
        user.twoFactorEnabled = true;
        user.twoFactorTempSecret = null;
        user.backupCodes = hashedBackupCodes;
        await user.save();

        // Send confirmation email
        await sendTwoFactorEnabledEmail(user.email, user.name);

        res.status(200).json({
            message: '2FA enabled successfully',
            backupCodes: backupCodes, // Send plain codes to user (only time they'll see them)
        });
    } catch (error) {
        console.error('Enable 2FA Error:', error);
        res.status(500).json({ message: 'Error enabling 2FA' });
    }
};

// Disable 2FA
export const disable2FA = async (req, res) => {
    try {
        const userId = req.user._id;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ message: 'Password is required to disable 2FA' });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.twoFactorEnabled) {
            return res.status(400).json({ message: '2FA is not enabled for this account' });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        // Disable 2FA
        user.twoFactorSecret = null;
        user.twoFactorEnabled = false;
        user.twoFactorTempSecret = null;
        user.backupCodes = [];
        await user.save();

        res.status(200).json({ message: '2FA disabled successfully' });
    } catch (error) {
        console.error('Disable 2FA Error:', error);
        res.status(500).json({ message: 'Error disabling 2FA' });
    }
};

// Generate new backup codes
export const generateBackupCodes = async (req, res) => {
    try {
        const userId = req.user._id;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ message: 'Password is required' });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.twoFactorEnabled) {
            return res.status(400).json({ message: '2FA is not enabled for this account' });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        // Generate new backup codes
        const backupCodes = [];
        for (let i = 0; i < 10; i++) {
            const code = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
            backupCodes.push(code);
        }

        // Hash backup codes before storing
        const hashedBackupCodes = await Promise.all(
            backupCodes.map(code => bcrypt.hash(code, 10))
        );

        user.backupCodes = hashedBackupCodes;
        await user.save();

        res.status(200).json({
            message: 'Backup codes regenerated successfully',
            backupCodes: backupCodes,
        });
    } catch (error) {
        console.error('Generate Backup Codes Error:', error);
        res.status(500).json({ message: 'Error generating backup codes' });
    }
};

// Verify 2FA token or backup code
export const verify2FA = async (userId, token) => {
    try {
        const user = await User.findById(userId);

        if (!user || !user.twoFactorEnabled) {
            return { success: false, message: '2FA not enabled' };
        }

        // First, try to verify as TOTP token
        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: token,
            window: 2,
        });

        if (verified) {
            return { success: true, message: 'Token verified' };
        }

        // If TOTP fails, check if it's a backup code
        for (let i = 0; i < user.backupCodes.length; i++) {
            const isMatch = await bcrypt.compare(token, user.backupCodes[i]);
            if (isMatch) {
                // Remove used backup code
                user.backupCodes.splice(i, 1);
                await user.save();
                return {
                    success: true,
                    message: 'Backup code verified',
                    backupCodeUsed: true,
                    remainingBackupCodes: user.backupCodes.length
                };
            }
        }

        return { success: false, message: 'Invalid verification code' };
    } catch (error) {
        console.error('Verify 2FA Error:', error);
        return { success: false, message: 'Error verifying 2FA' };
    }
};

// Get 2FA status
export const get2FAStatus = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId).select('twoFactorEnabled backupCodes');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({
            twoFactorEnabled: user.twoFactorEnabled,
            backupCodesCount: user.backupCodes ? user.backupCodes.length : 0,
        });
    } catch (error) {
        console.error('Get 2FA Status Error:', error);
        res.status(500).json({ message: 'Error getting 2FA status' });
    }
};

export default {
    setup2FA,
    enable2FA,
    disable2FA,
    generateBackupCodes,
    verify2FA,
    get2FAStatus,
};
