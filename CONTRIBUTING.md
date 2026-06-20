# Contributing to PollMaster Bot

Thank you for your interest in contributing to PollMaster Bot! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Submitting Changes](#submitting-changes)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)

## Code of Conduct

This project follows a simple code of conduct:
- Be respectful and inclusive
- Focus on constructive feedback
- Help maintain a welcoming environment

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Set up the development environment (see below)
4. Create a new branch for your changes
5. Make your changes and test thoroughly
6. Submit a pull request

## How to Contribute

### Types of Contributions

We welcome various types of contributions:

- **Bug fixes**: Fix issues reported in GitHub Issues
- **Features**: Add new functionality to the bot
- **Documentation**: Improve README, AGENTS.md, or code comments
- **Tests**: Add test coverage (currently none exists)
- **Refactoring**: Improve code quality without changing behavior

### Development Setup

1. **Clone and install:**
```bash
git clone https://github.com/JoddabodScripts/pollmaster-bot.git
cd pollmaster-bot
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Add your Nerimity bot token to .env
```

3. **Register commands:**
```bash
npm run register
```

4. **Run the bot:**
```bash
npm start
```

### Important Notes

- This bot uses **CommonJS** (`require`/`module.exports`), not ES modules
- The `@nerimity/nerimity.js` dependency is a local file dependency
- No `.env` parser library is used - it's manually parsed
- Storage uses a flat JSON file (`data/polls.json`)

## Coding Standards

### Style Guidelines

- **Module format**: Use CommonJS (`require`, `module.exports`)
- **Naming**: 
  - camelCase for variables and functions
  - PascalCase for classes
- **Indentation**: 2 spaces (existing codebase standard)
- **Comments**: Add comments for complex logic
- **Error handling**: Use `console.error` for logging errors

### File Organization

- `src/index.js`: Main entry point, event handlers, command parsing
- `src/pollManager.js`: Poll CRUD operations and persistence
- `src/embedBuilder.js`: Pure rendering functions for embeds
- `scripts/`: Utility scripts (e.g., command registration)

### Best Practices

1. **Keep functions focused**: Each function should do one thing well
2. **Pure rendering**: Keep `embedBuilder.js` functions pure (no side effects)
3. **Persistence**: Always save to disk after modifying poll data
4. **Error handling**: Gracefully handle user input errors
5. **Button IDs**: Use numeric strings matching option indices

## Submitting Changes

### Pull Request Process

1. **Create a feature branch:**
```bash
git checkout -b feature/your-feature-name
```

2. **Make your changes:**
   - Write clean, documented code
   - Test your changes thoroughly
   - Ensure existing functionality isn't broken

3. **Commit your changes:**
```bash
git add .
git commit -m "Add feature: brief description"
```

4. **Push to your fork:**
```bash
git push origin feature/your-feature-name
```

5. **Open a Pull Request:**
   - Go to the original repository on GitHub
   - Click "New Pull Request"
   - Select your branch
   - Fill out the PR template with details

### PR Guidelines

- **Title**: Clear, concise description of changes
- **Description**: 
  - What changes were made
  - Why the changes were needed
  - How to test the changes
- **Scope**: Keep PRs focused on a single feature/fix
- **Tests**: Describe how you tested the changes
- **Breaking changes**: Clearly mark any breaking changes

### Review Process

- Maintainers will review your PR
- Address any requested changes
- Once approved, your PR will be merged

## Reporting Bugs

Found a bug? Please report it!

### Before Submitting

1. Check if the bug is already reported in [Issues](https://github.com/JoddabodScripts/pollmaster-bot/issues)
2. Try to reproduce the bug with the latest version
3. Gather relevant information (logs, steps to reproduce)

### Bug Report Template

When creating a bug report, include:

- **Description**: Clear description of the bug
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Environment**: 
  - Node.js version
  - Operating system
  - Bot version/commit hash
- **Logs**: Any relevant error messages or logs

## Feature Requests

Have an idea for a new feature?

### Before Submitting

1. Check if the feature is already requested
2. Consider if it aligns with the bot's purpose
3. Think about implementation complexity

### Feature Request Template

Include:

- **Feature Description**: Clear description of the feature
- **Use Case**: Why this feature would be useful
- **Proposed Solution**: How you envision it working
- **Alternatives**: Any alternative approaches considered

## Questions?

If you have questions about contributing:

- Open a [GitHub Discussion](https://github.com/JoddabodScripts/pollmaster-bot/discussions)
- Create an issue with the `question` label

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to PollMaster Bot! 🎉
