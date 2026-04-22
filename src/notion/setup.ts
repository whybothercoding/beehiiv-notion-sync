import { Client } from '@notionhq/client';
import chalk from 'chalk';

export async function createSubscribersDatabase(
  notion: Client,
  parentPageId: string
): Promise<string> {
  const response = await notion.databases.create({
    parent: { type: 'page_id', page_id: parentPageId },
    title: [{ type: 'text', text: { content: 'Beehiiv Subscribers' } }],
    properties: {
      Email: { title: {} },
      Status: {
        select: {
          options: [
            { name: 'active', color: 'green' },
            { name: 'inactive', color: 'yellow' },
            { name: 'unsubscribed', color: 'red' },
          ],
        },
      },
      SubscribedAt: { date: {} },
      Tier: { select: { options: [] } },
      UtmSource: { rich_text: {} },
      UtmMedium: { rich_text: {} },
      UtmCampaign: { rich_text: {} },
      Tags: { multi_select: { options: [] } },
      BeehiivId: { rich_text: {} },
    },
  });

  return response.id;
}

export async function createPostsDatabase(
  notion: Client,
  parentPageId: string
): Promise<string> {
  const response = await notion.databases.create({
    parent: { type: 'page_id', page_id: parentPageId },
    title: [{ type: 'text', text: { content: 'Beehiiv Posts' } }],
    properties: {
      Title: { title: {} },
      Subtitle: { rich_text: {} },
      Status: { select: { options: [] } },
      PublishDate: { date: {} },
      WebUrl: { url: {} },
      TotalSent: { number: { format: 'number' } },
      Opens: { number: { format: 'number' } },
      OpenRate: { number: { format: 'percent' } },
      Clicks: { number: { format: 'number' } },
      ClickRate: { number: { format: 'percent' } },
      Unsubscribes: { number: { format: 'number' } },
      BeehiivPostId: { rich_text: {} },
    },
  });

  return response.id;
}

export async function runSetup(
  notionApiKey: string,
  parentPageId: string
): Promise<void> {
  const notion = new Client({ auth: notionApiKey });

  console.log(chalk.blue('Creating Beehiiv Subscribers database...'));
  const subscribersDbId = await createSubscribersDatabase(notion, parentPageId);
  console.log(chalk.green(`✓ Subscribers DB created: ${subscribersDbId}`));

  console.log(chalk.blue('Creating Beehiiv Posts database...'));
  const postsDbId = await createPostsDatabase(notion, parentPageId);
  console.log(chalk.green(`✓ Posts DB created: ${postsDbId}`));

  console.log('\n' + chalk.bold('Add these to your .env file:'));
  console.log(chalk.yellow(`NOTION_SUBSCRIBERS_DB_ID=${subscribersDbId}`));
  console.log(chalk.yellow(`NOTION_POSTS_DB_ID=${postsDbId}`));
}
