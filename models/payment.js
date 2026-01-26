// backend/models/payment.js
import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: false, // May not have order initially
    },
    amount: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        default: 'NPR', // Khalti uses Nepali Rupees
    },
    paymentMethod: {
        type: String,
        enum: ['khalti', 'card', 'wallet'],
        default: 'khalti',
    },
    khaltiTransactionId: {
        type: String,
        default: null,
    },
    khaltiToken: {
        type: String,
        default: null,
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending',
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed, // Store order details, product info, etc.
        default: {},
    },
    failureReason: {
        type: String,
        default: null,
    },
}, {
    timestamps: true,
});

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
