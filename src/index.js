const fs = require('fs');
const path = require('path');

// Load .env file manually
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

const { Client, Events, RolePermissions } = require('@nerimity/nerimity.js');
const PollManager = require('./pollManager');
const { buildPollHtml, buildResultsHtml, buildButtons } = require('./embedBuilder');

const client = new Client();
const pollManager = new PollManager();

const POLL_EMPTY_CONTENT = '​';

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

async function closePoll(channelId, messageId) {
  const poll = pollManager.get(channelId, messageId);
  if (!poll || poll.closed) return;

  pollManager.clearTimer(channelId, messageId);
  poll.closed = true;
  pollManager.save();

  try {
    const channel = client.channels.cache.get(channelId);
    if (!channel) return;
    const msg = await client.messages.fetch(channelId, messageId);
    if (msg) {
      await msg.edit(POLL_EMPTY_CONTENT, {
        htmlEmbed: buildResultsHtml(poll, client),
        buttons: [],
      });
    }
  } catch (err) {
    console.error('Failed to close poll message:', err.message);
  }
}

// --- Command handling ---

client.on(Events.MessageCreate, async (message) => {
  if (!message.command || message.command.name !== 'poll') return;

  const { args, flags } = parsePollArgs(message.content);

  if (args[0] === 'end') {
    // /poll end — close the latest open poll in this channel
    // /poll end <N> — close poll by list index
    let poll;
    if (args.length === 1) {
      poll = pollManager.getLatestInChannel(message.channelId);
    } else {
      const idx = parseInt(args[1], 10);
      if (isNaN(idx) || idx < 1) {
        message.channel.send('Usage: `/poll end` or `/poll end <number>` (use `/poll list` to see numbers).', {
          replyToMessageIds: [message.id],
        });
        return;
      }
      const openPolls = pollManager.getOpenInChannel(message.channelId);
      if (idx > openPolls.length) {
        message.channel.send(
          `Poll #${idx} not found. There ${openPolls.length === 1 ? 'is only 1 open poll' : `are ${openPolls.length} open polls`} in this channel. Use \`/poll list\` to see them.`,
          { replyToMessageIds: [message.id] }
        );
        return;
      }
      poll = openPolls[idx - 1];
    }

    if (!poll) {
      message.channel.send('No active poll found in this channel.', {
        replyToMessageIds: [message.id],
      });
      return;
    }

    const member = message.channel.server?.members.cache.get(message.user.id);
    const canEnd =
      message.user.id === poll.creatorId ||
      (member && member.hasPermission(RolePermissions.ADMIN));

    if (!canEnd) {
      message.channel.send('Only the poll creator or an admin can end this poll.', {
        replyToMessageIds: [message.id],
      });
      return;
    }

    await closePoll(poll.channelId, poll.messageId);
    message.channel.send(
      `Poll **"${poll.question}"** has been closed.`,
      { replyToMessageIds: [message.id] }
    );
    return;
  }

  if (args.length === 1 && args[0] === 'list') {
    const openPolls = pollManager.getOpenInChannel(message.channelId);
    if (openPolls.length === 0) {
      message.channel.send('No open polls in this channel.', {
        replyToMessageIds: [message.id],
      });
      return;
    }

    const lines = openPolls.map((p, i) => {
      const optionCount = p.options.length;
      const voteCount = Object.keys(p.votes || {}).length;
      const creatorName = client.users?.cache?.get(p.creatorId)?.username || p.creatorId;
      const timeStr = p.endsAt
        ? `closes in ${formatDuration(p.endsAt - Date.now())}`
        : 'no time limit';
      const flags = [];
      if (p.multiple) flags.push('multiple');
      if (p.public) flags.push('public');
      const flagStr = flags.length > 0 ? ` · *${flags.join(', ')}*` : '';
      return `${i + 1}. **${p.question}** — ${optionCount} option${optionCount !== 1 ? 's' : ''} · ${voteCount} voter${voteCount !== 1 ? 's' : ''} · ${timeStr} · by @${creatorName}${flagStr}`;
    });

    message.channel.send(
      `**📊 Open polls in this channel**\n${lines.join('\n')}\n\nUse \`/poll end <number>\` to close a specific poll.`,
      { replyToMessageIds: [message.id] }
    );
    return;
  }

  if (args.length === 1 && args[0] === 'results') {
    // /poll results — repost final tally for the latest closed poll
    const polls = pollManager.getAllPolls().filter((p) => p.channelId === message.channelId);
    polls.sort((a, b) => b.createdAt - a.createdAt);
    const poll = polls.find((p) => p.closed);
    if (!poll) {
      message.channel.send('No closed poll found in this channel.', {
        replyToMessageIds: [message.id],
      });
      return;
    }
    message.channel.send(POLL_EMPTY_CONTENT, {
      htmlEmbed: buildResultsHtml(poll, client),
      replyToMessageIds: [message.id],
    });
    return;
  }

  // --- Create new poll ---
  if (args.length < 3) {
    message.channel.send(
      'Usage: `/poll "Question?" "Option A" "Option B" ["Option C" ...] [--multiple] [--public] [--duration <minutes>]`',
      { replyToMessageIds: [message.id] }
    );
    return;
  }

  const question = args[0];
  const options = args.slice(1);

  if (options.length > 10) {
    message.channel.send('Maximum 10 options allowed.', {
      replyToMessageIds: [message.id],
    });
    return;
  }

  const endsAt = flags.duration ? Date.now() + flags.duration * 60000 : null;

  // Send the poll message
  let pollMsg;
  try {
    pollMsg = await message.channel.send(POLL_EMPTY_CONTENT, {
      htmlEmbed: buildPollHtml({
        question,
        options,
        votes: {},
        public: flags.public,
        multiple: flags.multiple,
        creatorId: message.user.id,
      }, client),
      buttons: options.map((opt, i) => ({ id: String(i), label: opt })),
      replyToMessageIds: [message.id],
    });
  } catch (err) {
    console.error('Failed to send poll message:', err.message);
    message.channel.send('Failed to create poll. Please try again.', {
      replyToMessageIds: [message.id],
    });
    return;
  }

  const pollData = pollManager.create({
    messageId: pollMsg.id,
    channelId: message.channelId,
    guildId: message.channel.server?.id || message.channelId,
    creatorId: message.user.id,
    question,
    options,
    multiple: flags.multiple,
    public: flags.public,
    endsAt,
  });

  if (endsAt) {
    const delay = endsAt - Date.now();
    if (delay > 0) {
      const tid = setTimeout(() => closePoll(message.channelId, pollMsg.id), delay);
      pollManager.setTimer(message.channelId, pollMsg.id, tid);
    }
  }
});

