require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('salon-dev'); // adjust if needed
  
  const latest = await db.collection('invoices')
     .find({ invoiceNumber: /^INV-2026-/ })
     .sort({ invoiceNumber: -1 })
     .limit(1)
     .toArray();
     
  if (latest.length > 0) {
     const seqStr = latest[0].invoiceNumber.split('-')[2];
     const seq = parseInt(seqStr, 10);
     await db.collection('counters').updateOne({_id: 'INV-2026'}, {'$set': {seq: seq}});
     console.log('Counter updated to', seq);
  } else {
     console.log('No invoices found');
  }
  await client.close();
}

run().catch(console.error);