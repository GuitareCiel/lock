import { WebClient } from '@slack/web-api';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { channelConfigs } from '../db/schema.js';

let slackClient: WebClient | null = null;

function getSlackClient(): WebClient | null {
  if (!process.env.SLACK_BOT_TOKEN) return null;
  if (!slackClient) {
    slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
  }
  return slackClient;
}

export async function notifySlack(lock: {
  shortId: string;
  message: string;
  authorName: string;
  authorSource: string;
  featureId: string;
}): Promise<void> {
  const client = getSlackClient();
  if (!client) return;

  const config = await db.query.channelConfigs.findFirst({
    where: eq(channelConfigs.featureId, lock.featureId),
  });

  if (!config) return;

  await client.chat.postMessage({
    channel: config.slackChannelId,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🔒 *New lock from ${lock.authorSource}* (\`${lock.shortId}\`)\n> "${lock.message}"\n_Author: ${lock.authorName} via ${lock.authorSource}_`,
        },
      },
    ],
    text: `New lock: ${lock.message}`,
  });
}
