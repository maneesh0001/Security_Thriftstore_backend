// scripts/fixExistingOrders.js
import mongoose from 'mongoose';
import Order from '../models/order.js';
import Product from '../models/product.js';
import dotenv from 'dotenv';

dotenv.config();

const fixExistingOrders = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/authapp');
        console.log('Connected to MongoDB');

        // Find all orders that need fixing (old structure)
        const ordersToFix = await Order.find({
            'items.product': null
        });

        console.log(`Found ${ordersToFix.length} orders to fix`);

        for (const order of ordersToFix) {
            console.log(`\n=== Fixing Order: ${order._id} ===`);
            console.log(`Current total: Rs. ${order.total}`);
            console.log(`Items count: ${order.items.length}`);

            // Get payment to find product info
            const Payment = await import('../models/payment.js').then(m => m.default);
            const payment = await Payment.findById(order.paymentId);

            if (payment && payment.metadata && payment.metadata.productInfo) {
                const productInfo = payment.metadata.productInfo;
                let updatedItems = [];

                // Handle different productInfo structures
                let itemsToProcess = [];
                if (productInfo.items && Array.isArray(productInfo.items)) {
                    itemsToProcess = productInfo.items;
                } else if (Array.isArray(productInfo)) {
                    itemsToProcess = productInfo;
                }

                for (let i = 0; i < itemsToProcess.length; i++) {
                    const item = itemsToProcess[i];
                    let productPrice = 0;
                    const productId = item.product || item.productId || item._id || item.id;

                    // Try to get price from item first
                    if (item.price) {
                        productPrice = item.price;
                    } else if (productId) {
                        // Fetch from database
                        try {
                            const product = await Product.findById(productId);
                            if (product) {
                                productPrice = product.price || product.rentalPrice || 0;
                                console.log(`  Found product price: Rs. ${productPrice}`);
                            }
                        } catch (err) {
                            console.error(`  Error fetching product ${productId}:`, err.message);
                        }
                    }

                    // If still no price, use proportional pricing
                    if (productPrice === 0) {
                        productPrice = order.total / itemsToProcess.length;
                        console.log(`  Using fallback price: Rs. ${productPrice}`);
                    }

                    const quantity = item.quantity || 1;
                    const subtotal = productPrice * quantity;

                    updatedItems.push({
                        product: productId,
                        quantity: quantity,
                        price: productPrice,
                        subtotal: subtotal,
                        status: 'confirmed'
                    });

                    console.log(`  Item ${i + 1}: Qty ${quantity} × Rs. ${productPrice} = Rs. ${subtotal}`);
                }

                // Update the order with new structure
                await Order.findByIdAndUpdate(order._id, {
                    $set: {
                        items: updatedItems,
                        subtotal: order.total,
                        // Add missing fields from new model
                        orderType: 'standard',
                        paymentMethod: 'khalti',
                        shippingAddress: null,
                        billingAddress: null
                    }
                });

                console.log(`  ✅ Updated order ${order._id}`);
            } else {
                console.log(`  ⚠️  No payment metadata found for order ${order._id}`);
                
                // Create a simple item with proportional pricing
                const fallbackPrice = order.total / order.items.length;
                const updatedItems = order.items.map(item => ({
                    ...item.toObject(),
                    price: fallbackPrice,
                    subtotal: fallbackPrice * item.quantity,
                    status: 'confirmed'
                }));

                await Order.findByIdAndUpdate(order._id, {
                    $set: {
                        items: updatedItems,
                        subtotal: order.total,
                        orderType: 'standard',
                        paymentMethod: 'khalti'
                    }
                });

                console.log(`  ✅ Updated order ${order._id} with fallback pricing`);
            }
        }

        console.log('\n✅ All orders have been fixed!');
        
        await mongoose.disconnect();
    } catch (error) {
        console.error('Error fixing orders:', error);
        process.exit(1);
    }
};

fixExistingOrders();
