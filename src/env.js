const fs = require('fs');
const path = require('path');

/**
 * Load environment variables from a .env file into process.env.
 * Existing process.env values take precedence (not overwritten).
 *
 * @param {string} [envPath] - Path to .env file (default: `path/to/project/.env`)
 * @returns {boolean} Whether a .env file was found and loaded
 */
function loadEnv(envPath) {
  const resolvedPath = envPath || path.join(__dirname, '..', '.env');

  if (!fs.existsSync(resolvedPath)) {
    return false;
  }

  try {
    for (const line of fs.readFileSync(resolvedPath, 'utf-8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;

      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();

      // Don't overwrite env vars already set (e.g., by the OS or Docker)
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
    return true;
  } catch (err) {
    console.warn('Failed to load .env file:', err.message);
    return false;
  }
}

module.exports = { loadEnv };
