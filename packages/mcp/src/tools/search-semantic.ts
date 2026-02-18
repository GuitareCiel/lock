import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiPost } from '../lib/api-client.js';
import type { Lock } from '../lib/types.js';

export function registerSearchSemantic(server: McpServer): void {
  server.tool(
    'lock_search_semantic',
    'Semantic search across locks using natural language query. Finds decisions similar in meaning to the query.',
    {
      query: z.string().describe('Natural language search query'),
      product: z.string().optional().describe('Product slug to scope the search to'),
      feature: z.string().optional().describe('Feature slug to scope the search to'),
    },
    async ({ query, product, feature }) => {
      try {
        const body: Record<string, string> = { query };
        if (product) body.product = product;
        if (feature) body.feature = feature;

        const result = await apiPost<{ locks: Lock[] }>('/api/v1/locks/search', body);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ locks: result.locks }, null, 2),
            },
          ],
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
