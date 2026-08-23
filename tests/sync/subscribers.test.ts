import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { BeehiivSubscriber } from '../../src/beehiiv/types';

jest.mock('../../src/beehiiv/client');
jest.mock('../../src/notion/client');

const BASE_ENV = {
  BEEHIIV_API_KEY: 'bh_key_test',
  BEEHIIV_PUBLICATION_ID: 'pub_test123',
  NOTION_API_KEY: 'secret_test',
  NOTION_SUBSCRIBERS_DB_ID: 'db_subs',
  NOTION_POSTS_DB_ID: 'db_posts',
};

function makeSubscriber(overrides: Partial<BeehiivSubscriber> = {}): BeehiivSubscriber {
  return {
    id: 'sub_1',
    email: 'a@example.com',
    status: 'active',
    created: 1705276800,
    subscription_tier: 'free',
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    tags: [],
    ...overrides,
  };
}

describe('syncSubscribers', () => {
  let savedEnv: NodeJS.ProcessEnv;
  let stateFile: string;
  let dir: string;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    savedEnv = { ...process.env };
    Object.assign(process.env, BASE_ENV);
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-subs-test-'));
    stateFile = path.join(dir, '.sync-state.json');
    process.env.SYNC_STATE_FILE = stateFile;
  });

  afterEach(async () => {
    process.env = savedEnv;
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('creates new subscribers that have no existing Notion page', async () => {
    const { getAllSubscribers } = jest.requireMock('../../src/beehiiv/client') as {
      getAllSubscribers: jest.Mock;
    };
    const notionClient = jest.requireMock('../../src/notion/client') as {
      createNotionClient: jest.Mock;
      createPage: jest.Mock;
      updatePage: jest.Mock;
      fetchExistingIds: jest.Mock;
    };
    getAllSubscribers.mockResolvedValue([makeSubscriber({ id: 'sub_new' })]);
    notionClient.createNotionClient.mockReturnValue({});
    notionClient.fetchExistingIds.mockResolvedValue(new Map());
    notionClient.createPage.mockResolvedValue('page_new');

    const { syncSubscribers } = await import('../../src/sync/subscribers');
    const result = await syncSubscribers({ quiet: true, rateLimitMs: 0 });

    expect(result).toEqual({ created: 1, updated: 0, skipped: 0, failed: 0 });
    expect(notionClient.createPage).toHaveBeenCalledTimes(1);
    expect(notionClient.updatePage).not.toHaveBeenCalled();
  });

  it('updates a subscriber whose properties changed since last sync', async () => {
    const { getAllSubscribers } = jest.requireMock('../../src/beehiiv/client') as {
      getAllSubscribers: jest.Mock;
    };
    const notionClient = jest.requireMock('../../src/notion/client') as {
      createNotionClient: jest.Mock;
      createPage: jest.Mock;
      updatePage: jest.Mock;
      fetchExistingIds: jest.Mock;
    };
    getAllSubscribers.mockResolvedValue([makeSubscriber({ id: 'sub_1', status: 'inactive' })]);
    notionClient.createNotionClient.mockReturnValue({});
    notionClient.fetchExistingIds.mockResolvedValue(new Map([['sub_1', 'page_1']]));

    const { syncSubscribers } = await import('../../src/sync/subscribers');
    const result = await syncSubscribers({ quiet: true, rateLimitMs: 0 });

    expect(result.updated).toBe(1);
    expect(notionClient.updatePage).toHaveBeenCalledTimes(1);
  });

  it('skips a subscriber whose mapped properties are unchanged since last sync', async () => {
    const { getAllSubscribers } = jest.requireMock('../../src/beehiiv/client') as {
      getAllSubscribers: jest.Mock;
    };
    const notionClient = jest.requireMock('../../src/notion/client') as {
      createNotionClient: jest.Mock;
      createPage: jest.Mock;
      updatePage: jest.Mock;
      fetchExistingIds: jest.Mock;
    };
    const subscriber = makeSubscriber({ id: 'sub_1' });
    getAllSubscribers.mockResolvedValue([subscriber]);
    notionClient.createNotionClient.mockReturnValue({});
    notionClient.fetchExistingIds.mockResolvedValue(new Map([['sub_1', 'page_1']]));

    const { syncSubscribers, mapSubscriberToNotion } = await import('../../src/sync/subscribers');
    const { hashProperties, saveSyncState } = await import('../../src/sync/state');
    await saveSyncState(stateFile, {
      subscribers: { sub_1: hashProperties(mapSubscriberToNotion(subscriber)) },
      posts: {},
    });

    const result = await syncSubscribers({ quiet: true, rateLimitMs: 0 });

    expect(result).toEqual({ created: 0, updated: 0, skipped: 1, failed: 0 });
    expect(notionClient.updatePage).not.toHaveBeenCalled();
    expect(notionClient.createPage).not.toHaveBeenCalled();
  });

  it('--force re-writes a subscriber even when unchanged', async () => {
    const { getAllSubscribers } = jest.requireMock('../../src/beehiiv/client') as {
      getAllSubscribers: jest.Mock;
    };
    const notionClient = jest.requireMock('../../src/notion/client') as {
      createNotionClient: jest.Mock;
      createPage: jest.Mock;
      updatePage: jest.Mock;
      fetchExistingIds: jest.Mock;
    };
    const subscriber = makeSubscriber({ id: 'sub_1' });
    getAllSubscribers.mockResolvedValue([subscriber]);
    notionClient.createNotionClient.mockReturnValue({});
    notionClient.fetchExistingIds.mockResolvedValue(new Map([['sub_1', 'page_1']]));

    const { syncSubscribers, mapSubscriberToNotion } = await import('../../src/sync/subscribers');
    const { hashProperties, saveSyncState } = await import('../../src/sync/state');
    await saveSyncState(stateFile, {
      subscribers: { sub_1: hashProperties(mapSubscriberToNotion(subscriber)) },
      posts: {},
    });

    const result = await syncSubscribers({ quiet: true, rateLimitMs: 0, force: true });

    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(0);
    expect(notionClient.updatePage).toHaveBeenCalledTimes(1);
  });

  it('counts a failure and continues when a write throws, without aborting the batch', async () => {
    const { getAllSubscribers } = jest.requireMock('../../src/beehiiv/client') as {
      getAllSubscribers: jest.Mock;
    };
    const notionClient = jest.requireMock('../../src/notion/client') as {
      createNotionClient: jest.Mock;
      createPage: jest.Mock;
      updatePage: jest.Mock;
      fetchExistingIds: jest.Mock;
    };
    getAllSubscribers.mockResolvedValue([
      makeSubscriber({ id: 'sub_fail', email: 'fail@example.com' }),
      makeSubscriber({ id: 'sub_ok', email: 'ok@example.com' }),
    ]);
    notionClient.createNotionClient.mockReturnValue({});
    notionClient.fetchExistingIds.mockResolvedValue(new Map());
    notionClient.createPage.mockImplementation(
      (
        _notion: unknown,
        _db: unknown,
        props: { Email: { title: [{ text: { content: string } }] } }
      ) => {
        if (props.Email.title[0].text.content === 'fail@example.com') {
          return Promise.reject(new Error('Notion is down'));
        }
        return Promise.resolve('page_ok');
      }
    );

    const { syncSubscribers } = await import('../../src/sync/subscribers');
    const result = await syncSubscribers({ quiet: true, rateLimitMs: 0 });

    expect(result.created).toBe(1);
    expect(result.failed).toBe(1);
  }, 15000);

  it('performs no writes in dry-run mode', async () => {
    const { getAllSubscribers } = jest.requireMock('../../src/beehiiv/client') as {
      getAllSubscribers: jest.Mock;
    };
    const notionClient = jest.requireMock('../../src/notion/client') as {
      createNotionClient: jest.Mock;
      createPage: jest.Mock;
      updatePage: jest.Mock;
      fetchExistingIds: jest.Mock;
    };
    getAllSubscribers.mockResolvedValue([makeSubscriber()]);
    notionClient.createNotionClient.mockReturnValue({});

    const { syncSubscribers } = await import('../../src/sync/subscribers');
    const result = await syncSubscribers({ dryRun: true, quiet: true });

    expect(result).toEqual({ created: 0, updated: 0, skipped: 0, failed: 0 });
    expect(notionClient.fetchExistingIds).not.toHaveBeenCalled();
    expect(notionClient.createPage).not.toHaveBeenCalled();
  });
});
