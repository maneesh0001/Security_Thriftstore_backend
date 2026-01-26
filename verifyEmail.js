// Quick script to manually verify an email address
// Run this with: node verifyEmail.js

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/user.js';

dotenv.config();

const verifyEmail = async (email) => {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to database');

        // Find user by email
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            console.log('❌ User not found with email:', email);
            process.exit(1);
        }

        if (user.isEmailVerified) {
            console.log('✅ Email is already verified for:', email);
            process.exit(0);
        }

        // Verify the email
        user.isEmailVerified = true;
        user.emailVerificationToken = null;
        user.emailVerificationExpires = null;
        await user.save();

        console.log('✅ Email verified successfully for:', email);
        console.log('You can now log in!');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

// Get email from command line argument
const email = process.argv[2];

if (!email) {
    console.log('Usage: node verifyEmail.js <email>');
    console.log('Example: node verifyEmail.js ajcen0001@gmail.com');
    process.exit(1);
}

verifyEmail(email);
