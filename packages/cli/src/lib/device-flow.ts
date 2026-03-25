import { execSync } from 'node:child_process';
import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import type { Credentials } from '../types.js';
import { saveCredentials } from './credentials.js';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function copyToClipboard(text: string): boolean {
  try {
    if (process.platform === 'darwin') {
      execSync('pbcopy', { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
    } else if (process.platform === 'win32') {
      execSync('clip', { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
    } else {
      execSync('xclip -selection clipboard', { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
    }
    return true;
  } catch {
    return false;
  }
}

export async function deviceFlowLogin(apiUrl: string): Promise<void> {
  // Step 1: Initiate device flow
  console.log(chalk.dim('Starting browser login...'));

  let initResponse: Response;
  try {
    initResponse = await fetch(`${apiUrl}/auth/cli/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  } catch (err: any) {
    const code = err.code || err.cause?.code;
    if (
      code === 'ECONNREFUSED' ||
      code === 'ENOTFOUND' ||
      code === 'UND_ERR_CONNECT_TIMEOUT' ||
      err.message?.includes('fetch failed')
    ) {
      console.error(chalk.red(`Cannot reach server at ${apiUrl}`));
      console.error(chalk.dim('Is the Lock API running? Use --url to specify a different server.'));
      process.exit(1);
    }
    throw err;
  }

  if (!initResponse.ok) {
    console.error(chalk.red(`Server returned ${initResponse.status} during device flow initiation.`));
    process.exit(1);
  }

  const initJson = (await initResponse.json()) as {
    data?: any;
    device_code?: string;
    verification_uri?: string;
    user_code?: string;
  };
  const initData = initJson.data ?? initJson;
  const { device_code, verification_uri, user_code } = initData as {
    device_code: string;
    verification_uri: string;
    user_code: string;
  };

  // Step 2: Open browser
  const browserUrl = `${verification_uri}?code=${user_code}`;
  let browserOpened = false;
  try {
    const open = (await import('open')).default;
    await open(browserUrl);
    browserOpened = true;
  } catch {
    // Browser failed to open
  }

  console.log('');
  if (browserOpened) {
    console.log('A browser window should have opened. If not, open this URL:');
    console.log(`  ${chalk.cyan(browserUrl)}`);
  } else {
    const copied = copyToClipboard(browserUrl);
    console.log(`Open this URL in your browser:`);
    console.log(`  ${chalk.cyan(browserUrl)}`);
    if (copied) {
      console.log(chalk.dim('  (copied to clipboard)'));
    }
  }
  console.log('');
  console.log(`Your code: ${chalk.bold.cyan(user_code)}`);
  console.log('');

  // Step 3: Poll for tokens with spinner
  interface TokenResponse {
    access_token: string;
    refresh_token: string;
    workspaces: Array<{ id: string; name: string }>;
  }

  let frameIndex = 0;
  const spinner = setInterval(() => {
    const frame = SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length];
    process.stdout.write(`\r${chalk.cyan(frame)} Waiting for approval in your browser...`);
    frameIndex++;
  }, 80);

  const tokens = await (async (): Promise<TokenResponse> => {
    try {
      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const pollResponse = await fetch(`${apiUrl}/auth/cli/poll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_code }),
        });

        if (pollResponse.status === 428) {
          continue;
        }

        if (pollResponse.status === 410) {
          clearInterval(spinner);
          process.stdout.write('\r\x1b[K');
          console.error(chalk.red('Login expired. Please try again.'));
          process.exit(1);
        }

        if (pollResponse.ok) {
          const pollJson = (await pollResponse.json()) as { data?: any };
          return (pollJson.data ?? pollJson) as TokenResponse;
        }

        clearInterval(spinner);
        process.stdout.write('\r\x1b[K');
        console.error(chalk.red(`Unexpected response: ${pollResponse.status}`));
        process.exit(1);
      }
    } catch (err) {
      clearInterval(spinner);
      process.stdout.write('\r\x1b[K');
      throw err;
    }
  })();

  clearInterval(spinner);
  process.stdout.write('\r\x1b[K');

  // Step 4: Select workspace if multiple
  let workspaceId: string | undefined;
  if (tokens.workspaces && tokens.workspaces.length > 1) {
    workspaceId = await select({
      message: 'Select a workspace:',
      choices: tokens.workspaces.map((ws: { id: string; name: string }) => ({
        name: ws.name,
        value: ws.id,
      })),
    });
  } else if (tokens.workspaces && tokens.workspaces.length === 1) {
    workspaceId = tokens.workspaces[0].id;
  }

  // Step 5: Fetch user info
  let email: string | undefined;
  let name: string | undefined;
  try {
    const meResponse = await fetch(`${apiUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (meResponse.ok) {
      const meJson = (await meResponse.json()) as { data?: any };
      const meData = meJson.data ?? meJson;
      email = meData.user?.email;
      name = meData.user?.name;
    }
  } catch {
    // Non-critical — continue without user info
  }

  // Step 6: Save credentials
  const creds: Credentials = {
    api_url: apiUrl,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    workspace_id: workspaceId,
    email,
    name,
  };
  await saveCredentials(creds);

  console.log(chalk.green('Logged in successfully.'));
  if (name || email) {
    console.log(`  ${chalk.dim('Account:')} ${name ?? email}`);
    if (name && email) {
      console.log(`  ${chalk.dim('Email:')}   ${email}`);
    }
  }
  console.log(`  ${chalk.dim('API URL:')} ${apiUrl}`);
  if (workspaceId) {
    const ws = tokens.workspaces?.find((w: { id: string; name: string }) => w.id === workspaceId);
    console.log(`  ${chalk.dim('Workspace:')} ${ws?.name ?? workspaceId}`);
  }
  console.log('');
  console.log(chalk.dim('Credentials saved to ~/.lock/credentials'));
}
