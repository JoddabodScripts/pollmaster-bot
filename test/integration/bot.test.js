const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { createSandbox, RolePermissions } = require('neritest-js');

const DATA_FILE = path.join(__dirname, '..', '..', 'data', 'polls.json');
const BOT_ENTRY = path.join(__dirname, '..', '..', 'src', 'index.js');

function waitFor(fn, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      let result;
      try {
        result = fn();
      } catch {
        result = false;
      }
      if (result) return resolve();
      if (Date.now() - start > timeout) return reject(new Error('waitFor timed out'));
      setTimeout(tick, 15);
    };
    tick();
  });
}

let sandbox;
let botId;
let dataFileBackup;

before(async () => {
  // PollManager writes to the real data/polls.json (its path isn't
  // injectable from index.js), so protect the developer's local poll
  // data around this suite instead of clobbering it.
  dataFileBackup = fs.existsSync(DATA_FILE) ? fs.readFileSync(DATA_FILE, 'utf-8') : null;
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, '{}');

  process.env.BOT_TOKEN = process.env.BOT_TOKEN || 'test-token';

  sandbox = createSandbox();
  await sandbox.loadBot(BOT_ENTRY);
  botId = sandbox.bot.id;
  await waitFor(() => sandbox.gateway.connectionCount >= 1);
});

after(async () => {
  await sandbox.close();
  if (dataFileBackup !== null) {
    fs.writeFileSync(DATA_FILE, dataFileBackup);
  } else {
    fs.rmSync(DATA_FILE, { force: true });
  }
});

/** Each test gets its own server/channel so polls never bleed across tests. */
function makeWorld(name) {
  const server = sandbox.createServer({ name });
  const channel = server.createChannel({ name: 'general' });
  const alice = sandbox.createUser({ username: `Alice-${name}` });
  const bob = sandbox.createUser({ username: `Bob-${name}` });
  server.addMember(alice);
  server.addMember(bob);
  return { server, channel, alice, bob };
}

function poll(channel, user, text) {
  return channel.send(user, `/poll:${botId} ${text}`);
}

// ── help & guidance ───────────────────────────────────────────

test('/poll help replies with usage instructions', async () => {
  const { channel, alice } = makeWorld('help');
  poll(channel, alice, 'help');
  await waitFor(() => channel.lastMessage?.content?.includes('no quotes needed'));
});

test('/poll with bare words and no separator asks for a separator', async () => {
  const { channel, alice } = makeWorld('bareword');
  poll(channel, alice, "What's for lunch");
  await waitFor(() => channel.lastMessage?.content?.includes("can't tell where the question ends"));
});

test('/poll with nothing at all sends help', async () => {
  const { channel, alice } = makeWorld('empty');
  poll(channel, alice, '');
  await waitFor(() => channel.lastMessage?.content?.includes('no quotes needed'));
});

test('/poll with fewer than 2 options is rejected', async () => {
  const { channel, alice } = makeWorld('toofew');
  poll(channel, alice, 'Q? | OnlyOne');
  await waitFor(() => channel.lastMessage?.content?.includes('needs a question and at least 2 options'));
});

test('/poll with more than 10 options is rejected', async () => {
  const { channel, alice } = makeWorld('toomany');
  const opts = Array.from({ length: 11 }, (_, i) => `Opt${i}`).join(' | ');
  poll(channel, alice, `Q? | ${opts}`);
  await waitFor(() => channel.lastMessage?.content === 'Maximum 10 options allowed.');
});

test('/poll with an unparseable --time is rejected', async () => {
  const { channel, alice } = makeWorld('badtime');
  poll(channel, alice, 'Q? | A | B --time whenever');
  await waitFor(() => channel.lastMessage?.content?.includes("couldn't understand the duration"));
});

test('/poll end with no active poll in the channel', async () => {
  const { channel, alice } = makeWorld('noend');
  poll(channel, alice, 'end');
  await waitFor(() => channel.lastMessage?.content === 'No active poll found in this channel.');
});

