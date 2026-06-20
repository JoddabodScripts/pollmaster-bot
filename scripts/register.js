const fs = require('fs');
const path = require('path');

// Load .env manually
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch {}

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('BOT_TOKEN environment variable is required');
  process.exit(1);
}

const body = {
  commands: [
    {
      name: 'poll',
      description:
        'Create a poll with multiple options and flags',
      args: '',
    },
  ],
};

async function main() {
  console.log('Registering slash commands...');
  const res = await fetch('https://nerimity.com/api/applications/bot/commands', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (res.ok) {
    console.log('Commands registered successfully:', JSON.stringify(data, null, 2));
  } else {
    console.error('Failed to register commands:', JSON.stringify(data, null, 2));
    process.exit(1);
  }
}

main();
