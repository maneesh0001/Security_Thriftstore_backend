// scripts/debugDatabase.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const debugDatabase = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/authapp');
        console.log('Connected to MongoDB');
        
        // List all collections
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        console.log('\nCollections in database:');
        collections.forEach(col => console.log(`  - ${col.name}`));
        
        // Check if orders collection exists and has documents
        if (collections.some(col => col.name === 'orders')) {
            const ordersCount = await db.collection('orders').countDocuments();
            console.log(`\nOrders collection has ${ordersCount} documents`);
            
            if (ordersCount > 0) {
                // Get a sample order
                const sampleOrder = await db.collection('orders').findOne();
                console.log('\nSample order structure:');
                console.log(JSON.stringify(sampleOrder, null, 2));
            }
        }
        
        await mongoose.disconnect();
    } catch (error) {
        console.error('Error debugging database:', error);
        process.exit(1);
    }
};

debugDatabase();
