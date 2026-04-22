import cron from 'node-cron';
import chalk from 'chalk';
import { loadConfig } from './config';
import { syncSubscribers } from './sync/subscribers';
import { syncPosts } from './sync/posts';

function getNextRunTime(intervalHours: number): string {
  const next = new Date(Date.now() + intervalHours * 60 * 60 * 1000);
  return next.toLocaleString();
}

async function runSync(intervalHours: number): Promise<void> {
  const timestamp = new Date().toLocaleString();
  console.log(chalk.blue(`\n[${timestamp}] Starting sync...`));

  try {
    const subResult = await syncSubscribers();
    console.log(
      chalk.green(
        `Subscribers: ${subResult.created} created, ${subResult.updated} updated, ${subResult.failed} failed`
      )
    );
  } catch (error) {
    console.error(chalk.red('Subscriber sync failed:'), error);
  }

  try {
    const postResult = await syncPosts();
    console.log(
      chalk.green(
        `Posts: ${postResult.created} created, ${postResult.updated} updated, ${postResult.failed} failed`
      )
    );
  } catch (error) {
    console.error(chalk.red('Post sync failed:'), error);
  }

  console.log(chalk.dim(`Next sync at: ${getNextRunTime(intervalHours)}`));
}

export async function startScheduler(): Promise<void> {
  const config = loadConfig();
  const intervalHours = config.syncIntervalHours;

  console.log(
    chalk.blue(`Scheduler started — syncing every ${intervalHours} hour(s)`)
  );

  await runSync(intervalHours);

  const cronExpression = `0 */${intervalHours} * * *`;

  cron.schedule(cronExpression, () => {
    runSync(intervalHours).catch((error) => {
      console.error(chalk.red('Scheduled sync error:'), error);
    });
  });

  console.log(chalk.dim(`Cron expression: ${cronExpression}`));
  console.log(chalk.dim('Press Ctrl+C to stop.'));
}
