// Test script to check database content
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from './models/order.js';
import User from './models/user.js';
import Product from './models/product.js';

dotenv.config();

const checkDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thriftstore');
    console.log('✅ Connected to database');

    // Check orders
    const orderCount = await Order.countDocuments();
    console.log(`📦 Orders: ${orderCount}`);
    
    if (orderCount > 0) {
      const recentOrders = await Order.find().limit(3);
      console.log('Recent orders:', recentOrders.map(o => ({ 
        id: o._id, 
        orderNumber: o.orderNumber, 
        total: o.total, 
        status: o.status 
      })));
    }

    // Check users
    const userCount = await User.countDocuments();
    console.log(`👥 Users: ${userCount}`);
    
    if (userCount > 0) {
      const users = await User.find().limit(3);
      console.log('Users:', users.map(u => ({ 
        id: u._id, 
        name: u.name, 
        email: u.email, 
        role: u.role 
      })));
    }

    // Check products
    const productCount = await Product.countDocuments();
    console.log(`🛍️ Products: ${productCount}`);
    
    if (productCount > 0) {
      const products = await Product.find().limit(3);
      console.log('Products:', products.map(p => ({ 
        id: p._id, 
        name: p.name, 
        price: p.price, 
        stock: p.stock 
      })));
    }

    await mongoose.disconnect();
    console.log('✅ Database check complete');
  } catch (error) {
    console.error('❌ Database error:', error);
  }
};

checkDatabase();
