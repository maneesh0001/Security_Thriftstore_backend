// models/booking.js
import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product'
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        }
    }],
    totalPrice: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'completed'],
        default: 'pending'
    },
    paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment'
    },
    contactInfo: {
        firstName: String,
        lastName: String,
        email: String,
        phone: String
    },
    shippingAddress: {
        streetAddress: String,
        apartmentSuite: String,
        city: String,
        state: String,
        zipCode: String
    }
}, {
    timestamps: true
});

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;
