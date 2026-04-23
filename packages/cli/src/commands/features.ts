import chalk from 'chalk';
import { Command } from 'commander';
import { apiGet, apiPost } from '../lib/api-client.js';
import { slugify } from '../lib/slugify.js';

export const featuresCommand = new Command('features')
  .description('Manage features')
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
        console.log(chalk.dim('No features found. Create one with: lock features create <product-slug> "My Feature"'));
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

featuresCommand
  .command('create <product> <name>')
  .description('Create a new feature (usage: lock features create <product-slug> "Feature Name")')
  .option('--description <desc>', 'Feature description')
  .option('--slug <slug>', 'Custom slug (auto-generated from name if omitted)')
  .action(async (product: string, name: string, opts: { description?: string; slug?: string }) => {
    try {
      const slug = opts.slug || slugify(name);
      const body: Record<string, string> = { slug, name, product };
      if (opts.description) body.description = opts.description;

      const result = await apiPost<any>('/api/v1/features', body);
      console.log(chalk.green(`Feature created: ${result.name} (${result.slug}) in product ${product}`));
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
