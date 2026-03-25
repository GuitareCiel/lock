import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import chalk from 'chalk';
import type { Credentials } from '../types.js';

const CREDENTIALS_DIR = path.join(os.homedir(), '.lock');
const CREDENTIALS_PATH = path.join(CREDENTIALS_DIR, 'credentials');

export async function getCredentials(): Promise<Credentials> {
  try {
    const raw = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
    const creds = JSON.parse(raw) as Credentials;
    if (creds.api_url && creds.access_token) {
      return creds;
    }
  } catch {
    // Credentials file doesn't exist or is invalid
  }

  console.error(chalk.red('Not logged in. Run `lock login` first.'));
  process.exit(1);
}

export function credentialsExist(): boolean {
  try {
    const raw = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
    const creds = JSON.parse(raw);
    return Boolean(creds.api_url && creds.access_token);
  } catch {
    return false;
  }
}

export function deleteCredentials(): void {
  try {
    fs.unlinkSync(CREDENTIALS_PATH);
  } catch {
    // File doesn't exist — no-op
  }
}

export async function saveCredentials(creds: Credentials): Promise<void> {
  if (!fs.existsSync(CREDENTIALS_DIR)) {
    fs.mkdirSync(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
  }

  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds, null, 2) + '\n', {
    mode: 0o600,
  });
}
