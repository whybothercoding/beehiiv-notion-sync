import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { BeehiivPost } from '../../src/beehiiv/types';

jest.mock('../../src/beehiiv/client');
jest.mock('../../src/notion/client');

const BASE_ENV = {
  BEEHIIV_API_KEY: 'bh_key_test',
  BEEHIIV_PUBLICATION_ID: 'pub_test123',
  NOTION_API_KEY: 'secret_test',
  NOTION_SUBSCRIBERS_DB_ID: 'db_subs',
  NOTION_POSTS_DB_ID: 'db_posts',
};

function makePost(overrides: Partial<BeehiivPost> = {}): BeehiivPost {
  return {
    id: 'post_1',
    title: 'Issue #1',
    status: 'confirmed',
    subtitle: null,
    publish_date: 1705276800,
    web_url: 'https://example.beehiiv.com/p/issue-1',
    stats: {
      email: {
        recipients: 100,
        opens: 40,
        open_rate: 0.4,
        clicks: 5,
        click_rate: 0.05,
        unsubscribes: 0,
      },
    },
    ...overrides,
  };
}

describe('syncPosts', () => {
  let savedEnv: NodeJS.ProcessEnv;
  let stateFile: string;
  let dir: string;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    savedEnv = { ...process.env };
    Object.assign(process.env, BASE_ENV);
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-posts-test-'));
    stateFile = path.join(dir, '.sync-state.json');
    process.env.SYNC_STATE_FILE = stateFile;
  });

  afterEach(async () => {
    process.env = savedEnv;
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('creates new posts that have no existing Notion page', async () => {
    const { getAllPosts } = jest.requireMock('../../src/beehiiv/client') as {
      getAllPosts: jest.Mock;
    };
    const notionClient = jest.requireMock('../../src/notion/client') as {
      createNotionClient: jest.Mock;
      createPage: jest.Mock;
      updatePage: jest.Mock;
      fetchExistingIds: jest.Mock;
    };
    getAllPosts.mockResolvedValue([makePost({ id: 'post_new' })]);
    notionClient.createNotionClient.mockReturnValue({});
    notionClient.fetchExistingIds.mockResolvedValue(new Map());
    notionClient.createPage.mockResolvedValue('page_new');

    const { syncPosts } = await import('../../src/sync/posts');
    const result = await syncPosts({ quiet: true, rateLimitMs: 0 });

    expect(result).toEqual({ created: 1, updated: 0, skipped: 0, failed: 0 });
    expect(notionClient.createPage).toHaveBeenCalledTimes(1);
  });

  it('updates a post whose stats changed since last sync', async () => {
    const { getAllPosts } = jest.requireMock('../../src/beehiiv/client') as {
      getAllPosts: jest.Mock;
    };
    const notionClient = jest.requireMock('../../src/notion/client') as {
      createNotionClient: jest.Mock;
      createPage: jest.Mock;
      updatePage: jest.Mock;
      fetchExistingIds: jest.Mock;
    };
    getAllPosts.mockResolvedValue([makePost({ id: 'post_1', stats: { email: { opens: 999 } } })]);
    notionClient.createNotionClient.mockReturnValue({});
    notionClient.fetchExistingIds.mockResolvedValue(new Map([['post_1', 'page_1']]));

    const { syncPosts } = await import('../../src/sync/posts');
    const result = await syncPosts({ quiet: true, rateLimitMs: 0 });

    expect(result.updated).toBe(1);
    expect(notionClient.updatePage).toHaveBeenCalledTimes(1);
  });

  it('skips a post whose mapped properties are unchanged since last sync', async () => {
    const { getAllPosts } = jest.requireMock('../../src/beehiiv/client') as {
      getAllPosts: jest.Mock;
    };
    const notionClient = jest.requireMock('../../src/notion/client') as {
      createNotionClient: jest.Mock;
      createPage: jest.Mock;
      updatePage: jest.Mock;
      fetchExistingIds: jest.Mock;
    };
    const post = makePost({ id: 'post_1' });
    getAllPosts.mockResolvedValue([post]);
    notionClient.createNotionClient.mockReturnValue({});
    notionClient.fetchExistingIds.mockResolvedValue(new Map([['post_1', 'page_1']]));

    const { syncPosts, mapPostToNotion } = await import('../../src/sync/posts');
    const { hashProperties, saveSyncState } = await import('../../src/sync/state');
    await saveSyncState(stateFile, {
      subscribers: {},
      posts: { post_1: hashProperties(mapPostToNotion(post)) },
    });

    const result = await syncPosts({ quiet: true, rateLimitMs: 0 });

    expect(result).toEqual({ created: 0, updated: 0, skipped: 1, failed: 0 });
    expect(notionClient.updatePage).not.toHaveBeenCalled();
  });

  it('performs no writes in dry-run mode', async () => {
    const { getAllPosts } = jest.requireMock('../../src/beehiiv/client') as {
      getAllPosts: jest.Mock;
    };
    const notionClient = jest.requireMock('../../src/notion/client') as {
      createNotionClient: jest.Mock;
      createPage: jest.Mock;
      fetchExistingIds: jest.Mock;
    };
    getAllPosts.mockResolvedValue([makePost()]);
    notionClient.createNotionClient.mockReturnValue({});

    const { syncPosts } = await import('../../src/sync/posts');
    const result = await syncPosts({ dryRun: true, quiet: true });

    expect(result).toEqual({ created: 0, updated: 0, skipped: 0, failed: 0 });
    expect(notionClient.fetchExistingIds).not.toHaveBeenCalled();
  });

  it('persists per-post hashes to the state file after a successful sync', async () => {
    const { getAllPosts } = jest.requireMock('../../src/beehiiv/client') as {
      getAllPosts: jest.Mock;
    };
    const notionClient = jest.requireMock('../../src/notion/client') as {
      createNotionClient: jest.Mock;
      createPage: jest.Mock;
      fetchExistingIds: jest.Mock;
    };
    getAllPosts.mockResolvedValue([makePost({ id: 'post_1' })]);
    notionClient.createNotionClient.mockReturnValue({});
    notionClient.fetchExistingIds.mockResolvedValue(new Map());
    notionClient.createPage.mockResolvedValue('page_1');

    const { syncPosts } = await import('../../src/sync/posts');
    await syncPosts({ quiet: true, rateLimitMs: 0 });

    const { loadSyncState } = await import('../../src/sync/state');
    const state = await loadSyncState(stateFile);
    expect(Object.keys(state.posts)).toEqual(['post_1']);
  });
});
