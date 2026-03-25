import chalk from 'chalk';
import { Command } from 'commander';
import { apiPost } from '../lib/api-client.js';

function detectLinkType(ref: string): string {
  // JIRA-like pattern: PROJECT-123
  if (/^[A-Z][A-Z0-9]+-\d+$/.test(ref)) {
    return 'jira';
  }
  if (ref.includes('github.com')) {
    return 'github';
  }
  if (ref.includes('figma.com')) {
    return 'figma';
  }
  if (ref.includes('linear.app')) {
    return 'linear';
  }
  if (ref.includes('notion.so')) {
    return 'notion';
  }
  return 'other';
}

export const linkCommand = new Command('link')
  .description('Add an external link to a lock')
  .argument('<id>', 'Lock short ID (e.g. l-a7f3e2)')
  .argument('<ref>', 'Link reference (URL or ticket ID)')
  .action(async (id: string, ref: string) => {
    const linkType = detectLinkType(ref);

    try {
      const result = await apiPost<any>(`/api/v1/locks/${id}/link`, {
        link_type: linkType,
        link_ref: ref,
      });

      const link = result.link ?? result;
      console.log(chalk.green.bold('Link added.'));
      console.log(`  ${chalk.dim('Type:')} ${link.link_type ?? linkType}`);
      console.log(`  ${chalk.dim('Ref:')}  ${link.link_ref ?? ref}`);
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
