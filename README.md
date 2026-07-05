# PollMaster Bot

A feature-rich poll management bot for [Nerimity](https://nerimity.com), enabling users to create, vote on, and manage interactive polls directly in chat.

![Nerimity](https://img.shields.io/badge/Platform-Nerimity-blue)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Features

- **Interactive Polls**: Create polls with up to 10 options using slash commands
- **Multiple Voting Modes**: Support for single-choice or multiple-choice voting
- **Real-time Updates**: Vote counts update instantly as users vote
- **Public/Anonymous Voting**: Choose whether to show voter names or keep votes anonymous
- **Auto-close Timers**: Set polls to automatically close after a specified duration
- **Vote Management**: Users can change or remove their votes before the poll closes
- **Rich Embeds**: Beautiful HTML-formatted poll displays with voting buttons

## Installation

### Prerequisites

- Node.js 18 or higher
- A Nerimity bot account and token
- The `@nerimity/nerimity.js` library (local dependency)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/JoddabodScripts/pollmaster-bot.git
cd pollmaster-bot
```

2. Install dependencies:
```bash
npm install
```

3. Configure the bot:
```bash
cp .env.example .env
```

Edit `.env` and add your bot token:
```env
BOT_TOKEN=your_nerimity_bot_token_here
```

4. Register slash commands:
```bash
npm run register
```

5. Start the bot:
```bash
npm start
```

## Usage

### Creating a Poll

Separate the question and options with `|` — no quotes needed:

```
/poll What's your favorite color? | Red | Blue | Green
```

Or put the question and each option on their own lines (Shift+Enter):

```
/poll What's your favorite color?
Red
Blue
Green
```

The classic quoted style still works too:

```
/poll "What's your favorite color?" "Red" "Blue" "Green"
```

Type `/poll help` in any channel for a quick reference.

### Command Flags

Flags can go anywhere in the command:

- `--multiple` (or `-m`): Allow users to select multiple options
- `--public` (or `-p`): Show voter names for each option
- `--time <duration>` (or `--duration`, `-t`): Auto-close after a duration like `30m`, `2h`, `1d`, `1h30m`, or plain minutes

### Examples

**Simple poll:**
```
/poll Should we have a meeting tomorrow? | Yes | No | Maybe
```

**Multiple choice poll:**
```
/poll Which features do you want? | Feature A | Feature B | Feature C --multiple
```

**Public poll that closes in 2 hours:**
```
/poll Pizza toppings? | Pepperoni | Mushrooms | Olives --public --time 2h
```

**Closing a poll manually:**
```
/poll end
```
_(Only the poll creator or an admin can end a poll. Use `/poll list` to see open polls and `/poll end <number>` to close a specific one.)_

### Voting

- Click any option button to vote
- In single-choice mode, clicking a different option changes your vote
- Click the same option again to remove your vote
- Your vote is saved instantly and the poll updates in real-time

## Project Structure

```
poll/
├── src/
│   ├── index.js          # Main entry point, event handlers
│   ├── pollManager.js    # Poll storage and management
│   └── embedBuilder.js   # HTML embed rendering
├── scripts/
│   └── register.js       # Slash command registration
├── data/
│   └── polls.json        # Persistent poll storage (auto-generated)
├── .github/              # GitHub templates and configurations
├── README.md
├── LICENSE.md
├── CONTRIBUTING.md
└── package.json
```

## Configuration

The bot uses a flat JSON file (`data/polls.json`) for persistence. No database setup required.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BOT_TOKEN` | Yes | Your Nerimity bot token |

## Architecture

- **Runtime**: Node.js with CommonJS modules
- **Library**: `@nerimity/nerimity.js` (Nerimity SDK)
- **Storage**: Flat JSON file (no database)
- **Embeds**: HTML-based embeds (not Discord-style)

See [AGENTS.md](AGENTS.md) for detailed architectural documentation.

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) to get started.

- Report bugs via [GitHub Issues](https://github.com/JoddabodScripts/pollmaster-bot/issues)
- Submit feature requests
- Contribute code via pull requests

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/JoddabodScripts/pollmaster-bot/issues)
- **Nerimity Platform**: [nerimity.com](https://nerimity.com)

## Acknowledgments

Built with [`@nerimity/nerimity.js`](https://nerimity.com) - the official Nerimity bot SDK.

---

Made with ❤️ for the Nerimity community
