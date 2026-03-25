import os from 'node:os';
import chalk from 'chalk';
import { Command } from 'commander';
import { apiPost } from '../lib/api-client.js';
import { formatLock } from '../lib/formatters.js';

export const revertCommand = new Command('revert')
  .description('Revert a decision lock')
  .argument('<id>', 'Lock short ID to revert (e.g. l-a7f3e2)')
  .argument('[reason]', 'Reason for reverting')
  .option('-m, --message <message>', 'Reason for reverting (alternative to positional argument)')
  .action(async (id: string, reason: string | undefined, opts) => {
    const message = reason ?? opts.message;

    if (!message) {
      console.error(chalk.red('Error: A reason is required to revert a lock.'));
      console.error(chalk.dim('Usage: lock revert <id> "reason" or lock revert <id> -m "reason"'));
      process.exit(1);
    }

    const username = os.userInfo().username;

    try {
      const result = await apiPost<any>(`/api/v1/locks/${id}/revert`, {
        message,
        author: {
          type: 'human',
          id: username,
          name: username,
          source: 'cli',
        },
      });

      const lock = result.lock ?? result;
      console.log(chalk.green.bold('Lock reverted.'));
      console.log('');
      console.log(formatLock(lock));
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
