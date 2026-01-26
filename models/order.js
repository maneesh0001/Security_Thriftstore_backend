// models/order.js
import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    price: {
        type: Number,
        required: true
    },
    subtotal: {
        type: Number,
        required: true
    },
    // Track item-specific status
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
        default: 'pending'
    }
});

const orderSchema = new mongoose.Schema({
    // Basic order info
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    orderNumber: {
        type: String,
        unique: true,
        required: true
    },
    customerName: { 
        type: String, 
        required: true 
    },
    
    // Enhanced status tracking
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
        default: 'pending'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending'
    },
    
    // Financial tracking
    subtotal: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    
    // Order type and priority
    orderType: {
        type: String,
        enum: ['standard', 'express', 'rental', 'purchase'],
        default: 'standard'
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },
    
    // Shipping information
    shippingAddress: {
        firstName: String,
        lastName: String,
        company: String,
        address: String,
        apartment: String,
        city: String,
        state: String,
        postalCode: String,
        country: String,
        phone: String
    },
    
    // Billing information
    billingAddress: {
        firstName: String,
        lastName: String,
        company: String,
        address: String,
        apartment: String,
        city: String,
        state: String,
        postalCode: String,
        country: String,
        phone: String
    },
    
    // Tracking and delivery
    trackingNumber: String,
    estimatedDelivery: Date,
    actualDelivery: Date,
    shippingMethod: {
        type: String,
        enum: ['standard', 'express', 'overnight', 'pickup'],
        default: 'standard'
    },
    
    // Order items with enhanced tracking
    items: [orderItemSchema],
    
    // Payment information
    paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment'
    },
    paymentMethod: {
        type: String,
        enum: ['khalti', 'esewa', 'cod', 'card', 'bank'],
        default: 'khalti'
    },
    
    // Notes and metadata
    notes: String,
    internalNotes: String, // Admin only
    tags: [String],
    
    // Timestamps for tracking
    orderDate: { type: Date, default: Date.now },
    confirmedAt: Date,
    processedAt: Date,
    shippedAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
    
    // Cancellation and refund info
    cancellationReason: String,
    refundAmount: Number,
    refundStatus: {
        type: String,
        enum: ['none', 'requested', 'processing', 'completed'],
        default: 'none'
    },
    
    // Customer communication
    emailSent: { type: Boolean, default: false },
    smsSent: { type: Boolean, default: false },
    
    // Analytics and reporting
    source: {
        type: String,
        enum: ['web', 'mobile', 'admin', 'api'],
        default: 'web'
    },
    campaign: String,
    couponCode: String
}, {
    timestamps: true
});

// Generate unique order number
orderSchema.pre('save', async function(next) {
    if (!this.orderNumber) {
        const count = await Order.countDocuments();
        this.orderNumber = `ORD-${Date.now()}-${String(count + 1).padStart(4, '0')}`;
    }
    next();
});

// Virtual for order duration
orderSchema.virtual('orderDuration').get(function() {
    if (this.deliveredAt) {
        return Math.ceil((this.deliveredAt - this.orderDate) / (1000 * 60 * 60 * 24));
    }
    return Math.ceil((Date.now() - this.orderDate) / (1000 * 60 * 60 * 24));
});

// Static methods for common queries
orderSchema.statics.findByStatus = function(status) {
    return this.find({ status }).populate('items.product').populate('user', 'name email');
};

orderSchema.statics.findPending = function() {
    return this.find({ status: 'pending' }).populate('items.product').populate('user', 'name email');
};

orderSchema.statics.findByUser = function(userId) {
    return this.find({ user: userId }).populate('items.product').sort({ createdAt: -1 });
};

const Order = mongoose.model("Order", orderSchema);
export default Order;