// ── creating & rendering polls ───────────────────────────────

test('creates a poll with pipe syntax and renders question + buttons', async () => {
  const { channel, alice } = makeWorld('create-pipes');
  poll(channel, alice, 'Favorite color? | Red | Blue | Green');
  await waitFor(() => channel.lastMessage?.htmlEmbed?.includes('Favorite color?'));

  const msg = channel.lastMessage;
  assert.equal(msg.content, '​');
  assert.deepEqual(msg.buttons.map((b) => b.label), ['Red', 'Blue', 'Green']);
  assert.ok(msg.htmlEmbed.includes('Anonymous poll'));
});

test('creates a poll with quoted syntax', async () => {
  const { channel, alice } = makeWorld('create-quotes');
  poll(channel, alice, '"Best pet?" "Cat" "Dog"');
  await waitFor(() => channel.lastMessage?.htmlEmbed?.includes('Best pet?'));
  assert.deepEqual(channel.lastMessage.buttons.map((b) => b.label), ['Cat', 'Dog']);
});

test('creates a poll with newline-separated syntax', async () => {
  const { channel, alice } = makeWorld('create-lines');
  poll(channel, alice, 'Best season?\nSummer\nWinter');
  await waitFor(() => channel.lastMessage?.htmlEmbed?.includes('Best season?'));
  assert.deepEqual(channel.lastMessage.buttons.map((b) => b.label), ['Summer', 'Winter']);
});

test('--public poll shows privacy label as public', async () => {
  const { channel, alice } = makeWorld('create-public');
  poll(channel, alice, 'Q? | A | B --public');
  await waitFor(() => channel.lastMessage?.htmlEmbed?.includes('Public poll'));
});

// ── voting: single-choice ────────────────────────────────────

test('single-choice: voting records the vote and updates the embed', async () => {
  const { channel, alice } = makeWorld('vote-single');
  poll(channel, alice, 'Q? | Red | Blue');
  await waitFor(() => channel.lastMessage?.htmlEmbed?.includes('Q?'));
  const msg = channel.lastMessage;

  msg.clickButton(alice, '0');
  await waitFor(() => msg.htmlEmbed?.includes('<strong>1</strong> vote'));
});

test('single-choice: clicking the same option again un-votes', async () => {
  const { channel, alice } = makeWorld('vote-untoggle');
  poll(channel, alice, 'Q? | Red | Blue');
  await waitFor(() => channel.lastMessage?.htmlEmbed?.includes('Q?'));
  const msg = channel.lastMessage;

  msg.clickButton(alice, '0');
  await waitFor(() => msg.htmlEmbed?.includes('<strong>1</strong> vote'));

  msg.clickButton(alice, '0');
  await waitFor(() => msg.htmlEmbed?.includes('Total: 0 votes'));
});

test('single-choice: switching to a different option moves the vote, not adds one', async () => {
  const { channel, alice } = makeWorld('vote-switch');
  poll(channel, alice, 'Q? | Red | Blue');
  await waitFor(() => channel.lastMessage?.htmlEmbed?.includes('Q?'));
  const msg = channel.lastMessage;

  msg.clickButton(alice, '0');
  await waitFor(() => msg.htmlEmbed?.includes('Total: 1 vote'));

  msg.clickButton(alice, '1');
  await waitFor(() => msg.htmlEmbed?.includes('Blue — <strong>1</strong>'));
  assert.ok(msg.htmlEmbed.includes('Red — <strong>0</strong>'));
});

test('button click on a closed poll gets an ephemeral "ended" response, no vote recorded', async () => {
  const { channel, alice } = makeWorld('vote-closed');
  poll(channel, alice, 'Q? | Red | Blue');
  await waitFor(() => channel.lastMessage?.htmlEmbed?.includes('Q?'));
  const msg = channel.lastMessage;

  poll(channel, alice, 'end');
  await waitFor(() => channel.lastMessage?.content?.includes('has been closed'));

  msg.clickButton(alice, '0');
  // closed polls never touch the embed again — give it a moment, then assert nothing changed.
  await new Promise((r) => setTimeout(r, 150));
  assert.ok(!msg.htmlEmbed.includes('<strong>1</strong> vote'));
});

