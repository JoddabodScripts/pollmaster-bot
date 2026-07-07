const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPollHtml,
  buildResultsHtml,
  buildButtons,
  countTotalVotes,
  countOptionVotes,
} = require('../../src/embedBuilder');

function makePoll(overrides = {}) {
  return {
    question: 'Favorite color?',
    options: ['Red', 'Blue', 'Green'],
    votes: {},
    public: false,
    multiple: false,
    creatorId: 'user1',
    ...overrides,
  };
}

// ── vote counting ────────────────────────────────────────────

test('countOptionVotes: counts users who voted for an option', () => {
  const poll = makePoll({ votes: { u1: [0], u2: [0], u3: [1] } });
  assert.equal(countOptionVotes(poll, 0), 2);
  assert.equal(countOptionVotes(poll, 1), 1);
  assert.equal(countOptionVotes(poll, 2), 0);
});

test('countOptionVotes: no votes object returns 0', () => {
  const poll = makePoll({ votes: undefined });
  assert.equal(countOptionVotes(poll, 0), 0);
});

test('countTotalVotes: sums across options (multi-select counts once per selection)', () => {
  const poll = makePoll({ votes: { u1: [0, 1], u2: [1] } });
  assert.equal(countTotalVotes(poll), 3);
});

// ── buildButtons ─────────────────────────────────────────────

test('buildButtons: maps options to id/label pairs by index', () => {
  const poll = makePoll();
  assert.deepEqual(buildButtons(poll), [
    { id: '0', label: 'Red' },
    { id: '1', label: 'Blue' },
    { id: '2', label: 'Green' },
  ]);
});

// ── buildPollHtml ────────────────────────────────────────────

test('buildPollHtml: escapes HTML in the question and options', () => {
  const poll = makePoll({ question: '<script>alert(1)</script>', options: ['<b>A</b>', 'B'] });
  const html = buildPollHtml(poll, null);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;b&gt;A&lt;/b&gt;'));
});

test('buildPollHtml: shows vote counts and percentages', () => {
  const poll = makePoll({ votes: { u1: [0], u2: [0], u3: [1] } });
  const html = buildPollHtml(poll, null);
  assert.ok(html.includes('<strong>2</strong> votes (67%)'));
  assert.ok(html.includes('<strong>1</strong> vote (33%)'));
  assert.ok(html.includes('Total: 3 votes'));
});

test('buildPollHtml: anonymous poll omits voter names even with votes', () => {
  const poll = makePoll({ public: false, votes: { u1: [0] } });
  const html = buildPollHtml(poll, null);
  assert.ok(html.includes('Anonymous poll'));
  assert.ok(!html.includes('@u1'));
});

test('buildPollHtml: public poll lists voter names per option', () => {
  const poll = makePoll({ public: true, votes: { u1: [0] } });
  const html = buildPollHtml(poll, null);
  assert.ok(html.includes('Public poll'));
  assert.ok(html.includes('@u1'));
});

test('buildPollHtml: resolves creator username from client cache when available', () => {
  const poll = makePoll({ creatorId: 'u1' });
  const fakeClient = { users: { cache: new Map([['u1', { username: 'Alice' }]]) } };
  const html = buildPollHtml(poll, fakeClient);
  assert.ok(html.includes('Created by @Alice'));
});

test('buildPollHtml: falls back to raw id when client/user is missing', () => {
  const poll = makePoll({ creatorId: 'u1' });
  const html = buildPollHtml(poll, null);
  assert.ok(html.includes('Created by @u1'));
});

// ── buildResultsHtml ─────────────────────────────────────────

test('buildResultsHtml: marks the poll as closed', () => {
  const poll = makePoll();
  const html = buildResultsHtml(poll, null);
  assert.ok(html.includes('(closed)'));
});

test('buildResultsHtml: escapes HTML in options', () => {
  const poll = makePoll({ options: ['<img src=x>', 'B'] });
  const html = buildResultsHtml(poll, null);
  assert.ok(!html.includes('<img src=x>'));
  assert.ok(html.includes('&lt;img src=x&gt;'));
});

test('buildResultsHtml: zero votes renders 0% without dividing by zero', () => {
  const poll = makePoll({ votes: {} });
  const html = buildResultsHtml(poll, null);
  assert.ok(html.includes('Total: 0 votes'));
  assert.ok(!html.includes('NaN'));
});
