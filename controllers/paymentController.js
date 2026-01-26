// backend/controllers/paymentController.js
import axios from 'axios';
import Payment from '../models/payment.js';
import Order from '../models/order.js';

const KHALTI_SECRET_KEY = process.env.KHALTI_SECRET_KEY;
const KHALTI_PUBLIC_KEY = process.env.KHALTI_PUBLIC_KEY;
const KHALTI_GATEWAY_URL = (process.env.KHALTI_GATEWAY_URL || 'https://a.khalti.com/api/v2').trim(); // Default to Sandbox

// Validate that Khalti keys are properly configured
if (!KHALTI_SECRET_KEY || !KHALTI_PUBLIC_KEY) {
    console.error('❌ KHALTI KEYS NOT CONFIGURED! Please check your .env file.');
    console.error('Required: KHALTI_PUBLIC_KEY and KHALTI_SECRET_KEY');
}

console.log('✅ Khalti Configuration Loaded:');
console.log(`   Public Key: ${KHALTI_PUBLIC_KEY?.substring(0, 30)}...`);
console.log(`   Secret Key: ${KHALTI_SECRET_KEY ? '[CONFIGURED]' : '[MISSING]'}`);
console.log(`   Gateway URL: ${KHALTI_GATEWAY_URL}`);

// @desc    Initialize Khalti payment
// @route   POST /api/payments/khalti/initiate
// @access  Private
export const initiateKhaltiPayment = async (req, res) => {
    try {
        const { amount, productInfo, orderId } = req.body;
        const userId = req.user._id;

        console.log('[DEBUG] Khalti Config:', {
            gatewayUrl: KHALTI_GATEWAY_URL,
            publicKey: KHALTI_PUBLIC_KEY ? 'Set' : 'Missing',
            secretKey: KHALTI_SECRET_KEY ? 'Set' : 'Missing',
            secretKeyStart: KHALTI_SECRET_KEY ? KHALTI_SECRET_KEY.substring(0, 5) : 'N/A'
        });

        // Validate amount (Khalti requires amount in paisa - 1 NPR = 100 paisa)
        if (!amount || amount < 10) {
            return res.status(400).json({ message: 'Invalid amount. Minimum 10 NPR required.' });
        }

        // Create payment record
        const payment = new Payment({
            userId,
            orderId: orderId || null,
            amount: amount / 100, // Store in NPR
            currency: 'NPR',
            paymentMethod: 'khalti',
            status: 'pending',
            metadata: {
                productInfo,
                amountInPaisa: amount,
                totalAmount: amount / 100
            },
        });

        await payment.save();

        // Prepare Khalti ePayment Request
        const purchaseOrderName = productInfo?.length > 0 ? productInfo[0].productName : 'Thrift Store Purchase';
        const returnUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success`;
        const websiteUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

        // NOTE: For Sandbox Testing Only
        // Khalti Test Wallets have limited funds (usually < Rs 10,000).
        // You can increase this limit, but if it exceeds the wallet balance, you'll get "Insufficient Balance".
        // Currently set to max Rs 200 (20000 paisa) for safer testing.
        const payAmount = parseInt(amount > 20000 ? 20000 : amount); 

        const khaltiPayload = {
            return_url: returnUrl,
            website_url: websiteUrl,
            amount: payAmount, // Amount in paisa
            purchase_order_id: payment._id.toString(),
            purchase_order_name: purchaseOrderName,
            customer_info: {
                name: req.user.name,
                email: req.user.email,
                phone: (req.user.phone || '9800000001').replace(/\D/g, ''), // Default to 9800000001 (less likely to be frozen)
            }
        };

        console.log('[DEBUG] Payload:', JSON.stringify(khaltiPayload, null, 2));

        const config = {
            headers: {
                'Authorization': `Key ${KHALTI_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
        };

        console.log(`[PAYMENT INIT] Initiating Khalti payment for Order ${payment._id}`);
        
        // Call Khalti Initiate API
        try {
            const response = await axios.post(`${KHALTI_GATEWAY_URL}/epayment/initiate/`, khaltiPayload, config);

            if (response.data && response.data.pidx) {
                // Update payment with PIDX
                payment.khaltiTransactionId = response.data.pidx;
                await payment.save();
    
                console.log(`[PAYMENT INIT] Khalti PIDX: ${response.data.pidx}`);
    
                res.status(200).json({
                    message: 'Payment initiated successfully',
                    paymentId: payment._id,
                    amount: amount,
                    pidx: response.data.pidx,
                    payment_url: response.data.payment_url,
                    publicKey: KHALTI_PUBLIC_KEY,
                });
            } else {
                throw new Error('Failed to get PIDX from Khalti');
            }
        } catch (apiError) {
             console.error('[KH-ERROR] Status:', apiError.response?.status);
             console.error('[KH-ERROR] Headers:', apiError.response?.headers);
             console.error('[KH-ERROR] Data:', apiError.response?.data);
             throw apiError;
        }

    } catch (error) {
        console.error('Khalti Payment Initiation Error:', error.response?.data || error.message);
        
        let errorMessage = error.response?.data?.detail || error.message;
        
        // Improve error message for Insufficient Balance in Sandbox
        if (JSON.stringify(error.response?.data || '').toLowerCase().includes('insufficient balance')) {
            errorMessage = 'Khalti Sandbox Error: The test wallet has insufficient balance. Please try a different test number (e.g., 9800000000, 9800000001).';
        }

        res.status(500).json({ 
            message: 'Error initiating payment', 
            error: errorMessage
        });
    }
};

