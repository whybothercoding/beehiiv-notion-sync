import { loadConfig } from '../config';
import { getAllPosts } from '../beehiiv/client';
import type { BeehiivPost } from '../beehiiv/types';
import { createNotionClient, createPage, updatePage, fetchExistingIds } from '../notion/client';
import type { PostProperties } from '../notion/types';
import {
  titleProp,
  richTextProp,
  selectProp,
  dateProp,
  urlProp,
  numberProp,
} from '../notion/types';
import type { SyncOptions, SyncResult } from './utils';
import { RateLimiter, withRetry, createSpinner } from './utils';
import { loadSyncState, saveSyncState, hashProperties } from './state';

export function mapPostToNotion(post: BeehiivPost): PostProperties {
  const email = post.stats?.email;
  const web = post.stats?.web;
  return {
    Title: titleProp(post.title),
    Subtitle: richTextProp(post.subtitle ?? ''),
    Status: selectProp(post.status),
    PublishDate: dateProp(post.publish_date),
    WebUrl: urlProp(post.web_url),
    TotalSent: numberProp(email?.recipients),
    Opens: numberProp(email?.opens),
    OpenRate: numberProp(email?.open_rate),
    Clicks: numberProp(email?.clicks),
    ClickRate: numberProp(email?.click_rate),
    Unsubscribes: numberProp(email?.unsubscribes),
    WebViews: numberProp(web?.views),
    WebClicks: numberProp(web?.clicks),
    BeehiivPostId: richTextProp(post.id),
  };
}

export async function syncPosts(options: SyncOptions = {}): Promise<SyncResult> {
  const config = loadConfig();
  const notion = createNotionClient(config.notionApiKey);
  const limiter = new RateLimiter(
    options.concurrency ?? config.notionConcurrency,
    options.rateLimitMs ?? config.notionRateLimitMs
  );

  const spinner = createSpinner('Fetching posts from Beehiiv...', options.quiet);
  const posts = await getAllPosts(config.beehiivApiKey, config.beehiivPublicationId);

  if (options.dryRun) {
    spinner.succeed(`[dry-run] Would sync ${posts.length} posts (no writes performed)`);
    return { created: 0, updated: 0, skipped: 0, failed: 0 };
  }

  spinner.text = 'Loading existing Notion post records...';
  const existingIds = await fetchExistingIds(notion, config.notionPostsDbId, 'BeehiivPostId');
  const state = await loadSyncState(config.syncStateFilePath);
  spinner.text = `Syncing ${posts.length} posts to Notion...`;

  let created = 0,
    updated = 0,
    skipped = 0,
    failed = 0;

  const tasks = posts.map((post, i) =>
    limiter.execute(() =>
      withRetry(
        async () => {
          const properties = mapPostToNotion(post);
          const hash = hashProperties(properties);
          const existingPageId = existingIds.get(post.id);

          // Unchanged since last sync — skip the (rate-limited) Notion write.
          // In practice this rarely fires for posts (stats keep moving), but
          // it's free and correct when a post's numbers are truly static.
          if (!options.force && existingPageId && state.posts[post.id] === hash) {
            skipped++;
          } else if (existingPageId) {
            await updatePage(notion, existingPageId, properties);
            state.posts[post.id] = hash;
            updated++;
          } else {
            await createPage(notion, config.notionPostsDbId, properties);
            state.posts[post.id] = hash;
            created++;
          }
          spinner.text = `Syncing posts: ${i + 1}/${posts.length} (${created} created, ${updated} updated, ${skipped} skipped)`;
        },
        3,
        1000
      ).catch((err: Error) => {
        failed++;
        spinner.warn(`Failed to sync post "${post.title}": ${err.message}`);
      })
    )
  );

  await Promise.all(tasks);
  await saveSyncState(config.syncStateFilePath, state);
  spinner.succeed(
    `Posts sync complete: ${created} created, ${updated} updated, ${skipped} skipped, ${failed} failed`
  );
  return { created, updated, skipped, failed };
}
