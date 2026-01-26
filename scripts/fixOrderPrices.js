// scripts/fixOrderPrices.js
import mongoose from 'mongoose';
import Order from '../models/order.js';
import Product from '../models/product.js';
import dotenv from 'dotenv';

dotenv.config();

const fixOrderPrices = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thriftstore');
        console.log('Connected to MongoDB');

        // Find all orders with items that have price 0
        const ordersWithZeroPrice = await Order.find({
            'items.price': 0
        }).populate('items.product');

        console.log(`Found ${ordersWithZeroPrice.length} orders with zero-priced items`);

        for (const order of ordersWithZeroPrice) {
            console.log(`\nProcessing Order: ${order.orderNumber || order._id}`);
            
            let updatedItems = [];
            let totalSubtotal = 0;

            for (const item of order.items) {
                let itemPrice = item.price;
                
                // If price is 0, try to get from product
                if (itemPrice === 0 && item.product) {
                    if (typeof item.product === 'object') {
                        // Already populated
                        itemPrice = item.product.price || item.product.rentalPrice || 0;
                    } else {
                        // Need to fetch product
                        const product = await Product.findById(item.product);
                        itemPrice = product ? (product.price || product.rentalPrice || 0) : 0;
                    }
                }

                // If still 0, use proportional pricing based on order total
                if (itemPrice === 0) {
                    itemPrice = order.total / order.items.length;
                    console.log(`  Using fallback price: Rs. ${itemPrice}`);
                }

                const subtotal = itemPrice * item.quantity;
                totalSubtotal += subtotal;

                updatedItems.push({
                    ...item.toObject(),
                    price: itemPrice,
                    subtotal: subtotal
                });

                console.log(`  Item: ${item.product?.name || 'Unknown'} - Qty: ${item.quantity} - Price: Rs. ${itemPrice} - Subtotal: Rs. ${subtotal}`);
            }

            // Update the order
            await Order.findByIdAndUpdate(order._id, {
                $set: {
                    items: updatedItems,
                    subtotal: totalSubtotal
                }
            });

            console.log(`  Updated order total: Rs. ${totalSubtotal}`);
        }

        console.log('\n✅ Order price fixing completed!');
        
        await mongoose.disconnect();
    } catch (error) {
        console.error('Error fixing order prices:', error);
        process.exit(1);
    }
};

fixOrderPrices();
