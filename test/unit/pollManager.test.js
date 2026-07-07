const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PollManager = require('../../src/pollManager');

function tempDataFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pollmanager-test-')), 'polls.json');
}

test('PollManager: starts empty when the data file does not exist', () => {
  const pm = new PollManager(tempDataFile());
  assert.deepEqual(pm.getAllPolls(), []);
});

test('PollManager: create() persists a poll and it round-trips via a fresh instance', () => {
  const file = tempDataFile();
  const pm = new PollManager(file);
  const poll = pm.create({
    messageId: 'm1',
    channelId: 'c1',
    creatorId: 'u1',
    question: 'Q?',
    options: ['A', 'B'],
  });

  assert.equal(poll.closed, false);
  assert.deepEqual(poll.votes, {});
  assert.ok(fs.existsSync(file));

  const pm2 = new PollManager(file);
  assert.deepEqual(pm2.get('c1', 'm1').question, 'Q?');
});

test('PollManager: get() returns null for unknown polls', () => {
  const pm = new PollManager(tempDataFile());
  assert.equal(pm.get('nope', 'nope'), null);
});

test('PollManager: getOpenInChannel filters by channel and closed status, sorted by creation order', () => {
  const pm = new PollManager(tempDataFile());
  pm.create({ messageId: 'm1', channelId: 'c1', creatorId: 'u1', question: 'Q1', options: ['A', 'B'] });
  pm.create({ messageId: 'm2', channelId: 'c1', creatorId: 'u1', question: 'Q2', options: ['A', 'B'] });
  pm.create({ messageId: 'm3', channelId: 'c2', creatorId: 'u1', question: 'Q3', options: ['A', 'B'] });

  const open = pm.getOpenInChannel('c1');
  assert.equal(open.length, 2);
  assert.deepEqual(open.map((p) => p.question), ['Q1', 'Q2']);
});

test('PollManager: getLatestOpenInChannel returns the most recently created open poll', () => {
  const pm = new PollManager(tempDataFile());
  pm.create({ messageId: 'm1', channelId: 'c1', creatorId: 'u1', question: 'Q1', options: ['A', 'B'] });
  pm.create({ messageId: 'm2', channelId: 'c1', creatorId: 'u1', question: 'Q2', options: ['A', 'B'] });

  assert.equal(pm.getLatestOpenInChannel('c1').question, 'Q2');
  assert.equal(pm.getLatestOpenInChannel('nonexistent'), null);
});

test('PollManager: update() merges fields and persists them', () => {
  const pm = new PollManager(tempDataFile());
  pm.create({ messageId: 'm1', channelId: 'c1', creatorId: 'u1', question: 'Q1', options: ['A', 'B'] });
  pm.update('c1', 'm1', { closed: true });
  assert.equal(pm.get('c1', 'm1').closed, true);
});

test('PollManager: update() on an unknown poll is a no-op', () => {
  const pm = new PollManager(tempDataFile());
  assert.doesNotThrow(() => pm.update('c1', 'nope', { closed: true }));
});

test('PollManager: delete() removes a poll and clears its timer', () => {
  const pm = new PollManager(tempDataFile());
  pm.create({ messageId: 'm1', channelId: 'c1', creatorId: 'u1', question: 'Q1', options: ['A', 'B'] });
  const tid = setTimeout(() => {}, 100000);
  pm.setTimer('c1', 'm1', tid);

  pm.delete('c1', 'm1');
  assert.equal(pm.get('c1', 'm1'), null);
  assert.equal(pm.timers.has('m1-c1'), false);
  clearTimeout(tid);
});

test('PollManager: getExpiredPolls returns open polls whose endsAt has passed', () => {
  const pm = new PollManager(tempDataFile());
  pm.create({ messageId: 'm1', channelId: 'c1', creatorId: 'u1', question: 'Expired', options: ['A', 'B'], endsAt: Date.now() - 1000 });
  pm.create({ messageId: 'm2', channelId: 'c1', creatorId: 'u1', question: 'Future', options: ['A', 'B'], endsAt: Date.now() + 100000 });
  pm.create({ messageId: 'm3', channelId: 'c1', creatorId: 'u1', question: 'NoLimit', options: ['A', 'B'], endsAt: null });

  const expired = pm.getExpiredPolls();
  assert.equal(expired.length, 1);
  assert.equal(expired[0].question, 'Expired');
});

test('PollManager: getAllOpen excludes closed polls', () => {
  const pm = new PollManager(tempDataFile());
  pm.create({ messageId: 'm1', channelId: 'c1', creatorId: 'u1', question: 'Open', options: ['A', 'B'] });
  pm.create({ messageId: 'm2', channelId: 'c1', creatorId: 'u1', question: 'Closed', options: ['A', 'B'] });
  pm.update('c1', 'm2', { closed: true });

  const open = pm.getAllOpen();
  assert.equal(open.length, 1);
  assert.equal(open[0].question, 'Open');
});

test('PollManager: a corrupt/invalid data file is treated as empty rather than throwing', () => {
  const file = tempDataFile();
  fs.writeFileSync(file, 'not json');
  const pm = new PollManager(file);
  assert.deepEqual(pm.getAllPolls(), []);
});
