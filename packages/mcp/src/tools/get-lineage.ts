import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet } from '../lib/api-client.js';
import type { Lock } from '../lib/types.js';

export function registerGetLineage(server: McpServer): void {
  server.tool(
    'lock_get_lineage',
    'Get the full lineage chain (supersession/revert history) of a lock',
    {
      lock_id: z.string().describe('The short ID (e.g. "l-a7f3e2") or UUID of the lock'),
    },
    async ({ lock_id }) => {
      try {
        const result = await apiGet<{ chain: Lock[] }>(
          `/api/v1/locks/${encodeURIComponent(lock_id)}/lineage`,
        );
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ chain: result.chain }, null, 2),
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
