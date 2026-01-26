// controllers/bookingController.js
import Booking from '../models/booking.js';

// @desc    Create a new booking
// @route   POST /api/bookings
// @access  Private
export const createBooking = async (req, res) => {
    try {
        const { items, totalPrice, paymentId, contactInfo, shippingAddress } = req.body;

        // Validate required fields
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Items are required and must be a non-empty array' });
        }

        if (!totalPrice || totalPrice <= 0) {
            return res.status(400).json({ message: 'Total price is required and must be greater than 0' });
        }

        // Get user ID from authenticated session
        const userId = req.user?._id || req.user?.id;

        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        // Normalize items to handle both 'product' and 'productId' fields
        const normalizedItems = items.map(item => ({
            product: item.product || item.productId,
            productId: item.product || item.productId,
            quantity: item.quantity
        }));

        // Create booking with optional payment and contact info
        const bookingData = {
            userId,
            items: normalizedItems,
            totalPrice,
            status: paymentId ? 'confirmed' : 'pending' // If payment exists, mark as confirmed
        };

        // Add optional fields if provided
        if (paymentId) bookingData.paymentId = paymentId;
        if (contactInfo) bookingData.contactInfo = contactInfo;
        if (shippingAddress) bookingData.shippingAddress = shippingAddress;

        const booking = new Booking(bookingData);
        const newBooking = await booking.save();

        // Populate product details for response
        await newBooking.populate('items.product', 'name price');

        res.status(201).json({
            message: 'Booking created successfully',
            booking: newBooking
        });
    } catch (err) {
        console.error('Error creating booking:', err);
        res.status(500).json({ message: 'Server Error: ' + err.message });
    }
};

// @desc    Get all bookings for the authenticated user
// @route   GET /api/bookings
// @access  Private
export const getUserBookings = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;

        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const bookings = await Booking.find({ userId })
            .populate('items.product', 'name price image')
            .sort({ createdAt: -1 });

        res.status(200).json(bookings);
    } catch (err) {
        console.error('Error fetching bookings:', err);
        res.status(500).json({ message: 'Server Error: ' + err.message });
    }
};

// @desc    Get all bookings (Admin only)
// @route   GET /api/bookings/all
// @access  Private/Admin
export const getAllBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({})
            .populate('userId', 'name email')
            .populate('items.product', 'name price image')
            .sort({ createdAt: -1 });

        res.status(200).json(bookings);
    } catch (err) {
        console.error('Error fetching all bookings:', err);
        res.status(500).json({ message: 'Server Error: ' + err.message });
    }
};
