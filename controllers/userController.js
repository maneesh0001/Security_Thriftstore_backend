// backend/controllers/userController.js
import User from '../models/user.js';

// Get all users with pagination and filters
export const getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', role = '', verified = '' } = req.query;

        // Build query
        const query = {};

        // Search by name or email
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }

        // Filter by role
        if (role) {
            query.role = role;
        }

        // Filter by verification status
        if (verified !== '') {
            query.isEmailVerified = verified === 'true';
        }

        // Execute query with pagination
        const users = await User.find(query)
            .select('-password -passwordHistory -twoFactorSecret -backupCodes -emailVerificationToken -resetPasswordToken')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const count = await User.countDocuments(query);

        res.status(200).json({
            users,
            pagination: {
                total: count,
                page: parseInt(page),
                pages: Math.ceil(count / limit),
                limit: parseInt(limit),
            },
        });
    } catch (error) {
        console.error('Get All Users Error:', error);
        res.status(500).json({ message: 'Error fetching users' });
    }
};

// Get user statistics
export const getUserStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isEmailVerified: true });
        const adminUsers = await User.countDocuments({ role: 'admin' });
        const lockedUsers = await User.countDocuments({ lockUntil: { $gt: Date.now() } });

        res.status(200).json({
            totalUsers,
            activeUsers,
            adminUsers,
            lockedUsers,
        });
    } catch (error) {
        console.error('Get User Stats Error:', error);
        res.status(500).json({ message: 'Error fetching user statistics' });
    }
};

// Get user by ID
export const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id)
            .select('-password -passwordHistory -twoFactorSecret -backupCodes -emailVerificationToken -resetPasswordToken');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({ user });
    } catch (error) {
        console.error('Get User By ID Error:', error);
        res.status(500).json({ message: 'Error fetching user' });
    }
};

// Update user
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email } = req.body;

        // Prevent admin from updating their own account to avoid lockout
        if (req.user._id.toString() === id && req.body.role && req.body.role !== 'admin') {
            return res.status(400).json({ message: 'You cannot change your own role' });
        }

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update fields
        if (name) user.name = name;
        if (email) user.email = email.toLowerCase();

        await user.save();

        console.log(`[USER UPDATE] User ${user.email} updated by admin ${req.user.email}`);
        res.status(200).json({
            message: 'User updated successfully',
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('Update User Error:', error);
        res.status(500).json({ message: 'Error updating user' });
    }
};

// Delete user
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Prevent admin from deleting their own account
        if (req.user._id.toString() === id) {
            return res.status(400).json({ message: 'You cannot delete your own account' });
        }

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if this is the last admin
        if (user.role === 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin' });
            if (adminCount <= 1) {
                return res.status(400).json({ message: 'Cannot delete the last admin user' });
            }
        }

        await User.findByIdAndDelete(id);

        console.log(`[USER DELETE] User ${user.email} deleted by admin ${req.user.email}`);
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete User Error:', error);
        res.status(500).json({ message: 'Error deleting user' });
    }
};

// Update user role
export const updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role. Must be "user" or "admin"' });
        }

        // Prevent admin from changing their own role
        if (req.user._id.toString() === id) {
            return res.status(400).json({ message: 'You cannot change your own role' });
        }

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if demoting the last admin
        if (user.role === 'admin' && role === 'user') {
            const adminCount = await User.countDocuments({ role: 'admin' });
            if (adminCount <= 1) {
                return res.status(400).json({ message: 'Cannot demote the last admin user' });
            }
        }

        user.role = role;
        await user.save();

        console.log(`[ROLE UPDATE] User ${user.email} role changed to ${role} by admin ${req.user.email}`);
        res.status(200).json({
            message: `User role updated to ${role}`,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('Update User Role Error:', error);
        res.status(500).json({ message: 'Error updating user role' });
    }
};

// Toggle user lock status
export const toggleUserLock = async (req, res) => {
    try {
        const { id } = req.params;
        const { locked, lockDuration = 15 } = req.body;

        // Prevent admin from locking their own account
        if (req.user._id.toString() === id) {
            return res.status(400).json({ message: 'You cannot lock your own account' });
        }

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (locked) {
            // Lock the account
            user.lockUntil = Date.now() + lockDuration * 60 * 1000;
            user.loginAttempts = 5; // Set to max attempts
        } else {
            // Unlock the account
            await user.resetLoginAttempts();
        }

        await user.save();

        console.log(`[USER LOCK] User ${user.email} ${locked ? 'locked' : 'unlocked'} by admin ${req.user.email}`);
        res.status(200).json({
            message: `User ${locked ? 'locked' : 'unlocked'} successfully`,
            locked: user.isLocked,
        });
    } catch (error) {
        console.error('Toggle User Lock Error:', error);
        res.status(500).json({ message: 'Error toggling user lock status' });
    }
};

export default {
    getAllUsers,
    getUserStats,
    getUserById,
    updateUser,
    deleteUser,
    updateUserRole,
    toggleUserLock,
};
