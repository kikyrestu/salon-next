const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function seed() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // We can't easily import TS files directly via Node right now without ts-node,
    // so I will skip this approach.
    console.log('Connected');
    process.exit(0);
}
seed();