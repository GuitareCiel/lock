#!/usr/bin/env node

import { Command } from 'commander';
import { checkCommand } from './commands/check.js';
import { commitCommand } from './commands/commit.js';
import { exportCommand } from './commands/export.js';
import { featuresCommand } from './commands/features.js';
import { initCommand } from './commands/init.js';
import { knowledgeCommand } from './commands/knowledge.js';
import { linkCommand } from './commands/link.js';
import { logCommand } from './commands/log.js';
import { loginCommand } from './commands/login.js';
import { logoutCommand } from './commands/logout.js';
import { productsCommand } from './commands/products.js';
import { recapCommand } from './commands/recap.js';
import { revertCommand } from './commands/revert.js';
import { searchCommand } from './commands/search.js';
import { showCommand } from './commands/show.js';
import { whoamiCommand } from './commands/whoami.js';

const program = new Command();

program.name('lock').description('Lock — the decision protocol for agents').version('0.2.4');

// Register subcommands
program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(whoamiCommand);
program.addCommand(initCommand);
program.addCommand(commitCommand);
program.addCommand(logCommand);
program.addCommand(productsCommand);
program.addCommand(featuresCommand);
program.addCommand(showCommand);
program.addCommand(revertCommand);
program.addCommand(linkCommand);
program.addCommand(searchCommand);
program.addCommand(checkCommand);
program.addCommand(exportCommand);
program.addCommand(recapCommand);
program.addCommand(knowledgeCommand);

// Default action: if the first argument doesn't match a known subcommand,
// treat it as a shorthand for `lock commit "message"`.
const knownCommands = new Set(program.commands.map((cmd) => cmd.name()));

const args = process.argv.slice(2);
const firstArg = args[0];

if (firstArg && !firstArg.startsWith('-') && !knownCommands.has(firstArg)) {
  process.argv = [process.argv[0], process.argv[1], 'commit', ...args];
}

program.parse();
