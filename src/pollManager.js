const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'polls.json');

/**
 * Manages in-memory + persistent storage of polls.
 *
 * Polls are keyed by `messageId-channelId` and persisted as JSON.
 * Timers for auto-close are tracked via a side-channel Map.
 */
class PollManager {
  constructor() {
    /** @type {Record<string, object>} */
    this.polls = {};

    /** @type {Map<string, NodeJS.Timeout>} */
    this.timers = new Map();

    this._ensureDataDir();
    this._load();
  }

  // ── persistence ────────────────────────────────────────

  /** Ensure the data directory exists on disk. */
  _ensureDataDir() {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /** Load polls from the JSON file. */
  _load() {
    try {
      this.polls = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    } catch {
      this.polls = {};
    }
  }

  /** Persist all polls to the JSON file. */
  save() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(this.polls, null, 2));
  }

  // ── internal key helpers ───────────────────────────────

  /**
   * Generate the internal storage key.
   * @param {string} channelId
   * @param {string} messageId
   * @returns {string}
   */
  _key(channelId, messageId) {
    return `${messageId}-${channelId}`;
  }

  // ── CRUD ───────────────────────────────────────────────

  /**
   * Get a single poll by its channel + message IDs.
   * @param {string} channelId
   * @param {string} messageId
   * @returns {object|null}
   */
  get(channelId, messageId) {
    return this.polls[this._key(channelId, messageId)] || null;
  }

  /**
   * Return all open polls in a given channel, sorted by creation time.
   * @param {string} channelId
   * @returns {object[]}
   */
  getOpenInChannel(channelId) {
    return Object.values(this.polls)
      .filter((p) => p.channelId === channelId && !p.closed)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Return the most recently created open poll in a channel, or null.
   * @param {string} channelId
   * @returns {object|null}
   */
  getLatestOpenInChannel(channelId) {
    const open = this.getOpenInChannel(channelId);
    return open.length > 0 ? open[open.length - 1] : null;
  }

  /**
   * Create a new poll record and persist.
   * @param {object} data - Poll properties (messageId, channelId, etc.)
   * @returns {object} The stored poll object
   */
  create(data) {
    const key = this._key(data.channelId, data.messageId);
    data.createdAt = Date.now();
    data.votes = {};
    data.closed = false;
    this.polls[key] = data;
    this.save();
    return data;
  }

  /**
   * Merge updates into an existing poll and persist.
   * @param {string} channelId
   * @param {string} messageId
   * @param {object} updates
   */
  update(channelId, messageId, updates) {
    const key = this._key(channelId, messageId);
    if (this.polls[key]) {
      Object.assign(this.polls[key], updates);
      this.save();
    }
  }

  /**
   * Delete a poll (and clear its timer if running).
   * @param {string} channelId
   * @param {string} messageId
   */
  delete(channelId, messageId) {
    const key = this._key(channelId, messageId);
    if (this.polls[key]) {
      this.clearTimer(channelId, messageId);
      delete this.polls[key];
      this.save();
    }
  }

  // ── timers ─────────────────────────────────────────────

  /**
   * Store a timeout handle for a poll's auto-close timer.
   * @param {string} channelId
   * @param {string} messageId
   * @param {NodeJS.Timeout} timeoutId
   */
  setTimer(channelId, messageId, timeoutId) {
    this.timers.set(this._key(channelId, messageId), timeoutId);
  }

  /**
   * Clear and remove a poll's auto-close timer.
   * @param {string} channelId
   * @param {string} messageId
   */
  clearTimer(channelId, messageId) {
    const key = this._key(channelId, messageId);
    const tid = this.timers.get(key);
    if (tid) {
      clearTimeout(tid);
      this.timers.delete(key);
    }
  }

  // ── queries ────────────────────────────────────────────

  /**
   * Get all polls that are not closed and have passed their end time.
   * Used to catch up on missed expirations (e.g., after bot restart).
   * @returns {object[]}
   */
  getExpiredPolls() {
    const now = Date.now();
    return Object.values(this.polls).filter(
      (p) => !p.closed && p.endsAt && p.endsAt <= now,
    );
  }

  /**
   * Get all polls that are not closed.
   * @returns {object[]}
   */
  getAllOpen() {
    return Object.values(this.polls).filter((p) => !p.closed);
  }

  /**
   * Get ALL polls (open and closed).
   * @returns {object[]}
   */
  getAllPolls() {
    return Object.values(this.polls);
  }
}

module.exports = PollManager;
