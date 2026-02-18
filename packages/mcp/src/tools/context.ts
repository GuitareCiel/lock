import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet } from '../lib/api-client.js';
import type { Lock } from '../lib/types.js';

const SCOPE_WEIGHT: Record<string, number> = {
  architectural: 0,
  major: 1,
  minor: 2,
};

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

function formatContext(locks: Lock[], product?: string): string {
  if (locks.length === 0) {
    return product
      ? `No active decisions found for product: ${product}`
      : 'No active decisions found.';
  }

  // Group by feature
  const byFeature = new Map<string, { name: string; locks: Lock[] }>();
  for (const lock of locks) {
    const key = lock.feature.slug;
    if (!byFeature.has(key)) {
      byFeature.set(key, { name: lock.feature.name, locks: [] });
    }
    byFeature.get(key)!.locks.push(lock);
  }

  // Sort locks within each feature by scope weight
  for (const group of byFeature.values()) {
    group.locks.sort(
      (a, b) => (SCOPE_WEIGHT[a.scope] ?? 2) - (SCOPE_WEIGHT[b.scope] ?? 2),
    );
  }

  const productName = locks[0].product.name;
  const featureCount = byFeature.size;
  const today = new Date().toISOString().slice(0, 10);

  const lines: string[] = [];
  lines.push(`# Active Decisions — ${productName}`);
  lines.push(
    `Generated: ${today} | ${locks.length} decisions across ${featureCount} feature${featureCount === 1 ? '' : 's'}`,
  );

  for (const [slug, group] of byFeature) {
    lines.push('');
    lines.push(`## ${slug} (${group.name})`);
    lines.push('');
    for (const lock of group.locks) {
      lines.push(
        `[${lock.scope}] ${lock.short_id}: ${lock.message} (${lock.author.name}, ${formatDate(lock.created_at)})`,
      );
    }
  }

  return lines.join('\n');
}

export function registerContext(server: McpServer): void {
  server.tool(
    'lock_context',
    'Returns all active decisions for a product as formatted text. Use this to understand what decisions have been made before building.',
    {
      product: z.string().optional().describe('Product slug to filter by'),
      feature: z.string().optional().describe('Feature slug to filter by'),
    },
    async ({ product, feature }) => {
      try {
        const params = new URLSearchParams();
        params.set('status', 'active');
        params.set('limit', '100');
        if (product) params.set('product', product);
        if (feature) params.set('feature', feature);

        const result = await apiGet<{ locks: Lock[] }>(
          `/api/v1/locks?${params.toString()}`,
        );
        const text = formatContext(result.locks ?? [], product);
        return {
          content: [{ type: 'text' as const, text }],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
