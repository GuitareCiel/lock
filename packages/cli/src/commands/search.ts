import { Command } from 'commander';
import chalk from 'chalk';
import { getConfig } from '../lib/config.js';
import { apiPost } from '../lib/api-client.js';
import { formatLockList } from '../lib/formatters.js';

export const searchCommand = new Command('search')
  .description('Semantic search across decision locks')
  .argument('<query>', 'Search query')
  .option('--product <slug>', 'Filter by product')
  .option('--feature <slug>', 'Filter by feature')
  .action(async (query: string, opts) => {
    const config = getConfig();

    const body: Record<string, unknown> = { query };

    // Use config defaults if not overridden
    const product = opts.product ?? config?.product;
    const feature = opts.feature;

    if (product) body.product = product;
    if (feature) body.feature = feature;

    try {
      const result = await apiPost<any>('/api/v1/locks/search', body);
      const locks = result.locks ?? result ?? [];

      if (!Array.isArray(locks) || locks.length === 0) {
        console.log(chalk.dim('No matching locks found.'));
        return;
      }

      console.log(chalk.bold(`Search results for "${query}":`));
      console.log('');
      console.log(formatLockList(locks));
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