// --- Button click (vote) handling ---

client.on(Events.MessageButtonClick, async (button) => {
  const poll = pollManager.get(button.channelId, button.messageId);
  if (!poll || poll.closed) {
    await button.respond({ content: 'This poll has ended.' }).catch(() => {});
    return;
  }

  const optionIdx = parseInt(button.id, 10);
  if (isNaN(optionIdx) || optionIdx < 0 || optionIdx >= poll.options.length) return;

  const userId = button.userId;
  let changed = false;

  if (poll.multiple) {
    // Toggle the option
    const votes = poll.votes[userId] || [];
    const pos = votes.indexOf(optionIdx);
    if (pos >= 0) {
      votes.splice(pos, 1);
      if (votes.length === 0) delete poll.votes[userId];
      else poll.votes[userId] = votes;
      changed = true;
    } else {
      poll.votes[userId] = [...votes, optionIdx];
      changed = true;
    }
  } else {
    // Single choice — toggle
    const current = poll.votes[userId];
    if (current && current.length === 1 && current[0] === optionIdx) {
      delete poll.votes[userId];
      changed = true;
    } else {
      poll.votes[userId] = [optionIdx];
      changed = true;
    }
  }

  if (!changed) return;

  pollManager.save();

  // Update the embed with new vote counts
  try {
    await button.fetch();
    if (button.message) {
      await button.message.edit(POLL_EMPTY_CONTENT, {
        htmlEmbed: buildPollHtml(poll, client),
        buttons: buildButtons(poll),
      });
    }
  } catch (err) {
    console.error('Failed to update poll embed:', err.message);
  }

  // Confirm to the voter
  const votedForPoll = poll.votes[userId] && poll.votes[userId].includes(optionIdx);
  const optionName = poll.options[optionIdx];

  if (votedForPoll) {
    await button.respond({ content: `You voted for: ${optionName}` }).catch(() => {});
  } else {
    await button.respond({ content: `Your vote for "${optionName}" was removed.` }).catch(() => {});
  }
});

let activityIndex = 0;
function updatePresence(client) {
  try {
    const serverCount = client.servers?.cache?.size ?? 0;
    const serverLabel = `${serverCount} server${serverCount !== 1 ? "s" : ""}`;
    const activities = [
      {
        action: "Playing",
        name: "Poll Master",
        startedAt: Date.now(),
        title: serverLabel,
        subtitle: "/poll to create one",
      },
      {
        action: "Watching",
        name: "Votes roll in",
        startedAt: Date.now(),
        title: "📊",
        subtitle: "let the people speak",
      },
    ];
    const activity = activities[activityIndex % activities.length];
    activityIndex += 1;
    client.user?.setActivity(activity);
  } catch (e) {
    console.error("[bot] Failed to update presence:", e.message);
  }
}

// --- Ready / startup ---

client.on(Events.Ready, () => {
  console.log(`PollMaster ready as ${client.user?.username}`);
  updatePresence(client);
  setInterval(() => updatePresence(client), 15000);

  // Close polls that expired while the bot was offline
  for (const poll of pollManager.getExpiredPolls()) {
    console.log(`Closing expired poll: "${poll.question}"`);
    closePoll(poll.channelId, poll.messageId);
  }

  // Re-arm timers for polls that will expire in the future
  for (const poll of pollManager.getAllOpen()) {
    if (poll.endsAt && poll.endsAt > Date.now()) {
      const delay = poll.endsAt - Date.now();
      const tid = setTimeout(
        () => closePoll(poll.channelId, poll.messageId),
        delay
      );
      pollManager.setTimer(poll.channelId, poll.messageId, tid);
    }
  }
});

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('BOT_TOKEN environment variable is required');
  process.exit(1);
}

client.login(token);
