// scripts/adjustOrderPrices.js
import mongoose from 'mongoose';
import Order from '../models/order.js';
import dotenv from 'dotenv';

dotenv.config();

const adjustOrderPrices = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/authapp');
        console.log('Connected to MongoDB');

        // Find all orders and adjust prices to match totals
        const orders = await Order.find({
            $where: function() {
                const calculatedTotal = this.items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
                return Math.abs(calculatedTotal - this.total) > 100; // Only fix if difference is significant
            }
        });

        console.log(`Found ${orders.length} orders with price mismatches`);

        for (const order of orders) {
            const currentTotal = order.items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
            const targetTotal = order.total;
            const difference = targetTotal - currentTotal;

            console.log(`\n=== Adjusting Order: ${order._id} ===`);
            console.log(`Current calculated total: Rs. ${currentTotal}`);
            console.log(`Target total: Rs. ${targetTotal}`);
            console.log(`Difference: Rs. ${difference}`);

            if (order.items.length > 0) {
                // Distribute the difference proportionally
                const adjustmentPerItem = difference / order.items.length;
                
                const updatedItems = order.items.map(item => {
                    const newPrice = (item.price || 0) + adjustmentPerItem;
                    const newSubtotal = newPrice * (item.quantity || 1);
                    
                    console.log(`  Item: ${item.product} - New price: Rs. ${newPrice.toFixed(2)} - New subtotal: Rs. ${newSubtotal.toFixed(2)}`);
                    
                    return {
                        ...item.toObject(),
                        price: newPrice,
                        subtotal: newSubtotal
                    };
                });

                // Update the order
                await Order.findByIdAndUpdate(order._id, {
                    $set: {
                        items: updatedItems,
                        subtotal: targetTotal
                    }
                });

                console.log(`  ✅ Adjusted order ${order._id}`);
            }
        }

        console.log('\n✅ All order prices have been adjusted!');
        
        await mongoose.disconnect();
    } catch (error) {
        console.error('Error adjusting order prices:', error);
        process.exit(1);
    }
};

adjustOrderPrices();
