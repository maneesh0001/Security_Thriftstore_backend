import express from 'express';
import {
    createBooking,
    getUserBookings,
    getAllBookings
} from '../controllers/bookingController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// User routes
router.route('/')
    .get(protect, getUserBookings)
    .post(protect, createBooking);

// Admin routes
router.route('/all')
    .get(protect, admin, getAllBookings);

export default router;
