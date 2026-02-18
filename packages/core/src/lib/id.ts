import crypto from 'crypto';

export function generateShortId(): string {
  return 'l-' + crypto.randomBytes(3).toString('hex');
}
