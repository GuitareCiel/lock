# @uselock/cli

CLI for [Lock](https://github.com/uselock/lock) — track product decisions where they happen.

Lock captures product decisions ("let's use notional value instead of margin here") with full context, so your team always knows why something was built a certain way.

## Install

```bash
npm install -g @uselock/cli
```

## Get started

### 1. Sign up or log in

```bash
# Create an account (opens browser)
lock signup

# Or log in with an existing API key
lock login
```

`lock login` is interactive — it will prompt you for your API URL and key. You can also pass them directly:

```bash
lock login --url https://api.uselock.ai --key lk_...
```

### 2. Initialize your project

```bash
lock init
```

This walks you through login (if needed), sets up the `.lock/` project directory, and offers to install the Lock skill for Claude Code / Cursor.

Non-interactive mode:

```bash
lock init -y
```

### 3. Start locking decisions

```bash
lock "Use notional value instead of margin for position sizing"
```

That's it. Your decision is recorded with your name, timestamp, and project scope.

## Usage

```bash
# Record a decision
lock "Use notional value instead of margin for position sizing"

# Record with metadata
lock commit "Switch to WebSocket for real-time updates" --scope major --tag backend --ticket TRADE-442

# Check for conflicts before building
lock check "add retry logic to order submission"

# View recent decisions
lock log --product trading

# Show a specific decision
lock show l-a7f3e2

# Search decisions
lock search "authentication flow"

# Revert a decision
lock revert l-a7f3e2 "Client wants margin view back"

# Link a ticket or PR
lock link l-a7f3e2 TRADE-442

# Export decisions to markdown
lock export --product trading --output LOCK.md

# Check auth status
lock whoami
```

## Claude Code / Cursor integration

`lock init` installs a Lock skill to `.claude/skills/lock/` that teaches AI agents how to use the Lock CLI — checking for existing decisions before coding and recording new ones as they work.

## Documentation

Full documentation: [github.com/uselock/lock/tree/main/docs/cli.md](https://github.com/uselock/lock/tree/main/docs/cli.md)

## License

MIT
