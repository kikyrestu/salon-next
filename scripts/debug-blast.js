// Direct test: run processPendingCampaigns manually to see logs
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  // Get settings
  const settings = await db.collection('settings').findOne({});
  const token = (settings?.fonnteToken || process.env.FONNTE_TOKEN || '').trim();
  
  console.log('Token:', token ? token.substring(0,8) + '...' : 'NONE');

  // Get first pending campaign
  const campaign = await db.collection('wacampaignqueues').findOne({
    status: { $in: ['pending', 'processing'] }
  });

  if (!campaign) {
    console.log('No pending campaigns found');
    await mongoose.disconnect();
    return;
  }

  console.log('Found campaign:', campaign.campaignName, '| status:', campaign.status);
  console.log('Targets:', campaign.targets.length);

  // Get first pending target
  const target = campaign.targets.find(t => t.status === 'pending');
  if (!target) {
    console.log('No pending targets');
    await mongoose.disconnect();
    return;
  }

  console.log('First pending target:', target.phone);

  // Get customer name
  const customer = await db.collection('customers').findOne({ _id: target.customerId });
  console.log('Customer:', customer?.name || 'NOT FOUND');

  // Try sending WA directly
  console.log('\n=== SENDING WA TEST ===');
  const personalizedMsg = campaign.message.replace(/{{nama_customer}}/gi, customer?.name || 'Pelanggan');
  console.log('Message:', personalizedMsg.substring(0, 100) + '...');
  console.log('Phone:', target.phone);

  try {
    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: JSON.stringify({
        target: target.phone,
        message: personalizedMsg,
      }),
    });
    const text = await res.text();
    console.log('HTTP status:', res.status);
    console.log('Response:', text);

    // Parse response
    const parsed = JSON.parse(text);
    if (parsed.status === true) {
      console.log('\n✅ WA SENT SUCCESSFULLY!');
      // Update target status in DB
      await db.collection('wacampaignqueues').updateOne(
        { _id: campaign._id, 'targets._id': target._id },
        { $set: { 'targets.$.status': 'sent', 'targets.$.sentAt': new Date() } }
      );
      console.log('Updated target status to sent');
    } else {
      console.log('\n❌ FONNTE RETURNED ERROR:', parsed.reason || parsed.detail);
    }
  } catch (e) {
    console.log('❌ Error:', e.message);
  }

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
