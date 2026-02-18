import type { ParsedCommand } from '../types.js';
import { getThreadContext } from '../lib/thread-context.js';
import { formatLockCommit, formatError } from '../lib/formatters.js';

interface LockContext {
  channelId: string;
  userId: string;
  userName: string;
  teamId: string;
  threadTs?: string;
  client: any;
  callApi: Function;
}

/**
 * Handle `@lock <message>` — commit a new decision lock.
 *
 * Builds the POST /api/v1/locks request body with:
 * - Channel config for product/feature context
 * - Thread context if the command was used in a thread
 * - Author info from the Slack user
 * - Flags (scope, ticket as jira link, tags)
 */
export async function handleLock(
  command: ParsedCommand,
  context: LockContext,
): Promise<any[]> {
  const { channelId, userId, userName, teamId, threadTs, client, callApi } = context;

  if (!command.message || command.message.trim().length === 0) {
    return formatError(
      'EMPTY_MESSAGE',
      'Please provide a decision message.\nUsage: `@lock Use notional value instead of margin --scope major`',
    );
  }

  // Get channel config for product/feature
  let channelConfig: any;
  try {
    const configResponse = await callApi('GET', `/api/v1/channel-configs/${channelId}`);
    if (configResponse.error) {
      return formatError(
        'CHANNEL_NOT_CONFIGURED',
        'This channel is not linked to a product and feature.\nRun `@lock init --product <product> --feature <feature>` first.',
      );
    }
    channelConfig = configResponse.data || configResponse;
  } catch {
    return formatError(
      'CHANNEL_NOT_CONFIGURED',
      'This channel is not linked to a product and feature.\nRun `@lock init --product <product> --feature <feature>` first.',
    );
  }

  // Get thread context if in a thread
  let threadContext: any = null;
  if (threadTs) {
    try {
      threadContext = await getThreadContext(client, channelId, threadTs);
    } catch {
      // Thread context is optional — proceed without it
    }
  }

  // Build the request body
  const body: any = {
    message: command.message,
    product: channelConfig.product?.slug || channelConfig.product,
    feature: channelConfig.feature?.slug || channelConfig.feature,
    author: {
      type: 'human' as const,
      id: userId,
      name: userName,
      source: 'slack' as const,
    },
    source: {
      type: 'slack' as const,
      ref: threadContext?.permalink || undefined,
      context: threadContext?.snippet || undefined,
      participants: threadContext?.participants || [userName],
    },
  };

  // Apply flags
  if (command.flags.scope) {
    body.scope = command.flags.scope;
  }

  if (command.flags.tags.length > 0) {
    body.tags = command.flags.tags;
  }

  // Ticket flag creates a jira link
  if (command.flags.ticket) {
    body.links = [{ type: 'jira', ref: command.flags.ticket }];
  }

  try {
    const response = await callApi('POST', '/api/v1/locks', body);

    if (response.error) {
      return formatError(response.error.code || 'LOCK_FAILED', response.error.message);
    }

    const data = response.data || response;
    return formatLockCommit(data);
  } catch (err: any) {
    return formatError('LOCK_FAILED', err.message || 'Failed to commit lock.');
  }
}
