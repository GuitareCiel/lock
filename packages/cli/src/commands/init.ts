import { Command } from 'commander';
import chalk from 'chalk';
import { saveConfig } from '../lib/config.js';
import { apiGet } from '../lib/api-client.js';

export const initCommand = new Command('init')
  .description('Initialize this directory with a product and feature scope')
  .requiredOption('--product <slug>', 'Product slug (e.g. "trading")')
  .requiredOption('--feature <slug>', 'Feature slug (e.g. "margin-rework")')
  .action(async (opts) => {
    const { product, feature } = opts as { product: string; feature: string };

    try {
      // Verify connectivity by calling the products endpoint.
      // If the product doesn't exist yet, auto-creation will happen on first lock commit.
      try {
        await apiGet('/api/v1/products');
      } catch {
        console.log(chalk.yellow('Warning: Could not reach the Lock API. Config will be saved locally anyway.'));
      }

      saveConfig({ product, feature });

      console.log(chalk.green('Initialized Lock in this directory.'));
      console.log(`  ${chalk.dim('Product:')} ${product}`);
      console.log(`  ${chalk.dim('Feature:')} ${feature}`);
      console.log('');
      console.log(chalk.dim('Config saved to .lock/config.json'));
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
