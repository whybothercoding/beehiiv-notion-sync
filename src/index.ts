#!/usr/bin/env node
import { Command, InvalidArgumentError } from 'commander';
import chalk from 'chalk';
import { version } from '../package.json';
import { runSetup } from './notion/setup';
import { syncSubscribers } from './sync/subscribers';
import { syncPosts } from './sync/posts';
import type { SyncOptions, SyncResult } from './sync/utils';
import { startScheduler } from './scheduler';
import { loadSetupConfig, loadConfig } from './config';

const program = new Command();

function parsePositiveInt(flag: string) {
  return (value: string): number => {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new InvalidArgumentError(`${flag} must be a positive integer.`);
    }
    return parsed;
  };
}

function reportError(error: unknown, json?: boolean): void {
  const message = (error as Error).message ?? String(error);
  if (json) {
    console.log(JSON.stringify({ ok: false, error: message }));
  } else {
    console.error(chalk.red(message));
  }
}

program
  .name('beehiiv-notion-sync')
  .description('Sync Beehiiv subscribers and post analytics to Notion')
  .version(version);

program
  .command('setup')
  .description('Create Notion databases for subscribers and posts')
  .requiredOption('--parent-page-id <id>', 'Notion page ID to create databases under')
  .action(async (options: { parentPageId: string }) => {
    try {
      const config = loadSetupConfig();
      await runSetup(config.notionApiKey, options.parentPageId);
    } catch (error) {
      reportError(error);
      process.exit(1);
    }
  });

program
  .command('sync')
  .description('Sync data from Beehiiv to Notion (default: all)')
  .option('--subscribers', 'Sync only subscribers')
  .option('--posts', 'Sync only posts')
  .option('--all', 'Sync both subscribers and posts (default)')
  .option('--dry-run', 'Fetch data from Beehiiv but skip all writes to Notion')
  .option('--force', 'Bypass the unchanged-record cache and re-write every record')
  .option(
    '--concurrency <n>',
    'Concurrent Notion requests (default: 3, or NOTION_CONCURRENCY)',
    parsePositiveInt('--concurrency')
  )
  .option(
    '--rate-limit-ms <ms>',
    'Delay between Notion requests in ms (default: 350, or NOTION_RATE_LIMIT_MS)',
    parsePositiveInt('--rate-limit-ms')
  )
  .option('--json', 'Print a machine-readable JSON summary instead of progress output')
  .action(
    async (options: {
      subscribers?: boolean;
      posts?: boolean;
      all?: boolean;
      dryRun?: boolean;
      force?: boolean;
      concurrency?: number;
      rateLimitMs?: number;
      json?: boolean;
    }) => {
      try {
        loadConfig();
      } catch (error) {
        reportError(error, options.json);
        process.exit(1);
      }

      const syncAll = !options.subscribers && !options.posts;
      const syncOptions: SyncOptions = {
        dryRun: options.dryRun,
        force: options.force,
        concurrency: options.concurrency,
        rateLimitMs: options.rateLimitMs,
        quiet: options.json,
      };

      try {
        const results: Partial<Record<'subscribers' | 'posts', SyncResult>> = {};
        if (options.subscribers || syncAll) {
          results.subscribers = await syncSubscribers(syncOptions);
        }
        if (options.posts || syncAll) {
          results.posts = await syncPosts(syncOptions);
        }
        if (options.json) {
          console.log(JSON.stringify({ ok: true, ...results }, null, 2));
        }
      } catch (error) {
        reportError(error, options.json);
        process.exit(1);
      }
    }
  );

program
  .command('start')
  .description('Run the sync on a recurring schedule (set SYNC_INTERVAL_HOURS in .env)')
  .action(async () => {
    try {
      loadConfig();
    } catch (error) {
      reportError(error);
      process.exit(1);
    }
    await startScheduler();
  });

process.on('uncaughtException', (error) => {
  console.error(chalk.red('Unhandled error:'), error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('Unhandled promise rejection:'), reason);
  process.exit(1);
});

program.parse(process.argv);
