const fs = require('fs');
const path = require('path');

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const idx = trimmed.indexOf('=');
  if (idx === -1) return null;

  const key = trimmed.slice(0, idx).trim();
  let value = trimmed.slice(idx + 1).trim();

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

function loadEnvFile(relativeFilePath) {
  const filePath = path.resolve(process.cwd(), relativeFilePath || '.env.local');
  if (!fs.existsSync(filePath)) {
    throw new Error(`Env file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const entry = parseEnvLine(line);
    if (!entry) continue;
    if (!process.env[entry.key]) {
      process.env[entry.key] = entry.value;
    }
  }

  return filePath;
}

module.exports = { loadEnvFile };
