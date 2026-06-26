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
 */

/**
 * Parse the raw message content into positional args and flag options.
 *
 * Accepts quoted strings: `/poll "My question?" "Option A" "Option B"`
 * Supports flags: `--multiple`, `--public`, `--duration <minutes>`
 *
 * @param {string} content - Raw message content (e.g., `/poll:123 "Q?" "A" "B" --public`)
 * @returns {{ args: string[], flags: PollFlags }}
 */
function parsePollArgs(content) {
  const rest = content.replace(/^\/\w+:\d+\s*/, '');
  const tokens = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < rest.length; i++) {
    const c = rest[i];
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

  /** @type {PollFlags} */
  const flags = { multiple: false, public: false, duration: null };
  const args = [];

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === '--multiple') {
      flags.multiple = true;
    } else if (tokens[i] === '--public') {
      flags.public = true;
    } else if (tokens[i] === '--duration') {
      i++;
      flags.duration = parseInt(tokens[i], 10);
      if (isNaN(flags.duration)) flags.duration = null;
    } else {
      args.push(tokens[i]);
    }
  }

  return { args, flags };
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
  formatDuration,
};
