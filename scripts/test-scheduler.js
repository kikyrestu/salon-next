const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });
const { processPendingCampaigns } = require('../lib/scheduler');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('--- DB CONNECTED ---');
  await processPendingCampaigns();
  console.log('--- DONE ---');
  await mongoose.disconnect();
}

test().catch(e => { console.error(e); process.exit(1); });
