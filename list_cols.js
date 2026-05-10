const mongoose = require('mongoose');

async function listCols() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const cols = await db.listCollections().toArray();
    
    // Check if there is WaBlastLogs or similar
    if (cols.some(c => c.name.toLowerCase().includes('wa'))) {
        for (const c of cols) {
            if (c.name.toLowerCase().includes('wa')) {
                const count = await db.collection(c.name).countDocuments();
                console.log(`${c.name}: ${count}`);
                if (count > 0) {
                    const latest = await db.collection(c.name).find().sort({_id: -1}).limit(1).toArray();
                    console.dir(latest, { depth: null });
                }
            }
        }
    }
    
    mongoose.disconnect();
}

require('dotenv').config({ path: '.env.local' });
listCols().catch(console.error);
