/**
 * Argument parsing and utility formatting for poll commands.
 *
 * @module args
 */

/**
 * @typedef {Object} PollFlags
 * @property {boolean} multiple - Allow voting for multiple options
 * @property {boolean} public - Show who voted for what
 * @property {null|number} duration - Poll duration in minutes (null = no limit)
 * @property {null|string} badDuration - Raw duration value that failed to parse
 */

/**
 * Parse a human-friendly duration string into minutes.
 *
 * Accepts plain minutes (`45`), single units (`30m`, `2h`, `1d`),
 * and combinations (`1h30m`, `1d 12h`). Case-insensitive.
 *
 * @param {string} str
 * @returns {number|null} Duration in whole minutes, or null if unparseable
 */
function parseDuration(str) {
  if (!str) return null;
  const s = String(str).trim().toLowerCase();

  if (/^\d+$/.test(s)) return parseInt(s, 10);

  const re = /(\d+(?:\.\d+)?)\s*(d|day|days|h|hr|hrs|hour|hours|m|min|mins|minute|minutes)/g;
  let total = 0;
  let matched = false;
  let m;
  while ((m = re.exec(s)) !== null) {
    matched = true;
    const n = parseFloat(m[1]);
    const unit = m[2][0];
    total += unit === 'd' ? n * 1440 : unit === 'h' ? n * 60 : n;
  }

  if (!matched || total <= 0) return null;
  return Math.round(total);
}

/**
 * Split text into tokens, honoring double-quoted strings.
 *
 * @param {string} text
 * @returns {string[]}
 */
function quoteSplit(text) {
  const tokens = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (c === ' ' && !inQuote) {
      if (current.trim()) tokens.push(current.trim());
      current = '';
      continue;
    }
    current += c;
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

/**
 * Parse the raw message content into positional args and flag options.
 *
 * Supported creation formats (checked in this order):
 *  - Lines:  question on the first line, one option per line
 *  - Pipes:  `/poll What's for lunch? | Pizza | Sushi | Salad`
 *  - Quotes: `/poll "What's for lunch?" "Pizza" "Sushi"`
 *  - Words:  bare whitespace tokens (used for sub-commands like `end 2`)
 *
 * Flags may appear anywhere: `--multiple`/`--multi`/`-m`,
 * `--public`/`-p`, `--time <dur>`/`--duration <dur>`/`-t <dur>`
 * where `<dur>` is e.g. `30m`, `2h`, `1d`, `1h30m`, or plain minutes.
 *
 * @param {string} content - Raw message content (e.g., `/poll:123 Q? | A | B --public`)
 * @returns {{ args: string[], flags: PollFlags, mode: 'lines'|'pipes'|'quotes'|'words' }}
 */
function parsePollArgs(content) {
  let rest = content.replace(/^\/\w+:\d+\s*/, '');

  /** @type {PollFlags} */
  const flags = { multiple: false, public: false, duration: null, badDuration: null };

  rest = rest.replace(/(^|\s)--?(?:multiple|multi|m)(?=\s|$)/gi, (_, pre) => {
    flags.multiple = true;
    return pre;
  });

  rest = rest.replace(/(^|\s)--?(?:public|p)(?=\s|$)/gi, (_, pre) => {
    flags.public = true;
    return pre;
  });

  rest = rest.replace(
    /(^|\s)--?(?:duration|time|t)[\s=:]+("[^"]*"|\S+)/gi,
    (_, pre, value) => {
      const raw = value.replace(/^"|"$/g, '');
      const minutes = parseDuration(raw);
      if (minutes === null) {
        flags.badDuration = raw;
      } else {
        flags.duration = minutes;
      }
      return pre;
    },
  );

  const text = rest.trim();
  let args;
  let mode;

  if (text.includes('\n')) {
    mode = 'lines';
    args = text
      .split('\n')
      .map((s) => s.trim().replace(/^(?:[-*•]|\d+[.)])\s+/, '').replace(/^"|"$/g, ''))
      .filter(Boolean);
  } else if (text.includes('|')) {
    mode = 'pipes';
    args = text
      .split('|')
      .map((s) => s.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);
  } else if (text.includes('"')) {
    mode = 'quotes';
    args = quoteSplit(text);
  } else {
    mode = 'words';
    args = text.length > 0 ? text.split(/\s+/) : [];
  }

  return { args, flags, mode };
}

/**
 * Format a duration in milliseconds into a human-readable string.
 *
 * @param {number} ms - Remaining milliseconds (≤ 0 returns "closing...")
 * @returns {string} e.g., "5m", "2h 30m", "1d 4h"
 */
function formatDuration(ms) {
  if (ms <= 0) return 'closing...';

  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `${totalMin}m`;

  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;

  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

module.exports = {
  parsePollArgs,
  parseDuration,
  formatDuration,
};
