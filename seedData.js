// Seed script to populate database with sample data
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import Order from './models/order.js';
import User from './models/user.js';
import Product from './models/product.js';

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thriftstore');
    console.log('✅ Connected to database');

    // Clear existing data
    await Order.deleteMany({});
    await User.deleteMany({});
    await Product.deleteMany({});
    console.log('🗑️ Cleared existing data');

    // Create sample users
    const hashedPassword = await bcrypt.hash('password123', 12);
    
    const adminUser = new User({
      name: 'Admin User',
      email: 'admin@thriftstore.com',
      password: hashedPassword,
      role: 'admin',
      isEmailVerified: true
    });

    const sampleUsers = [
      adminUser,
      new User({
        name: 'Sarah Johnson',
        email: 'sarah@example.com',
        password: hashedPassword,
        role: 'user',
        isEmailVerified: true
      }),
      new User({
        name: 'Mike Chen',
        email: 'mike@example.com',
        password: hashedPassword,
        role: 'user',
        isEmailVerified: true
      }),
      new User({
        name: 'Emma Davis',
        email: 'emma@example.com',
        password: hashedPassword,
        role: 'user',
        isEmailVerified: true
      }),
      new User({
        name: 'John Smith',
        email: 'john@example.com',
        password: hashedPassword,
        role: 'user',
        isEmailVerified: true
      })
    ];

    const savedUsers = await User.insertMany(sampleUsers);
    console.log(`👥 Created ${savedUsers.length} users`);

    // Create sample products
    const sampleProducts = [
      {
        name: 'Vintage Leather Jacket',
        price: 89.99,
        category: 'Clothing',
        stock: 5,
        description: 'Classic vintage leather jacket in excellent condition',
        image: 'https://images.unsplash.com/photo-1551024601-b0e407a9c82c?w=300'
      },
      {
        name: 'Retro Denim Jeans',
        price: 45.99,
        category: 'Clothing',
        stock: 12,
        description: 'Classic retro-style denim jeans',
        image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=300'
      },
      {
        name: 'Antique Pocket Watch',
        price: 156.50,
        category: 'Accessories',
        stock: 2,
        description: 'Beautiful antique pocket watch from 1920s',
        image: 'https://images.unsplash.com/photo-1524592094719-6bb31f585a23?w=300'
      },
      {
        name: 'Vintage Camera',
        price: 234.99,
        category: 'Electronics',
        stock: 3,
        description: 'Classic vintage film camera in working condition',
        image: 'https://images.unsplash.com/photo-1526170375888-9b50a2a4e1b3?w=300'
      },
      {
        name: 'Retro Sunglasses',
        price: 34.75,
        category: 'Accessories',
        stock: 8,
        description: 'Cool retro-style sunglasses',
        image: 'https://images.unsplash.com/photo-1473496169904-658ba7c44d8f?w=300'
      },
      {
        name: 'Classic Vinyl Record',
        price: 67.25,
        category: 'Music',
        stock: 15,
        description: 'Vintage vinyl record in good condition',
        image: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=300'
      }
    ];

    const savedProducts = await Product.insertMany(sampleProducts);
    console.log(`🛍️ Created ${savedProducts.length} products`);

    // Create sample orders
    const sampleOrders = [
      {
        user: savedUsers[1]._id, // Sarah Johnson
        customerName: 'Sarah Johnson',
        orderNumber: 'ORD-001',
        status: 'delivered',
        paymentStatus: 'paid',
        subtotal: 89.99,
        tax: 8.10,
        shipping: 5.00,
        discount: 0,
        total: 103.09,
        orderType: 'standard',
        priority: 'normal',
        items: [{
          product: savedProducts[0]._id, // Vintage Leather Jacket
          quantity: 1,
          price: 89.99,
          subtotal: 89.99
        }],
        shippingAddress: {
          firstName: 'Sarah',
          lastName: 'Johnson',
          address: '123 Main St',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          phone: '555-0123'
        },
        orderDate: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        deliveredAt: new Date(Date.now() - 1 * 60 * 60 * 1000) // 1 hour ago
      },
      {
        user: savedUsers[2]._id, // Mike Chen
        customerName: 'Mike Chen',
        orderNumber: 'ORD-002',
        status: 'shipped',
        paymentStatus: 'paid',
        subtotal: 45.99,
        tax: 4.14,
        shipping: 5.00,
        discount: 0,
        total: 55.13,
        orderType: 'standard',
        priority: 'normal',
        items: [{
          product: savedProducts[1]._id, // Retro Denim Jeans
          quantity: 1,
          price: 45.99,
          subtotal: 45.99
        }],
        shippingAddress: {
          firstName: 'Mike',
          lastName: 'Chen',
          address: '456 Oak Ave',
          city: 'Los Angeles',
          state: 'CA',
          postalCode: '90001',
          phone: '555-0124'
        },
        orderDate: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        shippedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
      },
      {
        user: savedUsers[3]._id, // Emma Davis
        customerName: 'Emma Davis',
        orderNumber: 'ORD-003',
        status: 'pending',
        paymentStatus: 'pending',
        subtotal: 156.50,
        tax: 14.09,
        shipping: 7.50,
        discount: 10.00,
        total: 168.09,
        orderType: 'express',
        priority: 'high',
        items: [{
          product: savedProducts[2]._id, // Antique Pocket Watch
          quantity: 1,
          price: 156.50,
          subtotal: 156.50
        }],
        shippingAddress: {
          firstName: 'Emma',
          lastName: 'Davis',
          address: '789 Pine St',
          city: 'Chicago',
          state: 'IL',
          postalCode: '60007',
          phone: '555-0125'
        },
        orderDate: new Date(Date.now() - 6 * 60 * 60 * 1000) // 6 hours ago
      },
      {
        user: savedUsers[4]._id, // John Smith
        customerName: 'John Smith',
        orderNumber: 'ORD-004',
        status: 'processing',
        paymentStatus: 'paid',
        subtotal: 234.99,
        tax: 21.15,
        shipping: 10.00,
        discount: 0,
        total: 266.14,
        orderType: 'standard',
        priority: 'normal',
        items: [{
          product: savedProducts[3]._id, // Vintage Camera
          quantity: 1,
          price: 234.99,
          subtotal: 234.99
        }],
        shippingAddress: {
          firstName: 'John',
          lastName: 'Smith',
          address: '321 Elm St',
          city: 'Houston',
          state: 'TX',
          postalCode: '77001',
          phone: '555-0126'
        },
        orderDate: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
        processedAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago
      },
      {
        user: savedUsers[1]._id, // Sarah Johnson (another order)
        customerName: 'Sarah Johnson',
        orderNumber: 'ORD-005',
        status: 'confirmed',
        paymentStatus: 'paid',
        subtotal: 102.00,
        tax: 9.18,
        shipping: 5.00,
        discount: 0,
        total: 116.18,
        orderType: 'standard',
        priority: 'normal',
        items: [
          {
            product: savedProducts[4]._id, // Retro Sunglasses
            quantity: 1,
            price: 34.75,
            subtotal: 34.75
          },
          {
            product: savedProducts[5]._id, // Classic Vinyl Record
            quantity: 1,
            price: 67.25,
            subtotal: 67.25
          }
        ],
        shippingAddress: {
          firstName: 'Sarah',
          lastName: 'Johnson',
          address: '123 Main St',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          phone: '555-0123'
        },
        orderDate: new Date(Date.now() - 10 * 60 * 60 * 1000), // 10 hours ago
        confirmedAt: new Date(Date.now() - 5 * 60 * 60 * 1000) // 5 hours ago
      }
    ];

    const savedOrders = await Order.insertMany(sampleOrders);
    console.log(`📦 Created ${savedOrders.length} orders`);

    await mongoose.disconnect();
    console.log('✅ Database seeded successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Users: ${savedUsers.length}`);
    console.log(`   - Products: ${savedProducts.length}`);
    console.log(`   - Orders: ${savedOrders.length}`);
    console.log(`   - Total Revenue: Rs. ${savedOrders.reduce((sum, order) => sum + order.total, 0).toFixed(2)}`);
    console.log('\n🔑 Admin Login:');
    console.log('   Email: admin@thriftstore.com');
    console.log('   Password: password123');
    
  } catch (error) {
    console.error('❌ Seeding error:', error);
  }
};

seedData();
