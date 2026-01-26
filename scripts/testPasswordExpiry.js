// scripts/testPasswordExpiry.js
import mongoose from 'mongoose';
import User from '../models/user.js';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const testPasswordExpiry = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/authapp');
        console.log('Connected to MongoDB');

        // Find a test user (or create one)
        let testUser = await User.findOne({ email: 'test@example.com' });
        
        if (!testUser) {
            // Create a test user with an old password
            const hashedPassword = await bcrypt.hash('testpassword123', 12);
            testUser = new User({
                name: 'Test User',
                email: 'test@example.com',
                password: hashedPassword,
                role: 'user',
                passwordChangedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days ago
                isEmailVerified: true
            });
            await testUser.save();
            console.log('Created test user with expired password');
        } else {
            // Update existing user to have expired password
            testUser.passwordChangedAt = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000); // 100 days ago
            await testUser.save();
            console.log('Updated test user with expired password');
        }

        // Check password expiry
        const passwordChangedAt = testUser.passwordChangedAt;
        const passwordAge = Date.now() - new Date(passwordChangedAt).getTime();
        const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days
        const isExpired = passwordAge > maxAge;
        const daysOverdue = Math.floor(passwordAge / (24 * 60 * 60 * 1000)) - 90;

        console.log(`\n=== Password Expiry Test Results ===`);
        console.log(`User: ${testUser.email}`);
        console.log(`Password changed at: ${passwordChangedAt}`);
        console.log(`Password age: ${Math.floor(passwordAge / (24 * 60 * 60 * 1000))} days`);
        console.log(`Is expired: ${isExpired}`);
        if (isExpired) {
            console.log(`Days overdue: ${daysOverdue}`);
        }

        // Test with a fresh password (not expired)
        testUser.passwordChangedAt = new Date();
        await testUser.save();
        
        const freshPasswordAge = Date.now() - new Date(testUser.passwordChangedAt).getTime();
        const isFreshExpired = freshPasswordAge > maxAge;
        const daysUntilExpiry = Math.ceil((maxAge - freshPasswordAge) / (24 * 60 * 60 * 1000));

        console.log(`\n=== Fresh Password Test Results ===`);
        console.log(`Password changed at: ${testUser.passwordChangedAt}`);
        console.log(`Password age: ${Math.floor(freshPasswordAge / (24 * 60 * 60 * 1000))} days`);
        console.log(`Is expired: ${isFreshExpired}`);
        console.log(`Days until expiry: ${daysUntilExpiry}`);

        console.log('\n✅ Password expiry test completed!');
        
        await mongoose.disconnect();
    } catch (error) {
        console.error('Error testing password expiry:', error);
        process.exit(1);
    }
};

testPasswordExpiry();
