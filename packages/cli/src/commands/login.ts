import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { Command } from 'commander';
import { credentialsExist, getCredentials } from '../lib/credentials.js';

const API_URL = 'https://api.uselock.ai';

async function loadDeviceFlow(): Promise<(apiUrl: string) => Promise<void>> {
  try {
    const mod = await import('../lib/device-flow.js');
    return mod.deviceFlowLogin;
  } catch {
    console.error(chalk.red('Browser login is not available in this distribution.'));
    console.error(chalk.dim('Use the hosted CLI: npm install -g @uselock/cli'));
    process.exit(1);
  }
}

export const loginCommand = new Command('login')
  .description('Login to Lock via browser')
  .action(async () => {
    try {
      // Check if already logged in
      if (credentialsExist()) {
        const existing = await getCredentials();
        console.log(chalk.yellow(`Already logged in to ${existing.api_url}`));

        const overwrite = await confirm({
          message: 'Overwrite existing credentials?',
          default: false,
        });
        if (!overwrite) {
          console.log(chalk.dim('Login cancelled.'));
          return;
        }
      }

      const deviceFlowLogin = await loadDeviceFlow();
      await deviceFlowLogin(API_URL);
    } catch (err: any) {
      if (err.name === 'ExitPromptError') {
        console.log(chalk.dim('Login cancelled.'));
        return;
      }
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
