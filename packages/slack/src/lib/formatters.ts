/**
 * Block Kit formatters for Slack responses.
 *
 * Each function returns an array of Slack Block Kit blocks
 * suitable for use with `blocks` in Slack API responses.
 */

/**
 * Format a committed lock with conflicts and supersession info.
 */
export function formatLockCommit(data: any): any[] {
  const { lock, conflicts, supersession } = data;
  const blocks: any[] = [];

  // Main lock block
  const scopeEmoji =
    lock.scope === 'architectural' ? ':rotating_light:' :
    lock.scope === 'major' ? ':large_orange_diamond:' :
    ':small_blue_diamond:';

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `:lock: *Lock committed* \`${lock.short_id}\`\n${scopeEmoji} *${lock.scope}* | ${lock.product?.name || lock.product?.slug || 'unknown'} / ${lock.feature?.name || lock.feature?.slug || 'unknown'}`,
    },
  });

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `> ${lock.message}`,
    },
  });

  // Author and timestamp
  const authorSource = lock.author?.source || lock.author_source || 'unknown';
  const authorName = lock.author?.name || lock.author_name || 'unknown';
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `By *${authorName}* via ${authorSource} | ${new Date(lock.created_at).toLocaleString()}`,
      },
    ],
  });

  // Tags
  if (lock.tags && lock.tags.length > 0) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Tags: ${lock.tags.map((t: string) => `\`${t}\``).join(' ')}`,
        },
      ],
    });
  }

  // Supersession info
  if (supersession?.detected) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:arrows_counterclockwise: *Supersedes* \`${supersession.supersedes.short_id}\`\n> ${supersession.supersedes.message}\n_${supersession.explanation}_`,
      },
    });
  }

  // Conflicts
  if (conflicts && conflicts.length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:warning: *Potential conflicts detected* (${conflicts.length})`,
      },
    });

    for (const conflict of conflicts) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `\`${conflict.lock.short_id}\` — ${conflict.lock.message}\n_${conflict.explanation}_`,
        },
      });
    }
  }

  return blocks;
}

/**
 * Format a list of locks for display.
 */
export function formatLockList(locks: any[]): any[] {
  const blocks: any[] = [];

  if (locks.length === 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ':mag: No locks found matching your filters.',
      },
    });
    return blocks;
  }

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `:lock: *${locks.length} lock${locks.length === 1 ? '' : 's'} found*`,
    },
  });

  blocks.push({ type: 'divider' });

  for (const lock of locks) {
    const scopeEmoji =
      lock.scope === 'architectural' ? ':rotating_light:' :
      lock.scope === 'major' ? ':large_orange_diamond:' :
      ':small_blue_diamond:';

    const statusBadge =
      lock.status === 'active' ? '' :
      lock.status === 'superseded' ? ' ~superseded~' :
      lock.status === 'reverted' ? ' ~reverted~' :
      ` _(${lock.status})_`;

    const productSlug = lock.product?.slug || lock.product || '';
    const featureSlug = lock.feature?.slug || lock.feature || '';
    const scope = `${productSlug}/${featureSlug}`;

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${scopeEmoji} \`${lock.short_id}\` ${lock.message}${statusBadge}\n_${scope} | ${lock.author?.name || lock.author_name || 'unknown'} | ${new Date(lock.created_at).toLocaleDateString()}_`,
      },
    });
  }

  return blocks;
}

/**
 * Format a list of products with lock counts.
 */
export function formatProductList(products: any[]): any[] {
  const blocks: any[] = [];

  if (products.length === 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ':package: No products found. Create one with `@lock init --product <name> --feature <name>`.',
      },
    });
    return blocks;
  }

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `:package: *${products.length} product${products.length === 1 ? '' : 's'}*`,
    },
  });

  blocks.push({ type: 'divider' });

  for (const product of products) {
    const lockCount = product.lock_count ?? product.lockCount ?? 0;
    const description = product.description ? `\n_${product.description}_` : '';
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${product.name}* (\`${product.slug}\`) — ${lockCount} lock${lockCount === 1 ? '' : 's'}${description}`,
      },
    });
  }

  return blocks;
}

/**
 * Format a list of features.
 */
export function formatFeatureList(features: any[]): any[] {
  const blocks: any[] = [];

  if (features.length === 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ':clipboard: No features found. Create one with `@lock init --product <name> --feature <name>`.',
      },
    });
    return blocks;
  }

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `:clipboard: *${features.length} feature${features.length === 1 ? '' : 's'}*`,
    },
  });

  blocks.push({ type: 'divider' });

  for (const feature of features) {
    const productSlug = feature.product?.slug || feature.product_slug || '';
    const lockCount = feature.lock_count ?? feature.lockCount ?? 0;
    const description = feature.description ? `\n_${feature.description}_` : '';
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${feature.name}* (\`${productSlug}/${feature.slug}\`) — ${lockCount} lock${lockCount === 1 ? '' : 's'}${description}`,
      },
    });
  }

  return blocks;
}

/**
 * Format an error response.
 */
export function formatError(code: string, message: string): any[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:x: *Error* — \`${code}\`\n${message}`,
      },
    },
  ];
}

/**
 * Format a success message.
 */
export function formatSuccess(message: string): any[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:white_check_mark: ${message}`,
      },
    },
  ];
}
