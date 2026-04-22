#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { runSetup } from './notion/setup';
import { syncSubscribers } from './sync/subscribers';
import { syncPosts } from './sync/posts';
import { startScheduler } from './scheduler';
import { loadSetupConfig, loadConfig } from './config';

const program = new Command();

program
  .name('beehiiv-notion-sync')
  .description('Sync Beehiiv subscribers and post analytics to Notion')
  .version('0.1.0');

program
  .command('setup')
  .description('Create Notion databases for subscribers and posts')
  .requiredOption('--parent-page-id <id>', 'Notion page ID to create databases under')
  .action(async (options: { parentPageId: string }) => {
    try {
      const config = loadSetupConfig();
      await runSetup(config.notionApiKey, options.parentPageId);
    } catch (error) {
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

program
  .command('sync')
  .description('Sync data from Beehiiv to Notion (default: all)')
  .option('--subscribers', 'Sync only subscribers')
  .option('--posts', 'Sync only posts')
  .option('--all', 'Sync both subscribers and posts (default)')
  .action(async (options: { subscribers?: boolean; posts?: boolean; all?: boolean }) => {
    try {
      loadConfig();
    } catch (error) {
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }

    const syncAll = !options.subscribers && !options.posts;

    try {
      if (options.subscribers || syncAll) {
        await syncSubscribers();
      }
      if (options.posts || syncAll) {
        await syncPosts();
      }
    } catch (error) {
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

program
  .command('start')
  .description('Run the sync on a recurring schedule (set SYNC_INTERVAL_HOURS in .env)')
  .action(async () => {
    try {
      loadConfig();
    } catch (error) {
      console.error(chalk.red((error as Error).message));
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
