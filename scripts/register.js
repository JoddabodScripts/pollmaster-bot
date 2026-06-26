/**
 * Register the bot's slash commands with the Nerimity API.
 *
 * Usage: node scripts/register.js
 */

const { loadEnv } = require('../src/env');

loadEnv();

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('BOT_TOKEN environment variable is required');
  process.exit(1);
}

const body = {
  commands: [
    {
      name: 'poll',
      description: 'Create a poll with multiple options and flags',
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
