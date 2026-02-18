import type { ParsedCommand } from '../types.js';
import { formatFeatureList, formatError } from '../lib/formatters.js';

/**
 * Handle `@lock features` — list features, optionally filtered by product.
 */
export async function handleFeatures(
  command: ParsedCommand,
  callApi: Function,
): Promise<any[]> {
  const params = new URLSearchParams();

  if (command.flags.product) {
    params.set('product', command.flags.product);
  }

  const queryString = params.toString();
  const path = `/api/v1/features${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await callApi('GET', path);

    if (response.error) {
      return formatError(response.error.code || 'FEATURES_FAILED', response.error.message);
    }

    const features = response.data?.features || response.features || response.data || [];
    return formatFeatureList(Array.isArray(features) ? features : []);
  } catch (err: any) {
    return formatError('FEATURES_FAILED', err.message || 'Failed to fetch features.');
  }
}
