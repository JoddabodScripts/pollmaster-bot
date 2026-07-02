/**
 * PollMaster — Nerimity polling bot.
 *
 * @module index
 */

const { Client, Events, RolePermissions } = require('@nerimity/nerimity.js');
const PollManager = require('./pollManager');
const { loadEnv } = require('./env');
const { buildPollHtml, buildResultsHtml, buildButtons } = require('./embedBuilder');
const { parsePollArgs, formatDuration } = require('./args');
const { setPresence } = require('./presence');

// ── bootstrap ─────────────────────────────────────────────

loadEnv();

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('BOT_TOKEN environment variable is required');
  process.exit(1);
}

const client = new Client();
const pollManager = new PollManager();
const POLL_EMPTY_CONTENT = '​';

// ── helpers ───────────────────────────────────────────────

/**
 * Close a single poll: clear its timer, mark as closed, update the message.
 *
 * @param {string} channelId
 * @param {string} messageId
 */
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

// ── command dispatcher ────────────────────────────────────

client.on(Events.MessageCreate, async (message) => {
  if (!message.command || message.command.name !== 'poll') return;

  const { args, flags } = parsePollArgs(message.content);

  switch (args[0]) {
    case 'end':
      await handleEndPoll(message, args);
      break;
    case 'list':
      await handleListPolls(message);
      break;
    case 'results':
      await handleResults(message);
      break;
    default:
      await handleCreatePoll(message, args, flags);
      break;
  }
});

// ── sub-command: /poll end ────────────────────────────────

/**
 * Close the latest open poll in this channel, or a specific one by index.
 * Usage: `/poll end` or `/poll end <number>` (from `/poll list`).
 *
 * @param {import('@nerimity/nerimity.js').Message} message
 * @param {string[]} args
 */
async function handleEndPoll(message, args) {
  let poll;

  if (args.length === 1) {
    poll = pollManager.getLatestOpenInChannel(message.channelId);
  } else {
    const idx = parseInt(args[1], 10);
    if (isNaN(idx) || idx < 1) {
      await message.channel.send(
        'Usage: `/poll end` or `/poll end <number>` (use `/poll list` to see numbers).',
        { replyToMessageIds: [message.id] },
      );
      return;
    }

    const openPolls = pollManager.getOpenInChannel(message.channelId);
    if (idx > openPolls.length) {
      await message.channel.send(
        `Poll #${idx} not found. There ${openPolls.length === 1 ? 'is only 1 open poll' : `are ${openPolls.length} open polls`} in this channel. Use \`/poll list\` to see them.`,
        { replyToMessageIds: [message.id] },
      );
      return;
    }
    poll = openPolls[idx - 1];
  }

  if (!poll) {
    await message.channel.send('No active poll found in this channel.', {
      replyToMessageIds: [message.id],
    });
    return;
  }

  // Permission check: creator or admin
  const member = message.channel.server?.members.cache.get(message.user.id);
  const canEnd =
    message.user.id === poll.creatorId ||
    (member && member.hasPermission(RolePermissions.ADMIN));

  if (!canEnd) {
    await message.channel.send('Only the poll creator or an admin can end this poll.', {
      replyToMessageIds: [message.id],
    });
    return;
  }

  await closePoll(poll.channelId, poll.messageId);
  await message.channel.send(
    `Poll **"${poll.question}"** has been closed.`,
    { replyToMessageIds: [message.id] },
  );
}

// ── sub-command: /poll list ───────────────────────────────

/**
 * List all open polls in the current channel with index numbers.
 *
 * @param {import('@nerimity/nerimity.js').Message} message
 */
