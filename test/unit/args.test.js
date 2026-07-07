const { test } = require('node:test');
const assert = require('node:assert/strict');

const { parsePollArgs, parseDuration, formatDuration } = require('../../src/args');

// ── parseDuration ──────────────────────────────────────────

test('parseDuration: plain minutes', () => {
  assert.equal(parseDuration('45'), 45);
});

test('parseDuration: single units', () => {
  assert.equal(parseDuration('30m'), 30);
  assert.equal(parseDuration('2h'), 120);
  assert.equal(parseDuration('1d'), 1440);
});

test('parseDuration: combinations', () => {
  assert.equal(parseDuration('1h30m'), 90);
  assert.equal(parseDuration('1d 12h'), 2160);
});

test('parseDuration: case-insensitive and long unit names', () => {
  assert.equal(parseDuration('2HOURS'), 120);
  assert.equal(parseDuration('3 days'), 4320);
});

test('parseDuration: unparseable input returns null', () => {
  assert.equal(parseDuration('banana'), null);
  assert.equal(parseDuration(''), null);
  assert.equal(parseDuration(null), null);
  assert.equal(parseDuration('0m'), null);
});

// ── formatDuration ─────────────────────────────────────────

test('formatDuration: zero or negative is "closing..."', () => {
  assert.equal(formatDuration(0), 'closing...');
  assert.equal(formatDuration(-1000), 'closing...');
});

test('formatDuration: minutes only', () => {
  assert.equal(formatDuration(5 * 60000), '5m');
});

test('formatDuration: hours and minutes', () => {
  assert.equal(formatDuration(150 * 60000), '2h 30m');
  assert.equal(formatDuration(120 * 60000), '2h');
});

test('formatDuration: days and hours', () => {
  assert.equal(formatDuration(28 * 3600000), '1d 4h');
  assert.equal(formatDuration(48 * 3600000), '2d');
});

// ── parsePollArgs: modes ─────────────────────────────────────

test('parsePollArgs: pipe-separated mode', () => {
  const { args, mode } = parsePollArgs("What's for lunch? | Pizza | Sushi | Salad");
  assert.equal(mode, 'pipes');
  assert.deepEqual(args, ["What's for lunch?", 'Pizza', 'Sushi', 'Salad']);
});

test('parsePollArgs: quoted mode', () => {
  const { args, mode } = parsePollArgs('"What\'s for lunch?" "Pizza" "Sushi"');
  assert.equal(mode, 'quotes');
  assert.deepEqual(args, ["What's for lunch?", 'Pizza', 'Sushi']);
});

test('parsePollArgs: line-separated mode, strips list markers and quotes', () => {
  const { args, mode } = parsePollArgs('Question?\n- Pizza\n* Sushi\n1) Salad\n"Tacos"');
  assert.equal(mode, 'lines');
  assert.deepEqual(args, ['Question?', 'Pizza', 'Sushi', 'Salad', 'Tacos']);
});

test('parsePollArgs: bare words mode (used for sub-commands)', () => {
  const { args, mode } = parsePollArgs('end 2');
  assert.equal(mode, 'words');
  assert.deepEqual(args, ['end', '2']);
});

test('parsePollArgs: empty content is words mode with no args', () => {
  const { args, mode } = parsePollArgs('');
  assert.equal(mode, 'words');
  assert.deepEqual(args, []);
});

test('parsePollArgs: strips the /command:id prefix', () => {
  const { args, mode } = parsePollArgs('/poll:123456 Q? | A | B');
  assert.equal(mode, 'pipes');
  assert.deepEqual(args, ['Q?', 'A', 'B']);
});

// ── parsePollArgs: flags ─────────────────────────────────────

test('parsePollArgs: flags can appear anywhere and are stripped from args', () => {
  const { args, flags, mode } = parsePollArgs('--multiple Q? | A | B --public');
  assert.equal(mode, 'pipes');
  assert.deepEqual(args, ['Q?', 'A', 'B']);
  assert.equal(flags.multiple, true);
  assert.equal(flags.public, true);
});

test('parsePollArgs: short flag aliases', () => {
  const { flags } = parsePollArgs('Q? | A | B -m -p');
  assert.equal(flags.multiple, true);
  assert.equal(flags.public, true);
});

test('parsePollArgs: duration flag variants', () => {
  assert.equal(parsePollArgs('Q? | A | B --time 30m').flags.duration, 30);
  assert.equal(parsePollArgs('Q? | A | B --duration 2h').flags.duration, 120);
  assert.equal(parsePollArgs('Q? | A | B -t 1h30m').flags.duration, 90);
});

test('parsePollArgs: unrecognized duration sets badDuration, not duration', () => {
  const { flags } = parsePollArgs('Q? | A | B --time nonsense');
  assert.equal(flags.duration, null);
  assert.equal(flags.badDuration, 'nonsense');
});

test('parsePollArgs: no flags present default to falsy/null', () => {
  const { flags } = parsePollArgs('Q? | A | B');
  assert.equal(flags.multiple, false);
  assert.equal(flags.public, false);
  assert.equal(flags.duration, null);
  assert.equal(flags.badDuration, null);
});
