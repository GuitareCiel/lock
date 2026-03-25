import chalk from 'chalk';
import { Command } from 'commander';
import { apiGet, apiPost } from '../lib/api-client.js';
import { slugify } from '../lib/slugify.js';

export const productsCommand = new Command('products')
  .description('Manage products')
  .action(async () => {
    try {
      const result = await apiGet<any>('/api/v1/products');
      const products = result.products ?? result ?? [];

      if (!Array.isArray(products) || products.length === 0) {
        console.log(chalk.dim('No products found. Create one with: lock products create "My Product"'));
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

productsCommand
  .command('create <name>')
  .description('Create a new product')
  .option('--description <desc>', 'Product description')
  .option('--slug <slug>', 'Custom slug (auto-generated from name if omitted)')
  .action(async (name: string, opts: { description?: string; slug?: string }) => {
    try {
      const slug = opts.slug || slugify(name);
      const body: Record<string, string> = { slug, name };
      if (opts.description) body.description = opts.description;

      const result = await apiPost<any>('/api/v1/products', body);
      console.log(chalk.green(`Product created: ${result.name} (${result.slug})`));
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
