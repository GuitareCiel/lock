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

  if (!product) {
    return formatError(
      'MISSING_FLAGS',
      '`--product` is required.\nUsage: `@lock init --product <product-slug>` or `@lock init --product <product-slug> --feature <feature-slug>`',
    );
  }

  try {
    const body: Record<string, string> = {
      slack_channel_id: channelId,
      product,
    };
    if (feature) body.feature = feature;

    const response = await callApi('POST', '/api/v1/channel-configs', body);

    if (response.error) {
      return formatError(response.error.code || 'INIT_FAILED', response.error.message);
    }

    const featureLabel = feature || 'main';
    return formatSuccess(
      `Channel linked to *${product}* / *${featureLabel}*.\nAll locks in this channel will be scoped to this product and feature.`,
    );
  } catch (err: any) {
    return formatError('INIT_FAILED', err.message || 'Failed to initialize channel configuration.');
  }
}
