import type { ThreadContext } from '../types.js';

// Simple in-memory cache for user name lookups within a session
const userNameCache = new Map<string, string>();

/**
 * Resolve a Slack user ID to a display name, with caching.
 */
async function resolveUserName(client: any, userId: string): Promise<string> {
  const cached = userNameCache.get(userId);
  if (cached) {
    return cached;
  }

  try {
    const result = await client.users.info({ user: userId });
    const name =
      result.user?.profile?.display_name ||
      result.user?.real_name ||
      result.user?.name ||
      userId;
    userNameCache.set(userId, name);
    return name;
  } catch {
    return userId;
  }
}

/**
 * Retrieve thread context from a Slack thread.
 *
 * Fetches thread replies, resolves participant names, gets the thread
 * permalink, and builds a context snippet from the last 5 messages.
 */
export async function getThreadContext(
  client: any,
  channelId: string,
  threadTs: string,
): Promise<ThreadContext> {
  // Fetch all replies in the thread
  let allMessages: any[] = [];
  try {
    const result = await client.conversations.replies({
      channel: channelId,
      ts: threadTs,
      inclusive: true,
    });
    allMessages = result.messages || [];
  } catch {
    return {
      messages: [],
      participants: [],
      snippet: '',
    };
  }

  // Take the last 5 messages for context
  const recentMessages = allMessages.slice(-5);

  // Resolve user names for all participants
  const participantIds = [...new Set(allMessages.map((m: any) => m.user).filter(Boolean))];
  const participantNames = await Promise.all(
    participantIds.map(async (id: string) => resolveUserName(client, id)),
  );

  // Build message objects with resolved names
  const messages = await Promise.all(
    recentMessages.map(async (m: any) => ({
      userId: m.user || 'unknown',
      text: m.text || '',
      userName: m.user ? await resolveUserName(client, m.user) : undefined,
    })),
  );

  // Build a text snippet from the messages
  const snippet = messages
    .map((m) => `${m.userName || m.userId}: ${m.text}`)
    .join('\n');

  // Get the thread permalink
  let permalink: string | undefined;
  try {
    const result = await client.chat.getPermalink({
      channel: channelId,
      message_ts: threadTs,
    });
    permalink = result.permalink;
  } catch {
    // Permalink is optional — don't fail if we can't get it
  }

  return {
    messages,
    participants: participantNames,
    permalink,
    snippet,
  };
}
