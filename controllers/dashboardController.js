// controllers/dashboardController.js
import Order from '../models/order.js';
import User from '../models/user.js';
import Product from '../models/product.js';

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard/stats
// @access  Private/Admin
export const getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Total Revenue
    const totalRevenue = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);

    // Last month revenue for comparison
    const lastMonthRevenue = await Order.aggregate([
      { 
        $match: { 
          status: { $ne: 'cancelled' },
          orderDate: { $gte: lastMonth, $lt: thisMonth }
        } 
      },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);

    // This month revenue
    const thisMonthRevenue = await Order.aggregate([
      { 
        $match: { 
          status: { $ne: 'cancelled' },
          orderDate: { $gte: thisMonth }
        } 
      },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);

    // New customers
    const totalCustomers = await User.countDocuments({ role: 'user' });
    const newCustomers = await User.countDocuments({ 
      role: 'user', 
      createdAt: { $gte: thisMonth } 
    });
    const lastMonthNewCustomers = await User.countDocuments({ 
      role: 'user', 
      createdAt: { $gte: lastMonth, $lt: thisMonth } 
    });

    // Total orders
    const totalOrders = await Order.countDocuments();
    const thisMonthOrders = await Order.countDocuments({ 
      orderDate: { $gte: thisMonth } 
    });
    const lastMonthOrders = await Order.countDocuments({ 
      orderDate: { $gte: lastMonth, $lt: thisMonth } 
    });

    // Pending orders
    const pendingOrders = await Order.countDocuments({ status: 'pending' });

    // Calculate percentage changes
    const revenueChange = lastMonthRevenue[0]?.total > 0 
      ? ((thisMonthRevenue[0]?.total || 0) - lastMonthRevenue[0].total) / lastMonthRevenue[0].total * 100
      : 0;

    const customersChange = lastMonthNewCustomers > 0
      ? ((newCustomers - lastMonthNewCustomers) / lastMonthNewCustomers) * 100
      : 0;

    const ordersChange = lastMonthOrders > 0
      ? ((thisMonthOrders - lastMonthOrders) / lastMonthOrders) * 100
      : 0;

    const pendingChange = 5.7; // Placeholder - you can calculate this based on historical data

    res.status(200).json({
      totalRevenue: {
        value: totalRevenue[0]?.total || 0,
        change: revenueChange.toFixed(1),
        changeType: revenueChange >= 0 ? 'positive' : 'negative'
      },
      newCustomers: {
        value: newCustomers,
        change: customersChange.toFixed(1),
        changeType: customersChange >= 0 ? 'positive' : 'negative'
      },
      totalOrders: {
        value: totalOrders,
        change: ordersChange.toFixed(1),
        changeType: ordersChange >= 0 ? 'positive' : 'negative'
      },
      pendingOrders: {
        value: pendingOrders,
        change: pendingChange.toFixed(1),
        changeType: 'positive'
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error: ' + err.message });
  }
};

// @desc    Get recent orders for dashboard
// @route   GET /api/admin/orders/recent
// @access  Private/Admin
export const getRecentOrders = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    
    const orders = await Order.find()
      .populate('items.product', 'name image')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.status(200).json({ orders });
  } catch (err) {
    res.status(500).json({ message: 'Server Error: ' + err.message });
  }
};

// @desc    Get sales data for charts
// @route   GET /api/admin/sales/data
// @access  Private/Admin
export const getSalesData = async (req, res) => {
  try {
    const period = req.query.period || '6months';
    const months = period === '6months' ? 6 : 12;
    
    const monthlyData = await Order.aggregate([
      {
        $match: {
          status: { $ne: 'cancelled' },
          orderDate: { $gte: new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$orderDate" } },
          revenue: { $sum: "$total" },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({ monthlyData });
  } catch (err) {
    res.status(500).json({ message: 'Server Error: ' + err.message });
  }
};

// @desc    Get sales by category
// @route   GET /api/admin/sales/by-category
// @access  Private/Admin
export const getCategorySales = async (req, res) => {
  try {
    const categorySales = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: '$product.category',
          revenue: { $sum: '$items.subtotal' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    const categories = categorySales.map(cat => ({
      name: cat._id || 'Uncategorized',
      value: cat.revenue,
      orders: cat.orders
    }));

    res.status(200).json({ categories });
  } catch (err) {
    res.status(500).json({ message: 'Server Error: ' + err.message });
  }
};

// @desc    Get stock alerts
// @route   GET /api/admin/inventory/alerts
// @access  Private/Admin
export const getStockAlerts = async (req, res) => {
  try {
    const lowStockProducts = await Product.find({ 
      stock: { $lte: 10 } 
    }).select('name stock category image');

    const alerts = lowStockProducts.map(product => ({
      id: product._id,
      productName: product.name,
      currentStock: product.stock,
      category: product.category,
      image: product.image,
      alertType: product.stock <= 5 ? 'critical' : 'low'
    }));

    res.status(200).json({ alerts });
  } catch (err) {
    res.status(500).json({ message: 'Server Error: ' + err.message });
  }
};