// ── voting: multiple-choice ───────────────────────────────────

test('multiple-choice: a voter can select more than one option', async () => {
  const { channel, alice } = makeWorld('vote-multi');
  poll(channel, alice, 'Q? | Red | Blue | Green --multiple');
  await waitFor(() => channel.lastMessage?.htmlEmbed?.includes('Q?'));
  const msg = channel.lastMessage;

  msg.clickButton(alice, '0');
  await waitFor(() => msg.htmlEmbed?.includes('Total: 1 vote'));

  msg.clickButton(alice, '1');
  await waitFor(() => msg.htmlEmbed?.includes('Total: 2 votes'));
});

test('multiple-choice: re-clicking an already-selected option removes only that one', async () => {
  const { channel, alice } = makeWorld('vote-multi-untoggle');
  poll(channel, alice, 'Q? | Red | Blue | Green --multiple');
  await waitFor(() => channel.lastMessage?.htmlEmbed?.includes('Q?'));
  const msg = channel.lastMessage;

  msg.clickButton(alice, '0');
  msg.clickButton(alice, '1');
  await waitFor(() => msg.htmlEmbed?.includes('Total: 2 votes'));

  msg.clickButton(alice, '0');
  await waitFor(() => msg.htmlEmbed?.includes('Total: 1 vote'));
});

// ── ending polls & permissions ─────────────────────────────────

test('creator can end their own poll', async () => {
  const { channel, alice } = makeWorld('end-creator');
  poll(channel, alice, 'Q? | A | B');
  await waitFor(() => channel.lastMessage?.htmlEmbed?.includes('Q?'));

  poll(channel, alice, 'end');
  await waitFor(() => channel.lastMessage?.content === 'Poll **"Q?"** has been closed.');
});

test('a non-creator, non-admin cannot end someone else\'s poll', async () => {
  const { channel, alice, bob } = makeWorld('end-forbidden');
  poll(channel, alice, 'Q? | A | B');
  await waitFor(() => channel.lastMessage?.htmlEmbed?.includes('Q?'));

  poll(channel, bob, 'end');
  await waitFor(() => channel.lastMessage?.content === 'Only the poll creator or an admin can end this poll.');
});

test('an admin can end someone else\'s poll', async () => {
  const { server, channel, alice, bob } = makeWorld('end-admin');
  const adminRole = server.createRole({ name: 'Admin', permissions: RolePermissions.ADMIN });
  server.giveRole(bob, adminRole);

  poll(channel, alice, 'Q? | A | B');
  await waitFor(() => channel.lastMessage?.htmlEmbed?.includes('Q?'));

  poll(channel, bob, 'end');
  await waitFor(() => channel.lastMessage?.content === 'Poll **"Q?"** has been closed.');
});

test('ending a poll removes its buttons and shows results', async () => {
  const { channel, alice } = makeWorld('end-results');
  poll(channel, alice, 'Q? | A | B');
  await waitFor(() => channel.lastMessage?.htmlEmbed?.includes('Q?'));
  const msg = channel.lastMessage;

  msg.clickButton(alice, '0');
  await waitFor(() => msg.htmlEmbed?.includes('Total: 1 vote'));

  poll(channel, alice, 'end');
  await waitFor(() => channel.lastMessage?.content?.includes('has been closed'));
  await waitFor(() => msg.htmlEmbed?.includes('(closed)'));

  assert.deepEqual(msg.buttons, []);
});

// ── list & results ─────────────────────────────────────────────

