// Generate sample data for admin dashboard
import mongoose from 'mongoose';
import User from '../models/user.js';
import Product from '../models/product.js';
import Order from '../models/order.js';
import connectDb from '../config/database.js';

const generateSampleData = async () => {
    try {
        await connectDb();
        
        console.log('🌱 Generating sample dashboard data...');

        // Create sample users
        const users = await User.find({ role: 'user' });
        if (users.length === 0) {
            console.log('Creating sample users...');
            await User.create([
                { name: 'John Doe', email: 'john@example.com', password: 'password123', role: 'user' },
                { name: 'Jane Smith', email: 'jane@example.com', password: 'password123', role: 'user' },
                { name: 'Bob Johnson', email: 'bob@example.com', password: 'password123', role: 'user' }
            ]);
        }

        // Create sample products
        const products = await Product.find();
        if (products.length === 0) {
            console.log('Creating sample products...');
            await Product.create([
                { name: 'Laptop', price: 999.99, category: 'Electronics', stock: 10, description: 'High-performance laptop' },
                { name: 'Smartphone', price: 699.99, category: 'Electronics', stock: 25, description: 'Latest smartphone' },
                { name: 'Headphones', price: 199.99, category: 'Electronics', stock: 50, description: 'Wireless headphones' },
                { name: 'T-Shirt', price: 29.99, category: 'Clothing', stock: 100, description: 'Cotton t-shirt' },
                { name: 'Jeans', price: 79.99, category: 'Clothing', stock: 75, description: 'Denim jeans' }
            ]);
        }

        // Create sample orders
        const orders = await Order.find();
        const allUsers = await User.find({ role: 'user' });
        const allProducts = await Product.find();
        
        if (orders.length === 0 && allUsers.length > 0 && allProducts.length > 0) {
            console.log('Creating sample orders...');
            
            for (let i = 0; i < 10; i++) {
                const randomUser = allUsers[Math.floor(Math.random() * allUsers.length)];
                const randomProducts = allProducts.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 1);
                
                const orderItems = randomProducts.map(product => ({
                    product: product._id,
                    quantity: Math.floor(Math.random() * 3) + 1,
                    price: product.price
                }));

                const total = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

                await Order.create({
                    user: randomUser._id,
                    items: orderItems,
                    total: total,
                    status: ['pending', 'processing', 'shipped', 'delivered'][Math.floor(Math.random() * 4)],
                    orderDate: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000)
                });
            }
        }

        console.log('✅ Sample data generated successfully!');
        console.log('📊 Dashboard should now show data');
        
    } catch (error) {
        console.error('❌ Error generating sample data:', error);
    } finally {
        await mongoose.disconnect();
    }
};

generateSampleData();
