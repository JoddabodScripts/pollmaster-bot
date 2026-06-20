# PollMaster — Agent Context

This file is the canonical context for AI agents working on this project.
It lives in the project root so every fresh session starts with awareness.

## Project Overview

PollMaster is a **[nerimity.js](https://nerimity.com)** bot — it runs on the Nerimity chat platform (a Discord-like service) using the `@nerimity/nerimity.js` SDK. It lets users create, vote on, and manage polls directly in chat. Users create polls with a slash command, vote by clicking buttons on the poll message, and can optionally allow multiple choices, show voter names, or set an auto-close timer.

## Tech Stack

- **Runtime:** Node.js (CommonJS, `"type": "commonjs"`)
- **Library:** [`@nerimity/nerimity.js`](https://nerimity.com) — local dependency linked via `file:../nrepos/nerimity.js`
- **Storage:** Flat JSON file (`data/polls.json`) — no database
- **No other dependencies** (no Express, no Discord.js, no dotenv — .env is parsed manually with `fs`)

## Directory Structure

```
poll/
├── src/
│   ├── index.js          # Main entry point — client setup, event handlers, command parsing
│   ├── pollManager.js    # PollManager class — CRUD, persistence, timer management
│   └── embedBuilder.js   # HTML embed rendering (open poll, results, buttons)
├── scripts/
│   └── register.js       # One-shot slash command registration (POST to Nerimity API)
├── data/
│   └── polls.json        # Persistent poll storage (gitignored)
├── .env                  # BOT_TOKEN (gitignored)
├── .env.example          # Template for .env
├── package.json          # Project manifest
└── .gitignore
```

## Architecture

### Data flow

1. **User runs `/poll "Question?" "A" "B" ...`** in chat
2. `index.js` parses args and flags (`--multiple`, `--public`, `--duration <min>`)
3. Builds an HTML embed via `embedBuilder.buildPollHtml()` and button rows
4. Sends the poll message (with empty content, relying on `htmlEmbed`)
5. Poll data is stored in `pollManager` and persisted to `data/polls.json`
6. If `--duration` is set, a `setTimeout` is armed to auto-close

7. **User clicks a vote button** → `Events.MessageButtonClick` fires
8. `index.js` looks up the poll, toggles the user's vote (single or multiple)
9. Saves to disk, edits the embed to reflect new counts, responds with a confirmation

10. **Poll closing** (manual `/poll end` or auto-close): replaces the embed with a results view (`buildResultsHtml`), removes buttons

### Key abstractions

| File | Exports | Purpose |
|------|---------|---------|
| `src/pollManager.js` | `PollManager` class | In-memory poll store with JSON persistence, timer management, and query helpers |
| `src/embedBuilder.js` | `buildPollHtml`, `buildResultsHtml`, `buildButtons`, `countTotalVotes`, `countOptionVotes` | Pure rendering functions — take poll data + client, return HTML string or button configs |
| `src/index.js` | Side effects only | Entry point — wires up Client, registers event listeners, parses commands |

### Poll data shape (in `polls.json`)

Polls are keyed by `messageId-channelId`. Each value:

```json
{
  "messageId": "...",
  "channelId": "...",
  "guildId": "...",
  "creatorId": "...",
  "question": "...",
  "options": ["A", "B", "C"],
  "multiple": false,
  "public": false,
  "endsAt": null,
  "votes": { "userId": [0], "userId2": [1, 2] },
  "closed": false,
  "createdAt": 1700000000000
}
```

- `votes` maps user IDs to arrays of option indices (always arrays, even in single-choice mode)
- `closed` is set to `true` when the poll ends (manual or auto)
- `endsAt` is a `Date.now()` timestamp or `null`

## Key Conventions

- **CommonJS** (`require`/`module.exports`) — no ES modules
- **No external config parser** — .env is loaded manually in `index.js` with a simple `fs.readFileSync` loop
- **Error handling:** `console.error` for logging, no error-reporting service; button responders use `.catch(() => {})` to swallow ephemeral failures
- **Naming:** camelCase for variables/functions, PascalCase for classes
- **No tests exist yet** (no `test/` directory, no test runner in `package.json`)
- **No linter/formatter config** visible

## Commands / Entry Points

| Command | Description |
|---------|-------------|
| `npm start` or `npm run dev` | Run the bot (`node src/index.js`) |
| `npm run register` | Register slash commands with Nerimity (`node scripts/register.js`) |

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `BOT_TOKEN` | Yes | Nerimity bot token |

Copy `.env.example` to `.env` and set `BOT_TOKEN`.

## Testing

No test infrastructure exists. Tests would need to be created from scratch if desired. The project currently has zero tests.

## Notable Gotchas

- **`@nerimity/nerimity.js` is a local dependency** — linked via `file:../nrepos/nerimity.js`. It is NOT published to npm. The `../nrepos/nerimity.js` directory must exist relative to `/home/joud/poll` for `npm install` to work. Run `npm install` from the project root after ensuring the dependency is available.
- **No dotenv package** — `.env` is parsed manually in both `index.js` and `register.js` with a basic line-by-line parser. Quoted values and edge cases in `.env` are not handled.
- **HTML embeds, not Discord embeds** — the bot uses Nerimity's `htmlEmbed` field (inline HTML) rather than Discord-style embed objects.
- **Button IDs are numeric strings** (`"0"`, `"1"`, etc.) matching option indices. parseInt is used on click.
- **Timer recovery on restart** — on `Ready`, the bot closes any polls that expired while offline and re-arms timers for future ones.
- **Single-choice mode is a toggle** — clicking the same option again removes your vote (un-vote).
- **Max 10 options** enforced client-side in the create handler.
- **No permission system** beyond the creator/admin check for `/poll end` using `RolePermissions.ADMIN`.
