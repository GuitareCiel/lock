import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { locks, features } from '../db/schema.js';
import { generateEmbedding } from '../lib/embeddings.js';
import { classifyRelationship } from '../lib/llm.js';
import type { ConflictResult, SupersessionResult } from '../types.js';

export async function detectConflicts(
  lockId: string,
  productId: string,
  message: string,
  scope: string,
  sourceContext: string | null,
  featureName: string
): Promise<{ conflicts: ConflictResult[]; supersession: SupersessionResult }> {
  // Step 1: Generate embedding
  const embedding = await generateEmbedding(message);

  if (!embedding) {
    return { conflicts: [], supersession: { detected: false } };
  }

  // Update the lock with its embedding
  await db.execute(
    sql`UPDATE locks SET embedding = ${`[${embedding.join(',')}]`}::vector WHERE id = ${lockId}::uuid`
  );

  // Step 2: Find similar active locks in the same product
  const candidates = await db.execute(
    sql`SELECT l.*, 1 - (l.embedding <=> ${`[${embedding.join(',')}]`}::vector) as similarity,
               f.slug as feature_slug, f.name as feature_name
        FROM locks l
        JOIN features f ON f.id = l.feature_id
        WHERE l.product_id = ${productId}::uuid
          AND l.status = 'active'
          AND l.id != ${lockId}::uuid
          AND l.embedding IS NOT NULL
        ORDER BY l.embedding <=> ${`[${embedding.join(',')}]`}::vector
        LIMIT 5`
  );

  // Filter to similarity > 0.75
  const similar = (candidates.rows as any[]).filter((r) => r.similarity > 0.75);

  if (similar.length === 0) {
    return { conflicts: [], supersession: { detected: false } };
  }

  // Step 3: Classify relationships via LLM (in parallel)
  const classifications = await Promise.all(
    similar.map(async (candidate) => {
      const result = await classifyRelationship(
        {
          message: candidate.message,
          scope: candidate.scope,
          context: candidate.source_context,
          featureName: candidate.feature_name,
        },
        { message, scope, context: sourceContext, featureName }
      );
      return { candidate, result };
    })
  );

  const conflicts: ConflictResult[] = [];
  let supersession: SupersessionResult = { detected: false };

  for (const { candidate, result } of classifications) {
    if (result.relationship === 'potential_conflict' || result.relationship === 'related') {
      conflicts.push({
        lock: {
          short_id: candidate.short_id,
          message: candidate.message,
          scope: candidate.scope,
          feature: { slug: candidate.feature_slug, name: candidate.feature_name },
          created_at: candidate.created_at,
        },
        relationship: result.relationship,
        explanation: result.explanation,
      });
    } else if (result.relationship === 'supersession' && !supersession.detected) {
      supersession = {
        detected: true,
        supersedes: {
          short_id: candidate.short_id,
          message: candidate.message,
        },
        explanation: result.explanation,
      };
    }
  }

  return { conflicts, supersession };
}
