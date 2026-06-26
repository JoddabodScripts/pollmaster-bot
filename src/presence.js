/**
 * PollMaster presence rotation.
 * Cycles through status messages to show the bot is alive.
 *
 * @module presence
 */

const ACTIVITIES = [
  {
    action: 'Playing',
    name: 'Poll Master',
    title: null, // filled dynamically with server count
    subtitle: '/poll to create one',
  },
  {
    action: 'Watching',
    name: 'Votes roll in',
    title: '📊',
    subtitle: 'let the people speak',
  },
];

let activityIndex = 0;

/**
 * Rotate and update the bot's presence/activity status.
 * @param {import('@nerimity/nerimity.js').Client} client
 */
function updatePresence(client) {
  try {
    const serverCount = client.servers?.cache?.size ?? 0;
    const serverLabel = `${serverCount} server${serverCount !== 1 ? 's' : ''}`;

    const activity = { ...ACTIVITIES[activityIndex % ACTIVITIES.length] };
    activityIndex += 1;

    // First activity shows the live server count
    if (activityIndex % ACTIVITIES.length === 1) {
      activity.title = serverLabel;
    }

    client.user?.setActivity({
      action: activity.action,
      name: activity.name,
      startedAt: Date.now(),
      title: activity.title || serverLabel,
      subtitle: activity.subtitle,
    });
  } catch (err) {
    console.error('[presence] Failed to update presence:', err.message);
  }
}

/**
 * Start the presence rotation on an interval.
 * @param {import('@nerimity/nerimity.js').Client} client
 * @param {number} [intervalMs=15000]
 * @returns {NodeJS.Timeout} The interval handle
 */
function startPresenceRotation(client, intervalMs = 15000) {
  updatePresence(client);
  return setInterval(() => updatePresence(client), intervalMs);
}

module.exports = {
  updatePresence,
  startPresenceRotation,
};
