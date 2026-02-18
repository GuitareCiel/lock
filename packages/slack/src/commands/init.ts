import type { ParsedCommand } from '../types.js';
import { formatError, formatSuccess } from '../lib/formatters.js';

/**
 * Handle `@lock init --product <p> --feature <f>`.
 *
 * Maps the current Slack channel to a product and feature so that
 * subsequent `@lock <message>` commands in this channel automatically
 * use that product/feature context.
 */
export async function handleInit(
  command: ParsedCommand,
  channelId: string,
  callApi: Function,
): Promise<any[]> {
  const { product, feature } = command.flags;

  if (!product || !feature) {
    return formatError(
      'MISSING_FLAGS',
      'Both `--product` and `--feature` are required.\nUsage: `@lock init --product <product-slug> --feature <feature-slug>`',
    );
  }

  try {
    const response = await callApi('POST', '/api/v1/channel-configs', {
      slack_channel_id: channelId,
      product,
      feature,
    });

    if (response.error) {
      return formatError(response.error.code || 'INIT_FAILED', response.error.message);
    }

    return formatSuccess(
      `Channel linked to *${product}* / *${feature}*.\nAll locks in this channel will be scoped to this product and feature.`,
    );
  } catch (err: any) {
    return formatError('INIT_FAILED', err.message || 'Failed to initialize channel configuration.');
  }
}
