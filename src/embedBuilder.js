const EMBED_COLOR = '#5865F2';
const BG_COLOR = '#2f3136';
const TEXT_PRIMARY = '#dcddde';
const TEXT_SECONDARY = '#b9bbbe';
const TEXT_MUTED = '#72767d';
const BAR_BG = '#40444b';

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveUser(client, userId) {
  const user = client?.users?.cache?.get(userId);
  return user ? user.username : userId;
}

function embedContainer(accentColor, content) {
  return `<div style="display:flex;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="width:4px;background:${accentColor};flex-shrink:0;border-radius:5px 0px 0px 5px;"></div>
  <div style="padding:16px;background:${BG_COLOR};flex:1;border-radius:0px 5px 5px 0px;">${content}</div>
</div>`;
}

function buildPollHtml(poll, client) {
  const total = countTotalVotes(poll);
  const optionLines = poll.options.map((opt, i) => {
    const count = countOptionVotes(poll, i);
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return `<div style="color:${TEXT_SECONDARY};margin:6px 0;font-size:14px;">
  <span style="color:${EMBED_COLOR};">▸</span> ${escapeHtml(opt)} — <strong>${count}</strong> vote${count !== 1 ? 's' : ''}${total > 0 ? ` (${pct}%)` : ''}
</div>`;
  }).join('\n');

  const privacyLabel = poll.public ? 'Public poll' : 'Anonymous poll';
  const creatorTag = resolveUser(client, poll.creatorId);

  let publicVotersHtml = '';
  if (poll.public) {
    const voterLines = poll.options.map((opt, i) => {
      const voterIds = getVotersForOption(poll, i);
      if (voterIds.length === 0) return '';
      const names = voterIds.map((uid) => '@' + resolveUser(client, uid)).join(', ');
      return `<div style="color:${TEXT_MUTED};font-size:11px;margin:2px 0;padding-left:12px;">
  ${escapeHtml(opt)}: ${escapeHtml(names)}
</div>`;
    }).filter(Boolean).join('\n');
    if (voterLines) {
      publicVotersHtml = `<div style="margin-top:6px;">${voterLines}</div>`;
    }
  }

  const body = `<div style="color:${TEXT_PRIMARY};font-size:16px;font-weight:600;margin-bottom:12px;">${escapeHtml(poll.question)}</div>
  ${optionLines}
  ${publicVotersHtml}
  <div style="height:1px;background:${BAR_BG};margin:10px 0 4px 0;"></div>
  <div style="color:${TEXT_MUTED};font-size:12px;">
    Total: ${total} vote${total !== 1 ? 's' : ''} · ${privacyLabel} · Created by @${escapeHtml(creatorTag)}
  </div>`;

  return embedContainer(EMBED_COLOR, body);
}

function buildResultsHtml(poll, client) {
  const total = countTotalVotes(poll);
  const maxCount = Math.max(1, ...poll.options.map((_, i) => countOptionVotes(poll, i)));

  const optionBars = poll.options.map((opt, i) => {
    const count = countOptionVotes(poll, i);
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const barPct = total > 0 ? Math.round((count / maxCount) * 100) : 0;

    const filledCount = Math.round(barPct / 5);
    const barStr = '█'.repeat(filledCount) + '░'.repeat(Math.max(0, 20 - filledCount));

    let voterInfo = '';
    if (poll.public && count > 0) {
      const voterIds = getVotersForOption(poll, i);
      const names = voterIds.map((uid) => '@' + resolveUser(client, uid)).join(', ');
      voterInfo = `<div style="color:${TEXT_MUTED};font-size:11px;padding-left:4px;">${escapeHtml(names)}</div>`;
    }

    return `<div style="margin:8px 0;">
  <div style="color:${TEXT_SECONDARY};font-size:14px;margin-bottom:2px;">${escapeHtml(opt)}</div>
  <div style="font-family:'Courier New',Courier,monospace;color:${TEXT_SECONDARY};font-size:13px;line-height:1.4;">
    ${barStr} <strong>${count}</strong> vote${count !== 1 ? 's' : ''}${total > 0 ? ` (${pct}%)` : ''}
  </div>
  ${voterInfo}
</div>`;
  }).join('\n');

  const privacyLabel = poll.public ? 'Public poll' : 'Anonymous poll';
  const creatorTag = resolveUser(client, poll.creatorId);

  const body = `<div style="color:${TEXT_PRIMARY};font-size:16px;font-weight:600;margin-bottom:12px;">
    ${escapeHtml(poll.question)} <span style="color:#ed4245;font-size:13px;font-weight:500;">(closed)</span>
  </div>
  ${optionBars}
  <div style="height:1px;background:${BAR_BG};margin:10px 0 4px 0;"></div>
  <div style="color:${TEXT_MUTED};font-size:12px;">
    Total: ${total} vote${total !== 1 ? 's' : ''} · ${privacyLabel} · Created by @${escapeHtml(creatorTag)}
  </div>`;

  return embedContainer(EMBED_COLOR, body);
}

function buildButtons(poll) {
  return poll.options.map((opt, i) => ({
    id: String(i),
    label: opt,
  }));
}

function countOptionVotes(poll, optionIndex) {
  if (!poll.votes) return 0;
  let count = 0;
  for (const userId of Object.keys(poll.votes)) {
    const indices = poll.votes[userId] || [];
    if (indices.includes(optionIndex)) count++;
  }
  return count;
}

function countTotalVotes(poll) {
  let total = 0;
  for (let i = 0; i < poll.options.length; i++) {
    total += countOptionVotes(poll, i);
  }
  return total;
}

function getVotersForOption(poll, optionIndex) {
  const voters = [];
  for (const userId of Object.keys(poll.votes || {})) {
    const indices = poll.votes[userId] || [];
    if (indices.includes(optionIndex)) {
      voters.push(userId);
    }
  }
  return voters;
}

module.exports = {
  buildPollHtml,
  buildResultsHtml,
  buildButtons,
  countTotalVotes,
  countOptionVotes,
};
