import { formatError, formatLockCommit } from '../lib/formatters.js';
import type { ParsedCommand } from '../types.js';

/**
 * Handle `@lock revert <short_id> "reason"`.
 *
 * Posts to POST /api/v1/locks/:shortId/revert with the reason
 * and author information.
 */
export async function handleRevert(
  command: ParsedCommand,
  userId: string,
  userName: string,
  callApi: Function,
): Promise<any[]> {
  const shortId = command.args[0];

  if (!shortId) {
    return formatError(
      'MISSING_LOCK_ID',
      'Please provide the lock ID to revert.\nUsage: `@lock revert l-a7f3e2 "reason for reverting"`',
    );
  }

  const reason = command.message || 'Reverted via Slack';

  try {
    const response = await callApi('POST', `/api/v1/locks/${shortId}/revert`, {
      message: reason,
      author: {
        type: 'human',
        id: userId,
        name: userName,
        source: 'slack',
      },
    });

    if (response.error) {
      return formatError(response.error.code || 'REVERT_FAILED', response.error.message);
    }

    const data = response.data || response;
    return formatLockCommit(data);
  } catch (err: any) {
    return formatError('REVERT_FAILED', err.message || 'Failed to revert lock.');
  }
}
