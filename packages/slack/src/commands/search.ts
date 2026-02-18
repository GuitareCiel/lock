import type { ParsedCommand } from '../types.js';
import { formatLockList, formatError } from '../lib/formatters.js';

/**
 * Handle `@lock search "query"`.
 *
 * Performs a semantic search across locks using POST /api/v1/locks/search.
 * Optionally filters by product and feature via flags.
 */
export async function handleSearch(
  command: ParsedCommand,
  callApi: Function,
): Promise<any[]> {
  const query = command.message;

  if (!query || query.trim().length === 0) {
    return formatError(
      'EMPTY_QUERY',
      'Please provide a search query.\nUsage: `@lock search "margin calculation approach"`',
    );
  }

  const body: any = {
    query,
  };

  if (command.flags.product) {
    body.product = command.flags.product;
  }
  if (command.flags.feature) {
    body.feature = command.flags.feature;
  }

  try {
    const response = await callApi('POST', '/api/v1/locks/search', body);

    if (response.error) {
      return formatError(response.error.code || 'SEARCH_FAILED', response.error.message);
    }

    const locks = response.data?.locks || response.locks || response.data || [];
    const results = Array.isArray(locks) ? locks : [];

    if (results.length === 0) {
      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:mag: No locks found matching "${query}".`,
          },
        },
      ];
    }

    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:mag: *Search results for* "${query}"`,
        },
      },
      { type: 'divider' },
      ...formatLockList(results).slice(2), // Skip the header from formatLockList
    ];
  } catch (err: any) {
    return formatError('SEARCH_FAILED', err.message || 'Failed to search locks.');
  }
}
