const mongoose = require('mongoose');

async function checkLog() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/salon-next');
    
    const db = mongoose.connection.useDb('salon_pusat');
    const WaCampaignQueue = db.collection('wacampaignqueues');
    
    const logs = await WaCampaignQueue.find().sort({ createdAt: -1 }).limit(1).toArray();
    console.dir(logs, { depth: null });
    
    mongoose.disconnect();
}

require('dotenv').config({ path: '.env.local' });
checkLog().catch(console.error);
