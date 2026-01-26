// scripts/checkOrderData.js
import mongoose from 'mongoose';
import Order from '../models/order.js';
import Product from '../models/product.js';
import dotenv from 'dotenv';

dotenv.config();

const checkOrderData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/authapp');
        console.log('Connected to MongoDB');

        // Get recent orders to check
        const recentOrders = await Order.find({})
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('items.product');

        console.log(`Found ${recentOrders.length} recent orders`);

        for (const order of recentOrders) {
            console.log(`\n=== Order: ${order.orderNumber || order._id} ===`);
            console.log(`Status: ${order.status}`);
            console.log(`Total: Rs. ${order.total}`);
            console.log(`Items count: ${order.items.length}`);
            
            order.items.forEach((item, index) => {
                console.log(`\nItem ${index + 1}:`);
                console.log(`  Product: ${item.product?.name || 'Unknown'}`);
                console.log(`  Product ID: ${item.product}`);
                console.log(`  Quantity: ${item.quantity}`);
                console.log(`  Price: Rs. ${item.price}`);
                console.log(`  Subtotal: Rs. ${item.subtotal}`);
                console.log(`  Item object keys: ${Object.keys(item.toObject())}`);
            });
        }
        
        await mongoose.disconnect();
    } catch (error) {
        console.error('Error checking order data:', error);
        process.exit(1);
    }
};

checkOrderData();
