/*
 Adds `source` field to customer documents for lead/channel tracking.
 Safe to rerun: only updates docs where source does not exist.
*/

module.exports.up = async ({ db }) => {
  const result = await db.collection('customers').updateMany(
    { source: { $exists: false } },
    { $set: { source: 'offline-walkin' } }
  );

  return {
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
  };
};

module.exports.down = async ({ db }) => {
  const result = await db.collection('customers').updateMany(
    { source: 'offline-walkin' },
    { $unset: { source: '' } }
  );

  return {
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
  };
};
