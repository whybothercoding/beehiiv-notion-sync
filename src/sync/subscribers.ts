import ora from 'ora';
import { loadConfig } from '../config';
import { getAllSubscribers } from '../beehiiv/client';
import { BeehiivSubscriber } from '../beehiiv/types';
import { upsertByExternalId, createNotionClient } from '../notion/client';
import {
  titleProp,
  richTextProp,
  selectProp,
  multiSelectProp,
  dateProp,
  SubscriberProperties,
} from '../notion/types';
import { RateLimiter, withRetry } from './utils';

export function mapSubscriberToNotion(sub: BeehiivSubscriber): SubscriberProperties {
  return {
    Email: titleProp(sub.email),
    Status: selectProp(sub.status),
    SubscribedAt: dateProp(sub.created_at),
    Tier: selectProp(sub.subscription_tier),
    UtmSource: richTextProp(sub.utm_source ?? ''),
    UtmMedium: richTextProp(sub.utm_medium ?? ''),
    UtmCampaign: richTextProp(sub.utm_campaign ?? ''),
    Tags: multiSelectProp(sub.tags ?? []),
    BeehiivId: richTextProp(sub.id),
  };
}

export async function syncSubscribers(): Promise<{
  created: number;
  updated: number;
  failed: number;
}> {
  const config = loadConfig();
  const notion = createNotionClient(config.notionApiKey);
  const limiter = new RateLimiter(3, 350);

  const spinner = ora('Fetching subscribers from Beehiiv...').start();
  const subscribers = await getAllSubscribers(
    config.beehiivApiKey,
    config.beehiivPublicationId
  );
  spinner.text = `Syncing ${subscribers.length} subscribers to Notion...`;

  let created = 0;
  let updated = 0;
  let failed = 0;

  const tasks = subscribers.map((sub, i) =>
    limiter.execute(() =>
      withRetry(async () => {
        const properties = mapSubscriberToNotion(sub);
        const result = await upsertByExternalId(
          notion,
          config.notionSubscribersDbId,
          'BeehiivId',
          sub.id,
          properties as unknown as Record<string, unknown>
        );
        if (result === 'created') created++;
        else updated++;
        spinner.text = `Syncing subscribers: ${i + 1}/${subscribers.length} (${created} created, ${updated} updated)`;
      }, 3, 1000).catch(() => {
        failed++;
      })
    )
  );

  await Promise.all(tasks);

  spinner.succeed(
    `Subscribers sync complete: ${created} created, ${updated} updated, ${failed} failed`
  );

  return { created, updated, failed };
}
