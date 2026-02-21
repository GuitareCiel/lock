# Lock

Decision tracking for product teams. Records product decisions where they happen — Slack, terminal, or AI agent sessions — so you always know why something was built a certain way.

```
@lock Use notional value instead of margin for position display --scope major --ticket TRADE-442
```

```
$ lock "Use notional value instead of margin for position display" --scope major
```

Lock captures the decision, detects conflicts with existing decisions, and notifies the team in Slack.

## How it works

Lock has one core API and multiple input surfaces:

- **Slack bot** — `@lock <decision>` in any channel
- **CLI** — `lock "<decision>"` from the terminal
- **MCP server** — AI agents (Claude Code, Cursor) read and write decisions via tools
- **REST API** — direct HTTP calls

Decisions are stored in PostgreSQL with vector embeddings. When a new decision is committed, Lock searches for conflicting or superseding decisions across the same product and flags them.

## Quick Start (Docker)

The fastest way to run Lock. Requires Docker.

### 1. Clone and configure

```bash
git clone <repo-url> lock
cd lock
cp .env.example .env
```

Edit `.env` with your API keys:

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Slack (optional — skip if not using the Slack surface)
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...
```

### 2. Start everything

```bash
docker compose up -d
```

This starts PostgreSQL (with pgvector), applies the database schema, and runs the Core API + Slack bot. The API is available at `http://localhost:3000`.

### 3. Create an API key

Open `http://localhost:3000` in your browser to access the admin UI. Create a workspace and generate an API key.

### 4. Verify

```bash
curl http://localhost:3000/health
```

## Development Setup

For contributors working on Lock itself.

### Prerequisites

- **Node.js** 20+
- **pnpm** 9+
- **Docker** (for PostgreSQL)
- **OpenAI API key** — generates embeddings for conflict detection
- **Anthropic API key** — classifies conflicts via Claude

Optional:
- **Slack workspace** with permissions to create apps (for the Slack bot surface)

### 1. Clone and install

```bash
git clone <repo-url> lock
cd lock
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your keys:

```env
DATABASE_URL=postgresql://lock:lock@localhost:5432/lock

OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Slack (optional — skip if not using the Slack surface)
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...

API_PORT=3000
SLACK_PORT=3001
NODE_ENV=development
INTERNAL_SECRET=<random-string-for-service-to-service-auth>
```

### 3. Start the database

```bash
pnpm db:up
```

This starts PostgreSQL 16 with pgvector via Docker Compose.

### 4. Run migrations

```bash
pnpm db:migrate
```

### 5. Build all packages

```bash
pnpm build
```

### 6. Start development servers

```bash
# Core API + Slack bot
pnpm dev

# Or individually:
pnpm dev:core    # Core API on :3000
pnpm dev:slack   # Slack bot on :3001
```

## Slack app setup

Create a new app at https://api.slack.com/apps:

**Bot Token Scopes:**
- `app_mentions:read` — detect `@lock` mentions
- `channels:history` — read thread context
- `channels:read` — get channel info
- `chat:write` — post responses and notifications
- `users:read` — resolve user display names

**Event Subscriptions:**
- `app_mention`

**Socket Mode:** Enable for local development. This uses the `SLACK_APP_TOKEN` (`xapp-...`).

After creating the app, install it to your workspace and copy the tokens into `.env`.

## CLI setup

Install the CLI globally:

```bash
npm install -g @uselock/cli
```

Or build from source:

```bash
pnpm --filter @uselock/cli build
cd packages/cli && pnpm link --global
```

### Authenticate

```bash
lock login
```

This prompts for your Lock API URL and API key, validates them against the server, and saves credentials to `~/.lock/credentials`.

For non-interactive use (CI/scripts):

```bash
lock login --url http://localhost:3000 --key lk_your_api_key
```

### Initialize a project directory

```bash
cd ~/your-project
lock init --product trading --feature margin-rework
```

This creates `.lock/config.json` in the current directory. Now you can commit decisions:

```bash
lock "Use notional value instead of margin for position display"
lock log
lock export          # generates LOCK.md with all active decisions
```

### CLI commands

| Command | Description |
|---------|-------------|
| `lock "<message>"` | Commit a decision |
| `lock log` | List recent decisions |
| `lock show <id>` | Show a single decision |
| `lock search "<query>"` | Semantic search |
| `lock check "<intent>"` | Check for constraints before building |
| `lock revert <id>` | Revert a decision |
| `lock link <id> <ref>` | Add an external link |
| `lock export` | Export active decisions to `LOCK.md` |
| `lock products` | List products |
| `lock features` | List features |
| `lock init` | Initialize project directory |
| `lock login` | Authenticate with a Lock server |
| `lock logout` | Remove stored credentials |
| `lock whoami` | Show current credentials and connection status |

## MCP server setup (for AI agents)

The MCP server lets AI coding tools read and write decisions. Add it to your tool's MCP config.

**Claude Code** (`~/.claude.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "lock": {
      "command": "npx",
      "args": ["@uselock/mcp-server"],
      "env": {
        "LOCK_API_URL": "http://localhost:3000",
        "LOCK_API_KEY": "lk_your_api_key"
      }
    }
  }
}
```

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "lock": {
      "command": "npx",
      "args": ["@uselock/mcp-server"],
      "env": {
        "LOCK_API_URL": "http://localhost:3000",
        "LOCK_API_KEY": "lk_your_api_key"
      }
    }
  }
}
```

### MCP tools

| Tool | Description |
|------|-------------|
| `lock_context` | Get all active decisions as formatted text. Use before building. |
| `lock_check` | Search for decisions relevant to what you're about to build. |
| `lock_commit` | Record a new decision. |
| `lock_query` | Query decisions with filters. |
| `lock_get` | Get a single decision by ID. |
| `lock_get_lineage` | Get the supersession/revert chain for a decision. |
| `lock_search_semantic` | Semantic search across decisions. |
| `lock_list_products` | List all products. |
| `lock_list_features` | List features, optionally filtered by product. |

## API

All endpoints are under `/api/v1/`. Auth via `Authorization: Bearer <api_key>`.

### Locks

```
POST   /api/v1/locks                  # Commit a decision
GET    /api/v1/locks                  # List/filter (query: product, feature, scope, status, limit, offset)
GET    /api/v1/locks/:shortId         # Get one decision
POST   /api/v1/locks/:shortId/revert  # Revert a decision
POST   /api/v1/locks/:shortId/link    # Add an external link
POST   /api/v1/locks/search           # Semantic search (body: { query, product?, feature? })
```

### Products & Features

```
GET    /api/v1/products               # List products with decision counts
POST   /api/v1/products               # Create a product
GET    /api/v1/features               # List features (query: product)
POST   /api/v1/features               # Create a feature
```

Products and features are auto-created on first reference — no admin step needed.

## Project structure

```
lock/
├── packages/
│   ├── core/          # Fastify API — all business logic
│   ├── slack/         # Slack bot (@slack/bolt)
│   ├── cli/           # Terminal client (commander.js)
│   └── mcp/           # MCP server for AI agents
├── Dockerfile         # Multi-stage build for production
├── docker-compose.yml # PostgreSQL + pgvector + Lock app
├── .env.example       # Environment template
└── CLAUDE.md          # Full architecture spec
```

## Stopping services

```bash
# Docker deployment
docker compose down

# Development database only
pnpm db:down
```
