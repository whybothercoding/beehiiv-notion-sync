import ora from 'ora';
import { loadConfig } from '../config';
import { getAllPosts } from '../beehiiv/client';
import { BeehiivPost } from '../beehiiv/types';
import { createNotionClient, createPage, updatePage, fetchExistingIds } from '../notion/client';
import { titleProp, richTextProp, selectProp, dateProp, urlProp, numberProp, PostProperties } from '../notion/types';
import { RateLimiter, withRetry } from './utils';

export function mapPostToNotion(post: BeehiivPost): PostProperties {
  return {
    Title: titleProp(post.title),
    Subtitle: richTextProp(post.subtitle ?? ''),
    Status: selectProp(post.status),
    PublishDate: dateProp(post.publish_date),
    WebUrl: urlProp(post.web_url),
    TotalSent: numberProp(post.stats?.total_sent),
    Opens: numberProp(post.stats?.opens),
    OpenRate: numberProp(post.stats?.open_rate),
    Clicks: numberProp(post.stats?.clicks),
    ClickRate: numberProp(post.stats?.click_rate),
    Unsubscribes: numberProp(post.stats?.unsubscribes),
    BeehiivPostId: richTextProp(post.id),
  };
}

export async function syncPosts(options: { dryRun?: boolean } = {}): Promise<{ created: number; updated: number; failed: number }> {
  const config = loadConfig();
  const notion = createNotionClient(config.notionApiKey);
  const limiter = new RateLimiter(3, 350);

  const spinner = ora('Fetching posts from Beehiiv...').start();
  const posts = await getAllPosts(config.beehiivApiKey, config.beehiivPublicationId);

  if (options.dryRun) {
    spinner.succeed(`[dry-run] Would sync ${posts.length} posts (no writes performed)`);
    return { created: 0, updated: 0, failed: 0 };
  }

  spinner.text = 'Loading existing Notion post records...';
  const existingIds = await fetchExistingIds(notion, config.notionPostsDbId, 'BeehiivPostId');
  spinner.text = `Syncing ${posts.length} posts to Notion...`;

  let created = 0, updated = 0, failed = 0;

  const tasks = posts.map((post, i) =>
    limiter.execute(() =>
      withRetry(async () => {
        const properties = mapPostToNotion(post);
        const existingPageId = existingIds.get(post.id);
        if (existingPageId) {
          await updatePage(notion, existingPageId, properties);
          updated++;
        } else {
          await createPage(notion, config.notionPostsDbId, properties);
          created++;
        }
        spinner.text = `Syncing posts: ${i + 1}/${posts.length} (${created} created, ${updated} updated)`;
      }, 3, 1000).catch((err: Error) => {
        failed++;
        spinner.warn(`Failed to sync post "${post.title}": ${err.message}`);
      })
    )
  );

  await Promise.all(tasks);
  spinner.succeed(`Posts sync complete: ${created} created, ${updated} updated, ${failed} failed`);
  return { created, updated, failed };
}
