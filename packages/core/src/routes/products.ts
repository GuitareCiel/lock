import { and, eq, inArray, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { channelConfigs, features, knowledge, lockLinks, locks, products } from '../db/schema.js';
import { trackEvent } from '../lib/hooks.js';

export async function productRoutes(fastify: FastifyInstance) {
  // List products with lock counts
  fastify.get('/', async (request) => {
    if (!request.workspaceId) {
      return { data: { products: [] } };
    }
    const rows = await db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        description: products.description,
        createdAt: products.createdAt,
        lockCount: sql<number>`(SELECT COUNT(*) FROM locks WHERE locks.product_id = ${products.id})`.as('lock_count'),
      })
      .from(products)
      .where(eq(products.workspaceId, request.workspaceId));

    return {
      data: {
        products: rows.map((r) => ({
          slug: r.slug,
          name: r.name,
          description: r.description,
          lock_count: Number(r.lockCount),
          created_at: r.createdAt,
        })),
      },
    };
  });

  // Create product
  fastify.post('/', async (request, reply) => {
    if (!request.workspaceId) {
      return reply.status(401).send({
        error: { code: 'NO_WORKSPACE', message: 'No workspace selected' },
      });
    }
    const { slug, name, description } = request.body as {
      slug: string;
      name: string;
      description?: string;
    };

    if (!slug || !name) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'slug and name are required' },
      });
    }

    const existing = await db.query.products.findFirst({
      where: and(eq(products.workspaceId, request.workspaceId), eq(products.slug, slug)),
    });
    if (existing) {
      return reply.status(409).send({
        error: { code: 'PRODUCT_EXISTS', message: `Product "${slug}" already exists` },
      });
    }

    const [product] = await db
      .insert(products)
      .values({ workspaceId: request.workspaceId, slug, name, description })
      .returning();

    trackEvent(request.workspaceId, 'product_created', { slug: product.slug, name: product.name });
    return reply.status(201).send({
      data: {
        slug: product.slug,
        name: product.name,
        description: product.description,
        created_at: product.createdAt,
      },
    });
  });

  // Update product
  fastify.patch('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const { description, name } = request.body as { description?: string; name?: string };

    const product = await db.query.products.findFirst({
      where: and(eq(products.workspaceId, request.workspaceId), eq(products.slug, slug)),
    });
    if (!product) {
      return reply.status(404).send({
        error: { code: 'PRODUCT_NOT_FOUND', message: `Product "${slug}" not found` },
      });
    }

    const updates: any = {};
    if (description !== undefined) updates.description = description;
    if (name !== undefined) updates.name = name;

    const [updated] = await db.update(products).set(updates).where(eq(products.id, product.id)).returning();

    return {
      data: {
        slug: updated.slug,
        name: updated.name,
        description: updated.description,
        created_at: updated.createdAt,
      },
    };
  });

  // Delete product (cascades: features, locks, channel configs, knowledge)
  fastify.delete('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };

    const product = await db.query.products.findFirst({
      where: and(eq(products.workspaceId, request.workspaceId), eq(products.slug, slug)),
    });
    if (!product) {
      return reply.status(404).send({
        error: { code: 'PRODUCT_NOT_FOUND', message: `Product "${slug}" not found` },
      });
    }

    // Clear references from OTHER locks pointing to locks in this product
    await db.execute(sql`UPDATE locks SET supersedes_id = NULL WHERE supersedes_id IN (SELECT id FROM locks WHERE product_id = ${product.id})`);
    await db.execute(sql`UPDATE locks SET superseded_by_id = NULL WHERE superseded_by_id IN (SELECT id FROM locks WHERE product_id = ${product.id})`);
    await db.execute(sql`UPDATE locks SET reverted_by_id = NULL WHERE reverted_by_id IN (SELECT id FROM locks WHERE product_id = ${product.id})`);

    // Delete lock links
    await db.execute(sql`DELETE FROM lock_links WHERE lock_id IN (SELECT id FROM locks WHERE product_id = ${product.id})`);

    // Clear self-referential FKs then delete locks
    await db.execute(sql`UPDATE locks SET supersedes_id = NULL, superseded_by_id = NULL, reverted_by_id = NULL WHERE product_id = ${product.id}`);
    await db.execute(sql`DELETE FROM locks WHERE product_id = ${product.id}`);

    // Delete related data
    await db.execute(sql`DELETE FROM channel_configs WHERE product_id = ${product.id}`);
    await db.execute(sql`DELETE FROM knowledge WHERE product_id = ${product.id}`);
    await db.execute(sql`DELETE FROM features WHERE product_id = ${product.id}`);

    // Delete product
    await db.execute(sql`DELETE FROM products WHERE id = ${product.id}`);

    trackEvent(request.workspaceId, 'product_deleted', { slug });
    return { data: { ok: true } };
  });
}
