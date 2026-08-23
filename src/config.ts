import * as dotenv from 'dotenv';
import { ConfigError } from './errors';

dotenv.config();

export interface Config {
  beehiivApiKey: string;
  beehiivPublicationId: string;
  notionApiKey: string;
  notionSubscribersDbId: string;
  notionPostsDbId: string;
  syncIntervalHours: number;
  notionConcurrency: number;
  notionRateLimitMs: number;
  syncStateFilePath: string;
}

export interface SetupConfig {
  beehiivApiKey: string;
  beehiivPublicationId: string;
  notionApiKey: string;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new ConfigError(`Missing ${key}. See .env.example for setup instructions.`);
  }
  return value.trim();
}

function positiveIntEnv(key: string, fallback: number): number {
  const raw = parseInt(process.env[key] ?? '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export function loadSetupConfig(): SetupConfig {
  return {
    beehiivApiKey: requireEnv('BEEHIIV_API_KEY'),
    beehiivPublicationId: requireEnv('BEEHIIV_PUBLICATION_ID'),
    notionApiKey: requireEnv('NOTION_API_KEY'),
  };
}

export function loadConfig(): Config {
  return {
    beehiivApiKey: requireEnv('BEEHIIV_API_KEY'),
    beehiivPublicationId: requireEnv('BEEHIIV_PUBLICATION_ID'),
    notionApiKey: requireEnv('NOTION_API_KEY'),
    notionSubscribersDbId: requireEnv('NOTION_SUBSCRIBERS_DB_ID'),
    notionPostsDbId: requireEnv('NOTION_POSTS_DB_ID'),
    syncIntervalHours: positiveIntEnv('SYNC_INTERVAL_HOURS', 6),
    notionConcurrency: positiveIntEnv('NOTION_CONCURRENCY', 3),
    notionRateLimitMs: positiveIntEnv('NOTION_RATE_LIMIT_MS', 350),
    syncStateFilePath: process.env['SYNC_STATE_FILE']?.trim() || '.sync-state.json',
  };
}