// @desc    Verify Khalti payment
// @route   POST /api/payments/khalti/verify
// @access  Private
// @desc    Test order creation (for debugging)
// @route   POST /api/payments/test-order
// @access  Private
export const testOrderCreation = async (req, res) => {
    try {
        const Payment = await import('../models/payment.js').then(m => m.default);
        const Product = (await import('../models/product.js')).default;
        
        // Get a recent payment to test with
        const recentPayment = await Payment.findOne({ status: 'completed' }).sort({ createdAt: -1 });
        
        if (!recentPayment) {
            return res.status(404).json({ message: 'No completed payments found' });
        }
        
        console.log('[TEST] Testing with payment:', recentPayment._id);
        console.log('[TEST] Payment metadata:', recentPayment.metadata);
        
        const productInfo = recentPayment.metadata.productInfo;
        let items = [];
        
        if (productInfo && productInfo.items && Array.isArray(productInfo.items)) {
            for (const item of productInfo.items) {
                let productPrice = item.price || 0;
                const productId = item.product || item.productId || item._id || item.id;
                
                console.log(`[TEST] Processing item:`, {
                    productId,
                    originalPrice: item.price,
                    quantity: item.quantity,
                    itemKeys: Object.keys(item)
                });
                
                if (!productPrice && productId) {
                    try {
                        const product = await Product.findById(productId);
                        console.log(`[TEST] Found product:`, product);
                        
                        if (product) {
                            productPrice = product.price || product.rentalPrice || 0;
                            console.log(`[TEST] Fetched price for product ${productId}:`, productPrice);
                        } else {
                            console.log(`[TEST] Product not found: ${productId}`);
                        }
                    } catch (err) {
                        console.error('Error fetching product price:', err);
                    }
                }
                
                items.push({
                    product: productId,
                    quantity: item.quantity || 1,
                    price: productPrice,
                    subtotal: productPrice * (item.quantity || 1)
                });
            }
        }
        
        const calculatedTotal = items.reduce((sum, item) => sum + item.subtotal, 0);
        
        res.json({
            payment: recentPayment,
            productInfo,
            items,
            calculatedTotal,
            paymentAmount: recentPayment.amount
        });
        
    } catch (error) {
        console.error('Test order creation error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Verify Khalti payment
// @route   POST /api/payments/khalti/verify
// @access  Private
export const verifyKhaltiPayment = async (req, res) => {
    try {
        const { pidx } = req.body;

        if (!pidx) {
            return res.status(400).json({ message: 'Missing required field: pidx' });
        }

        // Find payment record by PIDX
        const payment = await Payment.findOne({ khaltiTransactionId: pidx });
        if (!payment) {
            return res.status(404).json({ message: 'Payment record not found' });
        }

        // Verify with Khalti Lookup API
        const config = {
            headers: {
                'Authorization': `Key ${KHALTI_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
        };

        console.log(`[PAYMENT VERIFY] Verifying PIDX: ${pidx}`);

        try {
            const response = await axios.post(`${KHALTI_GATEWAY_URL}/epayment/lookup/`, { pidx }, config);
            console.log(`[PAYMENT VERIFY] Response Status: ${response.data?.status}`);

                if (response.data && response.data.status === 'Completed') {
                    // Payment verified successfully
                    payment.status = 'completed';
                    payment.metadata.verificationResponse = response.data;
                    
                    // If orderId is missing, try to create an order from metadata
                    if (!payment.orderId) {
                        console.log('[PAYMENT VERIFY] No Order ID found. Creating new order from metadata...');
                        console.log('[PAYMENT VERIFY] Payment metadata:', JSON.stringify(payment.metadata, null, 2));
                        console.log('[PAYMENT VERIFY] Product info:', JSON.stringify(payment.metadata.productInfo, null, 2));
                        try {
                            const productInfo = payment.metadata.productInfo;
                            
                            // Create order even if productInfo is missing
                            let items = [];
                            
                            // Handle different structures of productInfo
                            if (productInfo && productInfo.items && Array.isArray(productInfo.items)) {
                                // Structure from CheckoutPage: { items: [...], name: "...", ... }
                                const Product = (await import('../models/product.js')).default;
                                
                                for (const item of productInfo.items) {
                                    let productPrice = item.price || 0;
                                    const productId = item.product || item.productId || item._id || item.id;
                                    
                                    console.log(`[ORDER CREATE] Processing item:`, {
                                        productId,
                                        originalPrice: item.price,
                                        quantity: item.quantity,
                                        itemKeys: Object.keys(item)
                                    });
                                    
                                    // If price not provided, fetch from database
                                    if (!productPrice && productId) {
                                        try {
                                            console.log(`[ORDER CREATE] Fetching product with ID: ${productId}`);
                                            const product = await Product.findById(productId);
                                            console.log(`[ORDER CREATE] Found product:`, product);
                                            
                                            if (product) {
                                                productPrice = product.price || product.rentalPrice || 0;
                                                console.log(`[ORDER CREATE] Fetched price for product ${productId}:`, productPrice);
                                            } else {
                                                console.log(`[ORDER CREATE] Product not found: ${productId}`);
                                                // Use a default price or the payment amount divided by quantity
                                                productPrice = payment.amount / (productInfo.items.length || 1);
                                                console.log(`[ORDER CREATE] Using fallback price:`, productPrice);
                                            }
                                        } catch (err) {
                                            console.error('Error fetching product price:', err);
                                            // Use fallback price
                                            productPrice = payment.amount / (productInfo.items.length || 1);
                                        }
                                    }
                                    
                                    const subtotal = productPrice * (item.quantity || 1);
                                    console.log(`[ORDER CREATE] Item subtotal:`, subtotal);
                                    
                                    items.push({
                                        product: productId,
                                        quantity: item.quantity || 1,
                                        price: productPrice,
                                        subtotal: subtotal
                                    });
                                }
                            } else if (productInfo && Array.isArray(productInfo)) {
                                // Direct array structure
                                const Product = await import('../models/product.js').then(m => m.default);
                                
                                for (const item of productInfo) {
                                    let productPrice = item.price || 0;
                                    const productId = item.product || item.productId || item._id || item.id;
                                    
                                    // If price not provided, fetch from database
                                    if (!productPrice && productId) {
                                        try {
                                            const product = await Product.findById(productId);
                                            if (product) {
                                                productPrice = product.price || product.rentalPrice || 0;
                                            }
                                        } catch (err) {
                                            console.error('Error fetching product price:', err);
                                        }
                                    }
                                    
                                    items.push({
                                        product: productId,
                                        quantity: item.quantity || 1,
                                        price: productPrice,
                                        subtotal: productPrice * (item.quantity || 1)
                                    });
                                }
                            } else {
                                // Create a generic order if no product info
                                console.log('[ORDER CREATE] No product info found, creating generic order');
                                items = [{
                                    product: null,
                                    quantity: 1,
                                    price: payment.amount,
                                    subtotal: payment.amount
                                }];
                            }
                            
                            // Calculate total from items and validate
                            const calculatedTotal = items.reduce((sum, item) => sum + item.subtotal, 0);
                            console.log('[ORDER CREATE] Calculated total from items:', calculatedTotal);
                            console.log('[ORDER CREATE] Payment amount:', payment.amount);
                            
                            // If there's a big discrepancy, adjust prices
                            if (Math.abs(calculatedTotal - payment.amount) > 1) {
                                console.log('[ORDER CREATE] Price discrepancy detected, adjusting...');
                                const adjustmentFactor = payment.amount / calculatedTotal;
                                items.forEach(item => {
                                    item.price = item.price * adjustmentFactor;
                                    item.subtotal = item.price * item.quantity;
                                });
                                console.log('[ORDER CREATE] Adjusted items:', items);
                            }

                            if (items.length > 0 || !productInfo) {
                                // Generate order number manually to avoid circular reference
                                const orderCount = await Order.countDocuments();
                                const orderNumber = `ORD-${Date.now()}-${String(orderCount + 1).padStart(4, '0')}`;
                                
                                const newOrder = new Order({
                                    orderNumber: orderNumber,
                                    user: payment.userId,
                                    customerName: req.user?.name || 'Valued Customer',
                                    items: items,
                                    subtotal: payment.amount,
                                    total: payment.amount, // Payment amount is in NPR
                                    status: 'confirmed', // Use confirmed status for paid orders
                                    paymentStatus: 'paid',
                                    paymentMethod: 'khalti',
                                    paymentId: payment._id,
                                    orderType: 'standard',
                                    source: 'web',
                                    // Add shipping address from metadata if available
                                    shippingAddress: productInfo?.shippingAddress ? {
                                        firstName: productInfo.shippingAddress.firstName || req.user?.name?.split(' ')[0] || 'Valued',
                                        lastName: productInfo.shippingAddress.lastName || req.user?.name?.split(' ')[1] || 'Customer',
                                        address: productInfo.shippingAddress.streetAddress,
                                        apartment: productInfo.shippingAddress.apartmentSuite,
                                        city: productInfo.shippingAddress.city,
                                        state: productInfo.shippingAddress.state,
                                        postalCode: productInfo.shippingAddress.zipCode,
                                        country: productInfo.shippingAddress.country || 'Nepal',
                                        phone: productInfo.contactInfo?.phone || req.user?.phone
                                    } : undefined
                                });

                                try {
                                    const savedOrder = await newOrder.save();
                                    payment.orderId = savedOrder._id;
                                    console.log(`[PAYMENT VERIFY] Created new Order: ${savedOrder._id} with orderNumber: ${orderNumber}`);
                                    console.log('[PAYMENT VERIFY] Saved order:', JSON.stringify(savedOrder, null, 2));
                                } catch (orderSaveError) {
                                    console.error('[PAYMENT VERIFY] Order save error:', orderSaveError);
                                    // Don't throw here, payment is still successful
                                }
                            }
                        } catch (orderError) {
                            console.error('[PAYMENT VERIFY] Failed to create auto-order:', orderError);
                        }
                    }

                    await payment.save();
    
                    // Update order if exists
                    if (payment.orderId) {
                        await Order.findByIdAndUpdate(payment.orderId, {
                            paymentStatus: 'paid',
                            paymentId: payment._id,
                        });
                    }
    
                    console.log(`[PAYMENT SUCCESS] Payment ${payment._id} verified. PIDX: ${pidx}`);
    
                    // Get order information if it exists
                    let orderInfo = null;
                    if (payment.orderId) {
                        orderInfo = await Order.findById(payment.orderId)
                            .populate('items.product', 'name price image');
                    }
    
                    res.status(200).json({
                        message: 'Payment verified successfully',
                        success: true,
                        payment: {
                            id: payment._id,
                            amount: payment.amount,
                            status: payment.status,
                            transactionId: pidx,
                        },
                        order: orderInfo,
                        orderId: orderInfo?._id || payment.orderId
                    });
    
            } else {
                // Payment verification failed or pending
                payment.status = response.data.status === 'Pending' ? 'pending' : 'failed';
                payment.failureReason = response.data.status;
                await payment.save();
    
                console.log(`[PAYMENT FAILED] Payment ${payment._id} status: ${response.data.status}`);
    
                res.status(400).json({
                    message: 'Payment verification failed',
                    status: response.data.status,
                    detail: response.data
                });
            }
        } catch (khaltiError) {
             console.error('[KH-VERIFY-ERROR] Status:', khaltiError.response?.status);
             console.error('[KH-VERIFY-ERROR] Data:', khaltiError.response?.data);
             throw khaltiError;
        }

    } catch (error) {
        console.error('Khalti Payment Verification Error:', error.response?.data || error.message);

        // Update payment status to failed
        if (req.body.paymentId) {
            await Payment.findByIdAndUpdate(req.body.paymentId, {
                status: 'failed',
                failureReason: error.response?.data?.detail || error.message,
            });
        }

        res.status(500).json({
            message: 'Error verifying payment',
            error: error.response?.data?.detail || error.message,
        });
    }
};

// @desc    Get payment history for user
// @route   GET /api/payments/history
// @access  Private
export const getPaymentHistory = async (req, res) => {
    try {
        const userId = req.user._id;

        const payments = await Payment.find({ userId })
            .populate('orderId', 'items totalAmount')
            .sort({ createdAt: -1 })
            .limit(50);

        res.status(200).json(payments);

    } catch (error) {
        console.error('Get Payment History Error:', error);
        res.status(500).json({ message: 'Error fetching payment history' });
    }
};

// @desc    Get all payments (Admin only)
// @route   GET /api/payments/all
// @access  Private/Admin
export const getAllPayments = async (req, res) => {
    try {
        const payments = await Payment.find({})
            .populate('userId', 'name email')
            .populate('orderId', 'items totalAmount')
            .sort({ createdAt: -1 })
            .limit(100);

        res.status(200).json(payments);

    } catch (error) {
        console.error('Get All Payments Error:', error);
        res.status(500).json({ message: 'Error fetching payments' });
    }
};

// @desc    Get payment by ID
// @route   GET /api/payments/:id
// @access  Private
export const getPaymentById = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id)
            .populate('userId', 'name email')
            .populate('orderId', 'items totalAmount');

        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }

        // Check if user owns this payment or is admin
        if (payment.userId._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized to view this payment' });
        }

        res.status(200).json(payment);

    } catch (error) {
        console.error('Get Payment Error:', error);
        res.status(500).json({ message: 'Error fetching payment' });
    }
};

export default {
    initiateKhaltiPayment,
    verifyKhaltiPayment,
    getPaymentHistory,
    getAllPayments,
    getPaymentById,
};
