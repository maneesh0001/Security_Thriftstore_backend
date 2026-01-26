// backend/routes/userRoutes.js
import express from 'express';
import {
    getAllUsers,
    getUserStats,
    getUserById,
    updateUser,
    deleteUser,
    updateUserRole,
    toggleUserLock,
} from '../controllers/userController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication and admin role
router.use(protect);
router.use(admin);

// Get user statistics
router.get('/stats', getUserStats);

// Get all users (with pagination and filters)
router.get('/', getAllUsers);

// Get user by ID
router.get('/:id', getUserById);

// Update user
router.put('/:id', updateUser);

// Delete user
router.delete('/:id', deleteUser);

// Update user role
router.put('/:id/role', updateUserRole);

// Toggle user lock status
router.put('/:id/lock', toggleUserLock);

export default router;
