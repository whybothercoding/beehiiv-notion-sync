import type { ScheduledTask } from 'node-cron';
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
        `Subscribers: ${subResult.created} created, ${subResult.updated} updated, ${subResult.skipped} skipped, ${subResult.failed} failed`
      )
    );
  } catch (error) {
    console.error(chalk.red('Subscriber sync failed:'), error);
  }

  try {
    const postResult = await syncPosts();
    console.log(
      chalk.green(
        `Posts: ${postResult.created} created, ${postResult.updated} updated, ${postResult.skipped} skipped, ${postResult.failed} failed`
      )
    );
  } catch (error) {
    console.error(chalk.red('Post sync failed:'), error);
  }

  console.log(chalk.dim(`Next sync at: ${getNextRunTime(intervalHours)}`));
}

export interface SchedulerHandle {
  task: ScheduledTask;
  shutdown(signal: string): Promise<void>;
}

export async function startScheduler(): Promise<SchedulerHandle> {
  const config = loadConfig();
  const intervalHours = config.syncIntervalHours;

  console.log(chalk.blue(`Scheduler started — syncing every ${intervalHours} hour(s)`));

  let currentSync: Promise<void> | null = runSync(intervalHours);
  await currentSync;
  currentSync = null;

  // node-cron's hour field only accepts 0-23, so an interval above 23 would
  // silently produce a nonsensical expression. Clamp rather than fail a
  // running scheduler over a config typo.
  const safeInterval = Math.min(intervalHours, 23);
  const cronExpression = `0 */${safeInterval} * * *`;

  let shuttingDown = false;

  const task = cron.schedule(cronExpression, () => {
    if (shuttingDown) return;
    currentSync = runSync(intervalHours)
      .catch((error) => {
        console.error(chalk.red('Scheduled sync error:'), error);
      })
      .finally(() => {
        currentSync = null;
      });
  });

  console.log(chalk.dim(`Cron expression: ${cronExpression}`));
  console.log(chalk.dim('Press Ctrl+C to stop.'));

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(chalk.yellow(`\nReceived ${signal}, stopping scheduler...`));
    task.stop();
    if (currentSync) {
      console.log(chalk.dim('Waiting for the in-progress sync to finish...'));
      await currentSync;
    }
    console.log(chalk.green('Scheduler stopped cleanly.'));
  };

  process.on('SIGINT', () => {
    shutdown('SIGINT').finally(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    shutdown('SIGTERM').finally(() => process.exit(0));
  });

  return { task, shutdown };
}
