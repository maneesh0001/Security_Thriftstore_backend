// controllers/orderController.js
import Order from '../models/order.js';

// @desc    Fetch all orders with advanced filtering
// @route   GET /api/orders
// @access  Private/Admin
export const getAllOrders = async (req, res) => {
  try {
    const { 
      status, 
      paymentStatus, 
      orderType, 
      priority,
      startDate, 
      endDate,
      page = 1, 
      limit = 10 
    } = req.query;

    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (orderType) filter.orderType = orderType;
    if (priority) filter.priority = priority;
    
    // Date range filter
    if (startDate || endDate) {
      filter.orderDate = {};
      if (startDate) filter.orderDate.$gte = new Date(startDate);
      if (endDate) filter.orderDate.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    
    const orders = await Order.find(filter)
      .populate('items.product', 'name price image')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(filter);

    res.status(200).json({
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalOrders: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error: ' + err.message });
  }
};

// @desc    Get order statistics
// @route   GET /api/orders/stats
// @access  Private/Admin
export const getOrderStats = async (req, res) => {
  try {
    const stats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$total' }
        }
      }
    ]);

    const paymentStats = await Order.aggregate([
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    const dailyStats = await Order.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
          orders: { $sum: 1 },
          revenue: { $sum: "$total" }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 30 }
    ]);

    res.status(200).json({
      statusStats: stats,
      paymentStats,
      dailyStats
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error: ' + err.message });
  }
};

// @desc    Update order status
// @route   PATCH /api/orders/:id/status
// @access  Private/Admin
export const updateOrderStatus = async (req, res) => {
  try {
    const { status, trackingNumber, notes } = req.body;
    const { id } = req.params;

    const updateData = { status };
    
    // Add timestamps based on status
    if (status === 'confirmed') updateData.confirmedAt = new Date();
    if (status === 'processing') updateData.processedAt = new Date();
    if (status === 'shipped') {
      updateData.shippedAt = new Date();
      if (trackingNumber) updateData.trackingNumber = trackingNumber;
    }
    if (status === 'delivered') updateData.deliveredAt = new Date();
    if (status === 'cancelled') updateData.cancelledAt = new Date();

    if (notes) updateData.internalNotes = notes;

    const order = await Order.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true }
    ).populate('items.product user', 'name email');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.status(200).json({
      message: 'Order status updated successfully',
      order
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error: ' + err.message });
  }
};

