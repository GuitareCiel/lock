import type { ParsedCommand } from '../types.js';
import { formatSuccess, formatError } from '../lib/formatters.js';

/**
 * Auto-detect the link type from a reference string.
 */
function detectLinkType(ref: string): string {
  // Jira-style ticket IDs: PROJECT-123
  if (/^[A-Z]+-\d+$/i.test(ref)) {
    return 'jira';
  }

  // GitHub URLs
  if (ref.includes('github.com')) {
    return 'github';
  }

  // Figma URLs
  if (ref.includes('figma.com')) {
    return 'figma';
  }

  // Linear URLs or IDs
  if (ref.includes('linear.app') || /^[A-Z]+-[a-z0-9]+$/i.test(ref)) {
    return 'linear';
  }

  // Notion URLs
  if (ref.includes('notion.so') || ref.includes('notion.site')) {
    return 'notion';
  }

  return 'other';
}

/**
 * Handle `@lock link <short_id> <ref>`.
 *
 * Adds an external link to an existing lock. Auto-detects the link type
 * from the reference format.
 */
export async function handleLink(
  command: ParsedCommand,
  callApi: Function,
): Promise<any[]> {
  const shortId = command.args[0];
  const ref = command.args[1];

  if (!shortId || !ref) {
    return formatError(
      'MISSING_ARGS',
      'Please provide both a lock ID and a reference.\nUsage: `@lock link l-a7f3e2 TRADE-442`',
    );
  }

  const linkType = detectLinkType(ref);

  try {
    const response = await callApi('POST', `/api/v1/locks/${shortId}/link`, {
      link_type: linkType,
      link_ref: ref,
    });

    if (response.error) {
      return formatError(response.error.code || 'LINK_FAILED', response.error.message);
    }

    return formatSuccess(
      `Linked \`${shortId}\` to *${ref}* (${linkType}).`,
    );
  } catch (err: any) {
    return formatError('LINK_FAILED', err.message || 'Failed to add link.');
  }
}
