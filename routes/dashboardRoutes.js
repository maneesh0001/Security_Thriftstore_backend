// routes/dashboardRoutes.js
import express from 'express';
import {
  getDashboardStats,
  getRecentOrders,
  getSalesData,
  getCategorySales,
  getStockAlerts
} from '../controllers/dashboardController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// All dashboard routes require admin authentication
router.use(protect);
router.use(admin);

router.get('/stats', getDashboardStats);
router.get('/orders/recent', getRecentOrders);
router.get('/sales/data', getSalesData);
router.get('/sales/by-category', getCategorySales);
router.get('/inventory/alerts', getStockAlerts);

export default router;
