/**
 * PollMaster presence — sets a single static rich presence on startup.
 *
 * @module presence
 */

/**
 * Set the bot's presence once and leave it static.
 * @param {import('@nerimity/nerimity.js').Client} client
 */
function setPresence(client) {
  try {
    client.user?.setActivity({
      action: 'Playing',
      name: 'Poll Master',
      startedAt: Date.now(),
      title: 'Poll Master',
      subtitle: '/poll to create one',
    });
  } catch (err) {
    console.error('[presence] Failed to set presence:', err.message);
  }
}

module.exports = { setPresence };