test('/poll list shows open polls with counts', async () => {
  const { channel, alice } = makeWorld('list');
  poll(channel, alice, 'Q1? | A | B');
  await waitFor(() => channel.lastMessage?.htmlEmbed?.includes('Q1?'));
  poll(channel, alice, 'Q2? | C | D');
  await waitFor(() => channel.lastMessage?.htmlEmbed?.includes('Q2?'));

  poll(channel, alice, 'list');
  await waitFor(() => channel.lastMessage?.content?.includes('Open polls in this channel'));
  assert.ok(channel.lastMessage.content.includes('Q1?'));
  assert.ok(channel.lastMessage.content.includes('Q2?'));
});

test('/poll list says so when there are no open polls', async () => {
  const { channel, alice } = makeWorld('list-empty');
  poll(channel, alice, 'list');
  await waitFor(() => channel.lastMessage?.content === 'No open polls in this channel.');
});

test('/poll end <n> closes a specific poll from the list', async () => {
  const { channel, alice } = makeWorld('end-by-index');
  poll(channel, alice, 'Q1? | A | B');
  await waitFor(() => channel.lastMessage?.htmlEmbed?.includes('Q1?'));
  poll(channel, alice, 'Q2? | C | D');
  await waitFor(() => channel.lastMessage?.htmlEmbed?.includes('Q2?'));

  poll(channel, alice, 'end 1');
  await waitFor(() => channel.lastMessage?.content === 'Poll **"Q1?"** has been closed.');

  poll(channel, alice, 'list');
  await waitFor(() => channel.lastMessage?.content?.includes('Open polls in this channel'));
  assert.ok(!channel.lastMessage.content.includes('Q1?'));
  assert.ok(channel.lastMessage.content.includes('Q2?'));
});

test('/poll end <n> out of range is rejected', async () => {
  const { channel, alice } = makeWorld('end-oor');
  poll(channel, alice, 'Q1? | A | B');
  await waitFor(() => channel.lastMessage?.htmlEmbed?.includes('Q1?'));

  poll(channel, alice, 'end 5');
  await waitFor(() => channel.lastMessage?.content?.includes('not found'));
});

test('/poll results reposts the last closed poll\'s tally', async () => {
  const { channel, alice } = makeWorld('results');
  poll(channel, alice, 'Q? | A | B');
  await waitFor(() => channel.lastMessage?.htmlEmbed?.includes('Q?'));
  const pollMsg = channel.lastMessage;
  pollMsg.clickButton(alice, '0');
  await waitFor(() => pollMsg.htmlEmbed?.includes('Total: 1 vote'));

  poll(channel, alice, 'end');
  await waitFor(() => channel.lastMessage?.content?.includes('has been closed'));

  poll(channel, alice, 'results');
  await waitFor(() => channel.lastMessage?.htmlEmbed?.includes('(closed)'));
  assert.ok(channel.lastMessage.htmlEmbed.includes('Q?'));
});

test('/poll results with nothing closed yet', async () => {
  const { channel, alice } = makeWorld('results-none');
  poll(channel, alice, 'Q? | A | B');
  await waitFor(() => channel.lastMessage?.htmlEmbed?.includes('Q?'));

  poll(channel, alice, 'results');
  await waitFor(() => channel.lastMessage?.content === 'No closed poll found in this channel.');
});

// ── --time countdown ──────────────────────────────────────────
//
// index.js arms auto-close with a real `setTimeout`, not the sandbox's
// virtual clock, so `sandbox.advanceTime()` can't fast-forward it here.
// We only check that the countdown label renders, and end the poll
// ourselves afterward so we don't leave a real 10-minute timer running
// past the end of the test process.

test('a poll with --time shows a "closes in" countdown on creation', async () => {
  const { channel, alice } = makeWorld('autoclose');
  poll(channel, alice, 'Q? | A | B --time 10m');
  await waitFor(() => channel.lastMessage?.htmlEmbed?.includes('Q?'));
  assert.ok(channel.lastMessage.htmlEmbed.includes('closes in'));

  poll(channel, alice, 'end');
  await waitFor(() => channel.lastMessage?.content?.includes('has been closed'));
});