// @desc    Cancel order
// @route   PATCH /api/orders/:id/cancel
// @access  Private
export const cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const { id } = req.params;

    const order = await Order.findOne({
      _id: id,
      user: req.user._id
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if order can be cancelled
    if (['shipped', 'delivered'].includes(order.status)) {
      return res.status(400).json({ 
        message: 'Order cannot be cancelled at this stage' 
      });
    }

    order.status = 'cancelled';
    order.cancellationReason = reason;
    order.cancelledAt = new Date();

    await order.save();

    res.status(200).json({
      message: 'Order cancelled successfully',
      order
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error: ' + err.message });
  }
};

// @desc    Track order
// @route   GET /api/orders/:id/track
// @access  Private
export const trackOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({
      _id: id,
      user: req.user._id
    }).populate('items.product', 'name image');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Create timeline
    const timeline = [
      {
        status: 'pending',
        title: 'Order Placed',
        date: order.orderDate,
        completed: true
      }
    ];

    if (order.confirmedAt) {
      timeline.push({
        status: 'confirmed',
        title: 'Order Confirmed',
        date: order.confirmedAt,
        completed: true
      });
    }

    if (order.processedAt) {
      timeline.push({
        status: 'processing',
        title: 'Processing',
        date: order.processedAt,
        completed: true
      });
    }

    if (order.shippedAt) {
      timeline.push({
        status: 'shipped',
        title: 'Shipped',
        date: order.shippedAt,
        completed: true,
        trackingNumber: order.trackingNumber
      });
    }

    if (order.deliveredAt) {
      timeline.push({
        status: 'delivered',
        title: 'Delivered',
        date: order.deliveredAt,
        completed: true
      });
    }

    if (order.cancelledAt) {
      timeline.push({
        status: 'cancelled',
        title: 'Cancelled',
        date: order.cancelledAt,
        completed: true,
        reason: order.cancellationReason
      });
    }

    res.status(200).json({
      order,
      timeline,
      currentStatus: order.status,
      trackingNumber: order.trackingNumber,
      estimatedDelivery: order.estimatedDelivery
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error: ' + err.message });
  }
};

// @desc    Create a new order with enhanced features
// @route   POST /api/orders
// @access  Private
export const createOrder = async (req, res) => {
    try {
        const { 
            items, 
            subtotal,
            tax = 0,
            shipping = 0,
            discount = 0,
            total, 
            customerName, 
            paymentMethod,
            shippingAddress,
            billingAddress,
            orderType = 'standard',
            notes,
            couponCode
        } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ message: 'No order items' });
        }

        // Calculate total if not provided
        const calculatedTotal = (subtotal || 0) + tax + shipping - discount;
        
        const order = new Order({
            user: req.user._id,
            customerName: customerName || req.user.name,
            items: items.map(item => ({
                product: item.product || item._id || item.id,
                quantity: item.quantity || 1,
                price: item.price || 0,
                subtotal: (item.price || 0) * (item.quantity || 1)
            })),
            subtotal: subtotal || calculatedTotal,
            tax,
            shipping,
            discount,
            total: total || calculatedTotal,
            paymentMethod,
            shippingAddress,
            billingAddress: billingAddress || shippingAddress,
            orderType,
            notes,
            couponCode,
            source: 'web'
        });

        const newOrder = await order.save();
        await newOrder.populate('items.product', 'name price image');
        
        res.status(201).json({
            message: 'Order created successfully',
            order: newOrder
        });
    } catch (err) {
        res.status(400).json({ message: 'Error creating order: ' + err.message });
    }
};

// @desc    Get logged in user orders with filtering
// @route   GET /api/orders/myorders
// @access  Private
export const getMyOrders = async (req, res) => {
    try {
        const { status, orderType, page = 1, limit = 10 } = req.query;
        
        const filter = { user: req.user._id };
        if (status) filter.status = status;
        if (orderType) filter.orderType = orderType;

        const skip = (page - 1) * limit;
        
        const orders = await Order.find(filter)
            .populate('items.product', 'name price image')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Order.countDocuments(filter);

        res.status(200).json({
            orders,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalOrders: total
            }
        });
    } catch (err) {
        res.status(500).json({ message: 'Server Error: ' + err.message });
    }
};

// @desc    Get order by ID with full details
// @route   GET /api/orders/:id
// @access  Private
export const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('items.product', 'name price image description')
            .populate('user', 'name email');
        
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if user is authorized to view this order
        if (order.user._id.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            return res.status(403).json({ message: 'Not authorized to view this order' });
        }

        res.status(200).json(order);
    } catch (err) {
        res.status(500).json({ message: 'Server Error: ' + err.message });
    }
};

// @desc    Update an order by ID
// @route   PUT /api/orders/:id
// @access  Private/Admin
export const updateOrder = async (req, res) => {
    try {
        const updatedOrder = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true })
            .populate('items.product', 'name price image')
            .populate('user', 'name email');
            
        if (!updatedOrder) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        res.status(200).json({
            message: 'Order updated successfully',
            order: updatedOrder
        });
    } catch (err) {
        res.status(400).json({ message: 'Error updating order: ' + err.message });
    }
};

// @desc    Delete an order by ID
// @route   DELETE /api/orders/:id
// @access  Private/Admin
export const deleteOrder = async (req, res) => {
    try {
        const order = await Order.findByIdAndDelete(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.status(200).json({ message: 'Order deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server Error: ' + err.message });
    }
};