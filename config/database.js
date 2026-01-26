// 📁 backend/config/database.js

// 1. Changed from 'require' to 'import'
import mongoose from 'mongoose';

const connectDb = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected successfully');
  } catch (err) {
    // It's better to log err.message for a cleaner error log
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

// 2. Changed from 'module.exports' to 'export default'
export default connectDb;