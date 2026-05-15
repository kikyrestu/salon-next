const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });
async function fix() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  await db.collection('wacampaignqueues').updateOne({ _id: new mongoose.Types.ObjectId('6a06b6f9c7c91e4e124ee9a3') }, { $set: { status: 'pending' } });
  console.log('Fixed stuck campaign to pending');
  await mongoose.disconnect();
}
fix().catch(console.error);