async function handleListPolls(message) {
  const openPolls = pollManager.getOpenInChannel(message.channelId);

  if (openPolls.length === 0) {
    await message.channel.send('No open polls in this channel.', {
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

  await message.channel.send(
    `**📊 Open polls in this channel**\n${lines.join('\n')}\n\nUse \`/poll end <number>\` to close a specific poll.`,
    { replyToMessageIds: [message.id] },
  );
}

// ── sub-command: /poll results ────────────────────────────

/**
 * Re-send the final tally for the most recent closed poll in the channel.
 *
 * @param {import('@nerimity/nerimity.js').Message} message
 */
async function handleResults(message) {
  const channelPolls = pollManager
    .getAllPolls()
    .filter((p) => p.channelId === message.channelId)
    .sort((a, b) => b.createdAt - a.createdAt);

  const poll = channelPolls.find((p) => p.closed);

  if (!poll) {
    await message.channel.send('No closed poll found in this channel.', {
      replyToMessageIds: [message.id],
    });
    return;
  }

  await message.channel.send(POLL_EMPTY_CONTENT, {
    htmlEmbed: buildResultsHtml(poll, client),
    replyToMessageIds: [message.id],
  });
}

// ── sub-command: /poll "Q?" "A" "B" ... ───────────────────

/**
 * Create a new poll from the provided arguments.
 * Usage: `/poll "Question?" "Option A" "Option B" ["Option C" ...] [--multiple] [--public] [--duration <min>]`
 *
 * @param {import('@nerimity/nerimity.js').Message} message
 * @param {string[]} args
 * @param {import('./args').PollFlags} flags
 */
async function handleCreatePoll(message, args, flags) {
  const [question, ...options] = args;

  if (!question || options.length < 2) {
    await message.channel.send(
      'Usage: `/poll "Question?" "Option A" "Option B" ["Option C" ...] [--multiple] [--public] [--duration <minutes>]`',
      { replyToMessageIds: [message.id] },
    );
    return;
  }

  if (options.length > 10) {
    await message.channel.send('Maximum 10 options allowed.', {
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
    await message.channel.send('Failed to create poll. Please try again.', {
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

  // Arm auto-close timer if duration was specified
  if (endsAt) {
    const delay = endsAt - Date.now();
    if (delay > 0) {
      const tid = setTimeout(() => closePoll(message.channelId, pollMsg.id), delay);
      pollManager.setTimer(message.channelId, pollMsg.id, tid);
    }
  }
}

// ── button click (vote) handler ───────────────────────────

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
    const votes = poll.votes[userId] || [];
    const pos = votes.indexOf(optionIdx);

    if (pos >= 0) {
      votes.splice(pos, 1);
      if (votes.length === 0) {
        delete poll.votes[userId];
      } else {
        poll.votes[userId] = votes;
      }
    } else {
      poll.votes[userId] = [...votes, optionIdx];
    }
    changed = true;
  } else {
    const current = poll.votes[userId];
    if (current && current.length === 1 && current[0] === optionIdx) {
      // Un-toggle — voter is removing their vote
      delete poll.votes[userId];
    } else {
      poll.votes[userId] = [optionIdx];
    }
    changed = true;
  }

  if (!changed) return;

  pollManager.save();

  // Reflect the updated counts in the message embed
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

  // Ephemeral confirmation to the voter
  const votedForPoll = poll.votes[userId] && poll.votes[userId].includes(optionIdx);
  const optionName = poll.options[optionIdx];

  const response = votedForPoll
    ? `You voted for: ${optionName}`
    : `Your vote for "${optionName}" was removed.`;

  await button.respond({ content: response }).catch(() => {});
});

// ── ready / startup ───────────────────────────────────────

client.on(Events.Ready, () => {
  console.log(`PollMaster ready as ${client.user?.username}`);
  setPresence(client);

  // Close polls that expired while the bot was offline
  for (const poll of pollManager.getExpiredPolls()) {
    console.log(`Closing expired poll: "${poll.question}"`);
    closePoll(poll.channelId, poll.messageId);
  }

  // Re-arm auto-close timers for polls expiring in the future
  for (const poll of pollManager.getAllOpen()) {
    if (poll.endsAt && poll.endsAt > Date.now()) {
      const delay = poll.endsAt - Date.now();
      const tid = setTimeout(() => closePoll(poll.channelId, poll.messageId), delay);
      pollManager.setTimer(poll.channelId, poll.messageId, tid);
    }
  }
});

// ── start ─────────────────────────────────────────────────

client.login(token);
