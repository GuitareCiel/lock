import { formatError, formatProductList } from '../lib/formatters.js';
import type { ParsedCommand } from '../types.js';

/**
 * Handle `@lock products` — list all products with lock counts.
 */
export async function handleProducts(_command: ParsedCommand, callApi: Function): Promise<any[]> {
  try {
    const response = await callApi('GET', '/api/v1/products');

    if (response.error) {
      return formatError(response.error.code || 'PRODUCTS_FAILED', response.error.message);
    }

    const products = response.data?.products || response.products || response.data || [];
    return formatProductList(Array.isArray(products) ? products : []);
  } catch (err: any) {
    return formatError('PRODUCTS_FAILED', err.message || 'Failed to fetch products.');
  }
}
