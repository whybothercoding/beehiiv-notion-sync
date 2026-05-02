import * as dotenv from 'dotenv';

dotenv.config();

export interface Config {
  beehiivApiKey: string;
  beehiivPublicationId: string;
  notionApiKey: string;
  notionSubscribersDbId: string;
  notionPostsDbId: string;
  syncIntervalHours: number;
}

export interface SetupConfig {
  beehiivApiKey: string;
  beehiivPublicationId: string;
  notionApiKey: string;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing ${key}. See .env.example for setup instructions.`
    );
  }
  return value.trim();
}

export function loadSetupConfig(): SetupConfig {
  return {
    beehiivApiKey: requireEnv('BEEHIIV_API_KEY'),
    beehiivPublicationId: requireEnv('BEEHIIV_PUBLICATION_ID'),
    notionApiKey: requireEnv('NOTION_API_KEY'),
  };
}

export function loadConfig(): Config {
  const rawInterval = parseInt(process.env['SYNC_INTERVAL_HOURS'] ?? '6', 10);
  return {
    beehiivApiKey: requireEnv('BEEHIIV_API_KEY'),
    beehiivPublicationId: requireEnv('BEEHIIV_PUBLICATION_ID'),
    notionApiKey: requireEnv('NOTION_API_KEY'),
    notionSubscribersDbId: requireEnv('NOTION_SUBSCRIBERS_DB_ID'),
    notionPostsDbId: requireEnv('NOTION_POSTS_DB_ID'),
    syncIntervalHours: Number.isFinite(rawInterval) && rawInterval > 0 ? rawInterval : 6,
  };
}
