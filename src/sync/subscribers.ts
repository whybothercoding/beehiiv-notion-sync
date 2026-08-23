import { loadConfig } from '../config';
import { getAllSubscribers } from '../beehiiv/client';
import type { BeehiivSubscriber } from '../beehiiv/types';
import { createNotionClient, createPage, updatePage, fetchExistingIds } from '../notion/client';
import type { SubscriberProperties } from '../notion/types';
import { titleProp, richTextProp, selectProp, multiSelectProp, dateProp } from '../notion/types';
import type { SyncOptions, SyncResult } from './utils';
import { RateLimiter, withRetry, createSpinner } from './utils';
import { loadSyncState, saveSyncState, hashProperties } from './state';

export function mapSubscriberToNotion(sub: BeehiivSubscriber): SubscriberProperties {
  return {
    Email: titleProp(sub.email),
    Status: selectProp(sub.status),
    SubscribedAt: dateProp(sub.created),
    Tier: selectProp(sub.subscription_tier),
    UtmSource: richTextProp(sub.utm_source ?? ''),
    UtmMedium: richTextProp(sub.utm_medium ?? ''),
    UtmCampaign: richTextProp(sub.utm_campaign ?? ''),
    Tags: multiSelectProp(sub.tags ?? []),
    BeehiivId: richTextProp(sub.id),
  };
}

export async function syncSubscribers(options: SyncOptions = {}): Promise<SyncResult> {
  const config = loadConfig();
  const notion = createNotionClient(config.notionApiKey);
  const limiter = new RateLimiter(
    options.concurrency ?? config.notionConcurrency,
    options.rateLimitMs ?? config.notionRateLimitMs
  );

  const spinner = createSpinner('Fetching subscribers from Beehiiv...', options.quiet);
  const subscribers = await getAllSubscribers(config.beehiivApiKey, config.beehiivPublicationId);

  if (options.dryRun) {
    spinner.succeed(`[dry-run] Would sync ${subscribers.length} subscribers (no writes performed)`);
    return { created: 0, updated: 0, skipped: 0, failed: 0 };
  }

  spinner.text = 'Loading existing Notion subscriber records...';
  const existingIds = await fetchExistingIds(notion, config.notionSubscribersDbId, 'BeehiivId');
  const state = await loadSyncState(config.syncStateFilePath);
  spinner.text = `Syncing ${subscribers.length} subscribers to Notion...`;

  let created = 0,
    updated = 0,
    skipped = 0,
    failed = 0;

  const tasks = subscribers.map((sub, i) =>
    limiter.execute(() =>
      withRetry(
        async () => {
          const properties = mapSubscriberToNotion(sub);
          const hash = hashProperties(properties);
          const existingPageId = existingIds.get(sub.id);

          // Unchanged since last sync — skip the (rate-limited) Notion write
          // entirely rather than re-sending identical properties.
          if (!options.force && existingPageId && state.subscribers[sub.id] === hash) {
            skipped++;
          } else if (existingPageId) {
            await updatePage(notion, existingPageId, properties);
            state.subscribers[sub.id] = hash;
            updated++;
          } else {
            await createPage(notion, config.notionSubscribersDbId, properties);
            state.subscribers[sub.id] = hash;
            created++;
          }
          spinner.text = `Syncing subscribers: ${i + 1}/${subscribers.length} (${created} created, ${updated} updated, ${skipped} skipped)`;
        },
        3,
        1000
      ).catch((err: Error) => {
        failed++;
        spinner.warn(`Failed to sync subscriber ${sub.email}: ${err.message}`);
      })
    )
  );

  await Promise.all(tasks);
  await saveSyncState(config.syncStateFilePath, state);
  spinner.succeed(
    `Subscribers sync complete: ${created} created, ${updated} updated, ${skipped} skipped, ${failed} failed`
  );
  return { created, updated, skipped, failed };
}
