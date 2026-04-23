import fs from 'node:fs';
import path from 'node:path';
import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { Command } from 'commander';
import { API_URL } from '../lib/config.js';
import { credentialsExist, getCredentials } from '../lib/credentials.js';

const SKILL_CONTENT = `---
name: lock
description: Proactively lock product decisions — check existing decisions before coding, recognize when you're making a decision, and propose locking it to the user
---

# Lock — Decision Protocol for AI Agents

Lock captures product decisions so your team knows what was decided, why, and by whom.
This skill makes you a proactive participant in decision tracking.

## IMPORTANT: You must do two things automatically

### 1. Check before you build

At the start of any task, run \`lock check\` with a description of what you're about to do:

\`\`\`bash
lock check "your intent here"
\`\`\`

Read the results. If existing decisions are relevant to your task, follow them. If your approach would contradict an existing decision, tell the user before proceeding.

### 2. Recognize decisions and propose locking them

**This is critical.** As you work, you will make or recommend choices — architecture, libraries, approaches, tradeoffs, conventions, behaviors. Whenever you recognize that a decision is being made, propose the exact lock message to the user:

> "Should we lock this? → \`lock "Use Redis with 15-minute TTL for API response caching" --scope major --tag backend\`"

Don't ask vaguely — always draft the specific lock command with the decision message, scope, and relevant tags so the user can approve it directly.

### What counts as a decision?

A decision is any choice that someone else on the team would need to know about. Examples:

- Choosing a library or tool ("Use Redis for caching")
- Picking an approach ("Paginate API responses with cursor-based pagination")
- Setting a convention ("All API errors return { error: { code, message } }")
- Making a tradeoff ("Prioritize read performance over write performance")
- Changing behavior ("Switch from polling to WebSocket for real-time updates")
- Dropping or reverting something ("Remove the legacy CSV export")

If you're unsure whether something is a decision, it probably is. Propose locking it.

### When NOT to lock

- Trivial implementation details (variable names, formatting)
- Things that are obvious from the code itself
- Temporary debugging changes

## Commands

### Recording decisions

\`\`\`bash
lock "message"                                           # quick decision (minor scope)
lock commit "message" --scope major --tag backend        # with metadata
lock commit "message" --product myapp --feature auth     # scoped to product/feature
\`\`\`

### Checking and browsing

\`\`\`bash
lock check "intent"              # find existing decisions relevant to your task
lock log                         # view recent decisions
lock log --product myapp         # filter by product
lock search "query"              # semantic search across all decisions
lock show l-a7f3e2               # view a specific decision
\`\`\`

### Managing decisions

\`\`\`bash
lock revert l-a7f3e2 "reason"    # revert a decision
lock link l-a7f3e2 TRADE-442     # attach a Jira/GitHub/Linear reference
\`\`\`

### Products and features

\`\`\`bash
lock products                              # list products
lock products create "My Product"          # create a product
lock features --product myapp              # list features for a product
lock features create myapp "My Feature"    # create a feature (first arg is product slug)
\`\`\`

### Setup

\`\`\`bash
lock init                        # set up Lock in a new project
lock login                       # authenticate
lock whoami                      # check auth status
\`\`\`

## Scopes

Use \`--scope\` to indicate the weight of a decision:

- \`minor\` — day-to-day implementation choices (default)
- \`major\` — significant product or technical decisions
- \`architectural\` — foundational decisions that affect the system

## Tags

Use \`--tag\` to categorize: \`backend\`, \`frontend\`, \`infra\`, \`ux\`, \`api\`, \`data\`, \`security\`, etc.

## Example workflow

1. User asks you to add caching to the API
2. You run \`lock check "add caching to API"\`
3. You read the results — no conflicting decisions
4. You recommend Redis with a TTL strategy
5. You propose: "Should we lock this? → \`lock "Use Redis with 15-minute TTL for API response caching" --scope major --tag backend --tag infra\`"
6. User approves
7. You run the lock command
8. You proceed with implementation
`;

export const initCommand = new Command('init')
  .description('Set up Lock in this project')
  .option('-y, --yes', 'Non-interactive mode (skip prompts)')
  .action(async (opts) => {
    const nonInteractive = opts.yes as boolean | undefined;
    const lockDir = path.join(process.cwd(), '.lock');
    const configPath = path.join(lockDir, 'config.json');
    const skillDir = path.join(process.cwd(), '.claude', 'skills', 'lock');
    const skillPath = path.join(skillDir, 'SKILL.md');

    try {
      console.log('');
      console.log(chalk.bold('  Welcome to Lock') + chalk.dim(' — the decision protocol for agents.'));
      console.log('');

      console.log(chalk.dim('  Step 1: Login'));
      if (credentialsExist()) {
        const creds = await getCredentials();
        const who = creds.name || creds.email || 'authenticated';
        console.log(chalk.green('  ✓') + ` Logged in as ${who}`);
      } else {
        if (nonInteractive) {
          console.log(chalk.yellow('  ⚠ Not logged in. Run `lock login` to authenticate.'));
        } else {
          try {
            const { deviceFlowLogin } = await import('../lib/device-flow.js');
            await deviceFlowLogin(API_URL);
            const creds = await getCredentials();
            const who = creds.name || creds.email || 'authenticated';
            console.log(chalk.green('  ✓') + ` Logged in as ${who}`);
          } catch {
            console.log(chalk.yellow('  ⚠ Login failed. You can try again later with `lock login`.'));
          }
        }
      }
      console.log('');

      console.log(chalk.dim('  Step 2: Project setup'));
      const created = !fs.existsSync(configPath);
      fs.mkdirSync(lockDir, { recursive: true });
      if (created) {
        fs.writeFileSync(configPath, JSON.stringify({}, null, 2) + '\n');
        console.log(chalk.green('  ✓') + ' Created .lock/');
      } else {
        console.log(chalk.green('  ✓') + ' .lock/ already set up');
      }
      console.log('');

      console.log(chalk.dim('  Step 3: AI agent integration'));
      if (fs.existsSync(skillPath)) {
        console.log(chalk.green('  ✓') + ' Lock skill already installed');
      } else {
        let shouldInstall = true;
        if (!nonInteractive) {
          shouldInstall = await confirm({
            message: 'Install Lock skill for Claude Code / Cursor?',
            default: true,
          });
        }
        if (shouldInstall) {
          fs.mkdirSync(skillDir, { recursive: true });
          fs.writeFileSync(skillPath, SKILL_CONTENT);
          console.log(chalk.green('  ✓') + ' Lock skill installed to .claude/skills/lock/');
        } else {
          console.log(chalk.dim('  — Skipped'));
        }
      }
      console.log('');

      console.log(chalk.green('  You\'re all set!') + ' Try:');
      console.log(chalk.cyan('    lock "Use Redis for session caching"'));
      console.log('');
    } catch (err: any) {
      if (err.name === 'ExitPromptError') {
        console.log(chalk.dim('Init cancelled.'));
        return;
      }
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
