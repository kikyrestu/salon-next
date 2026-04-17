const fs = require('fs');
const path = require('path');
const { loadEnvFile } = require('./_utils/loadEnvFile');
const { connectMongo, disconnectMongo, mongoose } = require('./_utils/mongo');

function parseArg(name, defaultValue) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  if (!found) return defaultValue;
  return found.slice(prefix.length);
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function resolveMigrationFile(migrationArg) {
  const migrationsDir = path.resolve(process.cwd(), 'scripts/migrations');

  if (!migrationArg) {
    throw new Error('Missing migration file. Use --file=<filename.js>');
  }

  const candidate = migrationArg.endsWith('.js') ? migrationArg : `${migrationArg}.js`;
  return path.resolve(migrationsDir, candidate);
}

function listMigrations() {
  const migrationsDir = path.resolve(process.cwd(), 'scripts/migrations');
  const files = fs.existsSync(migrationsDir)
    ? fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.js')).sort()
    : [];

  if (!files.length) {
    console.log('No migration files found in scripts/migrations');
    return;
  }

  console.log('Available migrations:');
  for (const file of files) {
    console.log(`- ${file}`);
  }
}

async function run() {
  if (hasFlag('list')) {
    listMigrations();
    return;
  }

  const envFile = parseArg('env', '.env.local');
  const migrationArg = parseArg('file');
  const direction = parseArg('direction', 'up');

  if (!['up', 'down'].includes(direction)) {
    throw new Error('Invalid --direction. Use up or down.');
  }

  const loadedEnvPath = loadEnvFile(envFile);
  const migrationFile = resolveMigrationFile(migrationArg);

  if (!fs.existsSync(migrationFile)) {
    throw new Error(`Migration file not found: ${migrationFile}`);
  }

  const migration = require(migrationFile);
  const handler = migration[direction];

  if (typeof handler !== 'function') {
    throw new Error(`Migration ${path.basename(migrationFile)} does not export ${direction}() function.`);
  }

  console.log(`Using env file: ${loadedEnvPath}`);
  console.log(`Running migration: ${path.basename(migrationFile)} (${direction})`);

  await connectMongo();

  try {
    const db = mongoose.connection.db;
    const result = await handler({ db, mongoose });
    console.log('Migration completed successfully.');
    if (result !== undefined) {
      console.log('Result:', result);
    }
  } finally {
    await disconnectMongo();
  }
}

run().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exit(1);
});
