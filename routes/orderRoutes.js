import express from 'express';
import {
  getAllOrders,
  createOrder,
  updateOrder,
  deleteOrder,
  getMyOrders,
  getOrderById,
  getOrderStats,
  updateOrderStatus,
  cancelOrder,
  trackOrder
} from '../controllers/orderController.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { protectWithPasswordExpiry } from '../middleware/enhancedAuthMiddleware.js';

const router = express.Router();

// Basic CRUD routes
router.route('/')
  .get(protect, admin, getAllOrders)
  .post(protect, createOrder);

router.get('/myorders', protectWithPasswordExpiry, getMyOrders);
router.get('/stats', protectWithPasswordExpiry, admin, getOrderStats);

// Order management routes
router.route('/:id')
  .get(protect, getOrderById)
  .put(protect, admin, updateOrder)
  .delete(protect, admin, deleteOrder);

// Enhanced order functionality
router.patch('/:id/status', protect, admin, updateOrderStatus);
router.patch('/:id/cancel', protect, cancelOrder);
router.get('/:id/track', protect, trackOrder);

export default router;
