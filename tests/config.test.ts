import { loadSetupConfig, loadConfig } from '../src/config';

const BASE_ENV = {
  BEEHIIV_API_KEY: 'bh_key_test',
  BEEHIIV_PUBLICATION_ID: 'pub_test123',
  NOTION_API_KEY: 'secret_test',
  NOTION_SUBSCRIBERS_DB_ID: 'db_subs',
  NOTION_POSTS_DB_ID: 'db_posts',
};

describe('loadSetupConfig', () => {
  let saved: NodeJS.ProcessEnv;
  beforeEach(() => {
    saved = { ...process.env };
    delete process.env.BEEHIIV_API_KEY;
    delete process.env.BEEHIIV_PUBLICATION_ID;
    delete process.env.NOTION_API_KEY;
  });
  afterEach(() => { process.env = saved; });

  it('returns all three fields when env vars are set', () => {
    process.env.BEEHIIV_API_KEY = BASE_ENV.BEEHIIV_API_KEY;
    process.env.BEEHIIV_PUBLICATION_ID = BASE_ENV.BEEHIIV_PUBLICATION_ID;
    process.env.NOTION_API_KEY = BASE_ENV.NOTION_API_KEY;
    const config = loadSetupConfig();
    expect(config.beehiivApiKey).toBe('bh_key_test');
    expect(config.beehiivPublicationId).toBe('pub_test123');
    expect(config.notionApiKey).toBe('secret_test');
  });
  it('throws with the missing key name when BEEHIIV_API_KEY is absent', () => {
    process.env.BEEHIIV_PUBLICATION_ID = BASE_ENV.BEEHIIV_PUBLICATION_ID;
    process.env.NOTION_API_KEY = BASE_ENV.NOTION_API_KEY;
    expect(() => loadSetupConfig()).toThrow('Missing BEEHIIV_API_KEY');
  });
  it('throws when NOTION_API_KEY is absent', () => {
    process.env.BEEHIIV_API_KEY = BASE_ENV.BEEHIIV_API_KEY;
    process.env.BEEHIIV_PUBLICATION_ID = BASE_ENV.BEEHIIV_PUBLICATION_ID;
    expect(() => loadSetupConfig()).toThrow('Missing NOTION_API_KEY');
  });
  it('treats a whitespace-only value as missing', () => {
    process.env.BEEHIIV_API_KEY = '   ';
    process.env.BEEHIIV_PUBLICATION_ID = BASE_ENV.BEEHIIV_PUBLICATION_ID;
    process.env.NOTION_API_KEY = BASE_ENV.NOTION_API_KEY;
    expect(() => loadSetupConfig()).toThrow('Missing BEEHIIV_API_KEY');
  });
});

describe('loadConfig', () => {
  let saved: NodeJS.ProcessEnv;
  beforeEach(() => {
    saved = { ...process.env };
    Object.keys(BASE_ENV).forEach((k) => delete process.env[k]);
    delete process.env.SYNC_INTERVAL_HOURS;
  });
  afterEach(() => { process.env = saved; });

  it('loads all five required fields', () => {
    Object.assign(process.env, BASE_ENV);
    const config = loadConfig();
    expect(config.beehiivApiKey).toBe('bh_key_test');
    expect(config.notionSubscribersDbId).toBe('db_subs');
    expect(config.notionPostsDbId).toBe('db_posts');
  });
  it('defaults syncIntervalHours to 6 when SYNC_INTERVAL_HOURS is not set', () => {
    Object.assign(process.env, BASE_ENV);
    expect(loadConfig().syncIntervalHours).toBe(6);
  });
  it('reads syncIntervalHours from SYNC_INTERVAL_HOURS env var', () => {
    Object.assign(process.env, BASE_ENV);
    process.env.SYNC_INTERVAL_HOURS = '12';
    expect(loadConfig().syncIntervalHours).toBe(12);
  });
  it('throws when NOTION_SUBSCRIBERS_DB_ID is absent', () => {
    Object.assign(process.env, BASE_ENV);
    delete process.env.NOTION_SUBSCRIBERS_DB_ID;
    expect(() => loadConfig()).toThrow('Missing NOTION_SUBSCRIBERS_DB_ID');
  });
});
