# Self-Hosting

Lock is designed to run on your own infrastructure. This guide covers everything you need to deploy and operate a Lock instance.

## Architecture

```
                    ┌──────────────┐
                    │  Slack Bot   │ (optional)
                    └──────┬───────┘
                           │
┌──────────┐   ┌───────────┴────────────┐   ┌──────────────┐
│  CLI     │───│     Core API           │───│  PostgreSQL  │
└──────────┘   │     (Fastify)          │   │  + pgvector  │
               │                        │   └──────────────┘
┌──────────┐   │  - Decision CRUD       │
│  MCP     │───│  - Conflict detection  │
│  Server  │   │  - Lineage tracking    │
└──────────┘   │  - Notifications       │
               └────────────────────────┘
                     │            │
              ┌──────┴──┐  ┌─────┴──────┐
              │ OpenAI  │  │  Anthropic  │
              │ (embed) │  │  (classify) │
              └─────────┘  └────────────┘
```

The core API is the only stateful component. The Slack bot, CLI, and MCP server are all thin clients that call the API.

## Quick Start (Docker Compose)

The recommended way to deploy Lock. One command gets you a working instance.

### Prerequisites

- **Docker** and **Docker Compose**
- **OpenAI API key** (for semantic embeddings)
- **Anthropic API key** (for conflict classification)
- **Slack app tokens** (optional, for Slack integration)

### 1. Clone and configure

```bash
git clone <repo-url> lock
cd lock
cp .env.example .env
```

Edit `.env` with your keys:

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Slack (optional)
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...
```

### 2. Start everything

```bash
docker compose up -d
```

This:
1. Starts PostgreSQL 16 with pgvector
2. Waits for the database to be healthy
3. Applies the database schema automatically
4. Starts the Core API and Slack bot

### 3. Verify

```bash
# Check the API is running
curl http://localhost:3000/health

# Check container logs
docker compose logs lock
```

You should see:
```
Lock: PostgreSQL is ready.
Lock: schema push complete.
Lock: starting services...
Lock Core API running on port 3000
```

### 4. Create an API key

Open `http://localhost:3000` in your browser to access the admin UI. Create a workspace and generate an API key.

### 5. Connect clients

**CLI:**
```bash
npm install -g @uselock/cli
lock login --url http://your-server:3000 --key lk_your_api_key
```

**MCP (Claude Code / Cursor):**
```json
{
  "mcpServers": {
    "lock": {
      "command": "npx",
      "args": ["@uselock/mcp-server"],
      "env": {
        "LOCK_API_URL": "http://your-server:3000",
        "LOCK_API_KEY": "lk_your_api_key"
      }
    }
  }
}
```

---

## Manual Setup (without Docker)

For environments where Docker isn't available, or for development.

### Prerequisites

- **Node.js 20+**
- **pnpm 9+**
- **PostgreSQL 16** with the **pgvector** extension
- **OpenAI API key** (for semantic embeddings)
- **Anthropic API key** (for conflict classification)

### 1. Install dependencies

```bash
git clone <repo-url> lock
cd lock
pnpm install
```

### 2. Set up the database

If running your own PostgreSQL instance, enable the required extensions:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

Or use the included Docker Compose to start just the database:

```bash
pnpm db:up
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql://lock:lock@localhost:5432/lock

OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Slack (optional)
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...

API_PORT=3000
SLACK_PORT=3001
NODE_ENV=development
INTERNAL_SECRET=change-me-to-a-random-string
```

### 4. Run migrations

```bash
pnpm db:migrate
```

### 5. Build and start

```bash
pnpm build
pnpm dev          # Core API + Slack bot
# or
pnpm dev:core     # Just the core API
```

The API will be available at `http://localhost:3000`.

### 6. Create an API key

Open `http://localhost:3000` in your browser to access the admin UI. Create a workspace and generate an API key.

---

## Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | — |
| `OPENAI_API_KEY` | No | OpenAI API key for embeddings | Disables semantic search |
| `ANTHROPIC_API_KEY` | No | Anthropic API key for conflict classification | Disables LLM classification |
| `SLACK_BOT_TOKEN` | No | Slack bot token (`xoxb-...`) | Disables Slack bot |
| `SLACK_SIGNING_SECRET` | No | Slack signing secret | — |
| `SLACK_APP_TOKEN` | No | Slack app-level token (`xapp-...`) for socket mode | — |
| `API_PORT` | No | Port for the core API | `3000` |
| `SLACK_PORT` | No | Port for the Slack bot | `3001` |
| `NODE_ENV` | No | `development` or `production` | `development` |
| `INTERNAL_SECRET` | Yes | Shared secret for Slack bot <-> API auth | — |

### Degraded Modes

