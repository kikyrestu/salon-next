require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

// Define store schema manually for the seed script
const storeSchema = new mongoose.Schema({
    name: String,
    slug: String,
    dbUri: String,
    isActive: Boolean
}, { timestamps: true });

async function seedMaster() {
    try {
        console.log('Connecting to Master DB...', process.env.MASTER_MONGODB_URI);
        const conn = await mongoose.connect(process.env.MASTER_MONGODB_URI);
        
        const Store = conn.model('Store', storeSchema);
        
        // Check if pusat already exists
        const existing = await Store.findOne({ slug: 'pusat' });
        if (existing) {
            console.log('Pusat store already exists!');
            process.exit(0);
        }
        
        await Store.create({
            name: 'Cabang Pusat',
            slug: 'pusat',
            dbUri: process.env.MONGODB_URI,
            isActive: true
        });
        
        console.log('✅ Seeded Cabang Pusat successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding:', error);
        process.exit(1);
    }
}

seedMaster();
