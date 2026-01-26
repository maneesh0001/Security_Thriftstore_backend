// backend/routes/paymentRoutes.js
import express from 'express';
import {
    initiateKhaltiPayment,
    verifyKhaltiPayment,
    testOrderCreation,
    getPaymentHistory,
    getAllPayments,
    getPaymentById,
} from '../controllers/paymentController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Khalti payment routes
router.post('/khalti/initiate', protect, initiateKhaltiPayment);
router.post('/khalti/verify', protect, verifyKhaltiPayment);

// Debug route
router.post('/test-order', protect, testOrderCreation);

// Payment history routes
router.get('/history', protect, getPaymentHistory);
router.get('/all', protect, admin, getAllPayments);
router.get('/:id', protect, getPaymentById);

export default router;