Lock works without external AI services, with reduced functionality:

- **Without OpenAI**: Semantic search falls back to text search (ILIKE). Conflict detection is disabled.
- **Without Anthropic**: Conflict classification is disabled. Similar decisions are still found via embeddings, but relationships aren't classified.
- **Without Slack tokens**: Slack bot won't start. Cross-surface notifications to Slack are disabled. CLI and MCP still work.

---

## Database

### PostgreSQL with pgvector

Lock requires PostgreSQL 16+ with the pgvector extension for storing and querying vector embeddings. The Docker Compose setup handles this automatically.

If you're running your own PostgreSQL instance, install pgvector:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### Schema Management

The Docker deployment uses `drizzle-kit push` to apply the schema directly from `schema.ts` on each container start. This is idempotent — safe to run repeatedly.

For manual deployments, use migrations:

```bash
pnpm db:migrate
```

### Schema

The database has 7 tables:

| Table | Purpose |
|-------|---------|
| `workspaces` | Multi-tenant isolation (one per Slack workspace or org) |
| `products` | Top-level containers for decisions |
| `features` | Scoped areas within products |
| `locks` | Decision records with embeddings |
| `lock_links` | External references (Jira, GitHub, etc.) |
| `channel_configs` | Slack channel to product/feature mappings |
| `api_keys` | Authentication keys (stored as SHA-256 hashes) |

---

## Slack App Setup

### Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create a new app from scratch
3. Enable **Socket Mode** (for development) or configure **Event Subscriptions** (for production)

### Required Scopes (Bot Token Scopes)

| Scope | Purpose |
|-------|---------|
| `app_mentions:read` | Receive @lock mentions |
| `chat:write` | Post responses and notifications |
| `channels:history` | Read thread context |
| `groups:history` | Read thread context in private channels |
| `users:read` | Resolve user display names |

### Event Subscriptions

Subscribe to the `app_mention` event.

### Running the Slack Bot

With Docker Compose, the Slack bot starts automatically alongside the core API. Socket mode is used by default (no inbound port required).

For manual setups:

```bash
pnpm dev:slack
```

---

## Production Deployment

### Docker Compose (recommended)

The included `docker-compose.yml` is production-ready:

- PostgreSQL has a healthcheck; Lock waits for it before starting
- Schema is applied automatically on each start
- Both services restart automatically (`restart: unless-stopped`)
- Only port 3000 is exposed (Slack bot uses socket mode internally)

To customize the exposed port:

```bash
API_PORT=8080 docker compose up -d
```

### Running without Docker

```bash
# Build
pnpm build

# Core API
NODE_ENV=production node packages/core/dist/index.js

# Slack bot (if needed)
NODE_ENV=production node packages/slack/dist/index.js
```

### Health Check

```
GET /health
```

Returns `{ "status": "ok", "timestamp": "..." }`. Use this for load balancer health checks.

### Recommended Setup

- Run the core API behind a reverse proxy (nginx, Caddy, etc.)
- Use a managed PostgreSQL instance with pgvector support
- Set `NODE_ENV=production` for production logging and error handling
- Use a strong, random `INTERNAL_SECRET` for Slack bot <-> API auth
- Keep API keys secure — they're only shown once at creation time

---

## Development

### Running All Services

```bash
pnpm dev          # Core API + Slack bot (concurrently)
```

### Running Individual Services

```bash
pnpm dev:core     # Core API only
pnpm dev:slack    # Slack bot only
pnpm dev:cli      # CLI in dev mode
pnpm dev:mcp      # MCP server in dev mode
```

### Type Checking

```bash
pnpm typecheck    # All packages
```

### Project Structure

```
lock/
├── packages/
│   ├── core/        # Fastify API — all business logic
│   ├── slack/       # Slack bot (thin client)
│   ├── cli/         # CLI (thin client)
│   └── mcp/         # MCP server for AI agents (thin client)
├── scripts/
│   ├── docker-entrypoint.sh  # Container entrypoint
│   ├── init-db.sql           # Database initialization
│   └── seed.ts               # Sample data seeding
├── Dockerfile
└── docker-compose.yml
```

### Monorepo Commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm build` | Build all packages |
| `pnpm dev` | Start core API + Slack bot |
| `pnpm dev:core` | Start core API only |
| `pnpm dev:slack` | Start Slack bot only |
| `pnpm dev:cli` | Run CLI in dev mode |
| `pnpm dev:mcp` | Run MCP server in dev mode |
| `pnpm db:up` | Start PostgreSQL via Docker |
| `pnpm db:down` | Stop PostgreSQL |
| `pnpm db:migrate` | Run database migrations |
| `pnpm typecheck` | Type-check all packages |
