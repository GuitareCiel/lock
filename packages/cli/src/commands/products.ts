import { Command } from 'commander';
import chalk from 'chalk';
import { apiGet } from '../lib/api-client.js';

export const productsCommand = new Command('products')
  .description('List all products')
  .action(async () => {
    try {
      const result = await apiGet<any>('/api/v1/products');
      const products = result.products ?? result ?? [];

      if (!Array.isArray(products) || products.length === 0) {
        console.log(chalk.dim('No products found.'));
        return;
      }

      console.log(chalk.bold('Products:'));
      console.log('');

      for (const p of products) {
        const count = p.lock_count ?? p.lockCount ?? '';
        const countStr = count !== '' ? chalk.dim(` (${count} locks)`) : '';
        console.log(`  ${chalk.cyan(p.slug)}  ${p.name}${countStr}`);
        if (p.description) {
          console.log(`    ${chalk.dim(p.description)}`);
        }
      }
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
