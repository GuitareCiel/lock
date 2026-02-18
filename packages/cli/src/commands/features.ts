import { Command } from 'commander';
import chalk from 'chalk';
import { apiGet } from '../lib/api-client.js';

export const featuresCommand = new Command('features')
  .description('List features')
  .option('--product <slug>', 'Filter by product')
  .action(async (opts) => {
    const params = new URLSearchParams();
    if (opts.product) params.set('product', opts.product);

    const query = params.toString();
    const path = `/api/v1/features${query ? `?${query}` : ''}`;

    try {
      const result = await apiGet<any>(path);
      const features = result.features ?? result ?? [];

      if (!Array.isArray(features) || features.length === 0) {
        console.log(chalk.dim('No features found.'));
        return;
      }

      console.log(chalk.bold('Features:'));
      console.log('');

      for (const f of features) {
        const product = f.product?.slug ?? f.product_slug ?? '';
        const productStr = product ? chalk.dim(` (${product})`) : '';
        console.log(`  ${chalk.cyan(f.slug)}  ${f.name}${productStr}`);
        if (f.description) {
          console.log(`    ${chalk.dim(f.description)}`);
        }
      }
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
