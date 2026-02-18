import { Command } from 'commander';
import chalk from 'chalk';
import { apiGet } from '../lib/api-client.js';
import { formatLock } from '../lib/formatters.js';

export const showCommand = new Command('show')
  .description('Show full details of a lock')
  .argument('<id>', 'Lock short ID (e.g. l-a7f3e2)')
  .action(async (id: string) => {
    try {
      const result = await apiGet<any>(`/api/v1/locks/${id}`);
      const lock = result.lock ?? result;

      console.log(formatLock(lock));
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
