const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'polls.json');

class PollManager {
  constructor() {
    this.polls = {};
    this.timers = new Map();
    this._ensureDataDir();
    this._load();
  }

  _ensureDataDir() {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  _load() {
    try {
      this.polls = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    } catch {
      this.polls = {};
    }
  }

  save() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(this.polls, null, 2));
  }

  _key(channelId, messageId) {
    return `${messageId}-${channelId}`;
  }

  get(channelId, messageId) {
    return this.polls[this._key(channelId, messageId)] || null;
  }

  getOpenInChannel(channelId) {
    return Object.values(this.polls)
      .filter((p) => p.channelId === channelId && !p.closed)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  getLatestInChannel(channelId) {
    const open = this.getOpenInChannel(channelId);
    return open.length > 0 ? open[open.length - 1] : null;
  }

  create(data) {
    const key = this._key(data.channelId, data.messageId);
    data.createdAt = Date.now();
    data.votes = {};
    data.closed = false;
    this.polls[key] = data;
    this.save();
    return data;
  }

  update(channelId, messageId, updates) {
    const key = this._key(channelId, messageId);
    if (this.polls[key]) {
      Object.assign(this.polls[key], updates);
      this.save();
    }
  }

  delete(channelId, messageId) {
    const key = this._key(channelId, messageId);
    if (this.polls[key]) {
      const tid = this.timers.get(key);
      if (tid) {
        clearTimeout(tid);
        this.timers.delete(key);
      }
      delete this.polls[key];
      this.save();
    }
  }

  setTimer(channelId, messageId, timeoutId) {
    this.timers.set(this._key(channelId, messageId), timeoutId);
  }

  clearTimer(channelId, messageId) {
    const key = this._key(channelId, messageId);
    const tid = this.timers.get(key);
    if (tid) {
      clearTimeout(tid);
      this.timers.delete(key);
    }
  }

  getExpiredPolls() {
    const now = Date.now();
    return Object.values(this.polls).filter(
      (p) => !p.closed && p.endsAt && p.endsAt <= now
    );
  }

  getAllOpen() {
    return Object.values(this.polls).filter((p) => !p.closed);
  }

  getAllPolls() {
    return Object.values(this.polls);
  }
}

module.exports = PollManager;
