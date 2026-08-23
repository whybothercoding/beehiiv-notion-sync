jest.mock('node-cron');
jest.mock('../src/sync/subscribers');
jest.mock('../src/sync/posts');

const BASE_ENV = {
  BEEHIIV_API_KEY: 'bh_key_test',
  BEEHIIV_PUBLICATION_ID: 'pub_test123',
  NOTION_API_KEY: 'secret_test',
  NOTION_SUBSCRIBERS_DB_ID: 'db_subs',
  NOTION_POSTS_DB_ID: 'db_posts',
};

const EMPTY_RESULT = { created: 0, updated: 0, skipped: 0, failed: 0 };

describe('startScheduler', () => {
  let savedEnv: NodeJS.ProcessEnv;
  let sigintHandlers: NodeJS.SignalsListener[];
  let sigtermHandlers: NodeJS.SignalsListener[];

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    savedEnv = { ...process.env };
    Object.assign(process.env, BASE_ENV);
    sigintHandlers = [];
    sigtermHandlers = [];
    jest.spyOn(process, 'on').mockImplementation(((
      event: string,
      handler: NodeJS.SignalsListener
    ) => {
      if (event === 'SIGINT') sigintHandlers.push(handler);
      if (event === 'SIGTERM') sigtermHandlers.push(handler);
      return process;
    }) as never);
    jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = savedEnv;
    jest.restoreAllMocks();
  });

  it('runs an immediate sync on startup before scheduling recurring runs', async () => {
    const cron = jest.requireMock('node-cron') as { schedule: jest.Mock };
    const stopFn = jest.fn();
    cron.schedule.mockReturnValue({ stop: stopFn });
    const { syncSubscribers } = jest.requireMock('../src/sync/subscribers') as {
      syncSubscribers: jest.Mock;
    };
    const { syncPosts } = jest.requireMock('../src/sync/posts') as { syncPosts: jest.Mock };
    syncSubscribers.mockResolvedValue(EMPTY_RESULT);
    syncPosts.mockResolvedValue(EMPTY_RESULT);

    const { startScheduler } = await import('../src/scheduler');
    await startScheduler();

    expect(syncSubscribers).toHaveBeenCalledTimes(1);
    expect(syncPosts).toHaveBeenCalledTimes(1);
    expect(cron.schedule).toHaveBeenCalledTimes(1);
  });

  it('clamps a cron hour interval above 23 instead of producing an invalid expression', async () => {
    process.env.SYNC_INTERVAL_HOURS = '48';
    const cron = jest.requireMock('node-cron') as { schedule: jest.Mock };
    cron.schedule.mockReturnValue({ stop: jest.fn() });
    const { syncSubscribers } = jest.requireMock('../src/sync/subscribers') as {
      syncSubscribers: jest.Mock;
    };
    const { syncPosts } = jest.requireMock('../src/sync/posts') as { syncPosts: jest.Mock };
    syncSubscribers.mockResolvedValue(EMPTY_RESULT);
    syncPosts.mockResolvedValue(EMPTY_RESULT);

    const { startScheduler } = await import('../src/scheduler');
    await startScheduler();

    const [expression] = cron.schedule.mock.calls[0];
    expect(expression).toBe('0 */23 * * *');
  });

  it('stops the cron task and waits for an in-progress sync on SIGINT', async () => {
    const cron = jest.requireMock('node-cron') as { schedule: jest.Mock };
    const stopFn = jest.fn();
    cron.schedule.mockReturnValue({ stop: stopFn });
    const { syncSubscribers } = jest.requireMock('../src/sync/subscribers') as {
      syncSubscribers: jest.Mock;
    };
    const { syncPosts } = jest.requireMock('../src/sync/posts') as { syncPosts: jest.Mock };
    syncSubscribers.mockResolvedValue(EMPTY_RESULT);
    syncPosts.mockResolvedValue(EMPTY_RESULT);

    const { startScheduler } = await import('../src/scheduler');
    await startScheduler();

    expect(sigintHandlers).toHaveLength(1);
    await sigintHandlers[0]('SIGINT');

    expect(stopFn).toHaveBeenCalledTimes(1);
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it('does not schedule a new sync once shutdown has started', async () => {
    const cron = jest.requireMock('node-cron') as { schedule: jest.Mock };
    let scheduledCallback: (() => void) | undefined;
    cron.schedule.mockImplementation((_expr: string, cb: () => void) => {
      scheduledCallback = cb;
      return { stop: jest.fn() };
    });
    const { syncSubscribers } = jest.requireMock('../src/sync/subscribers') as {
      syncSubscribers: jest.Mock;
    };
    const { syncPosts } = jest.requireMock('../src/sync/posts') as { syncPosts: jest.Mock };
    syncSubscribers.mockResolvedValue(EMPTY_RESULT);
    syncPosts.mockResolvedValue(EMPTY_RESULT);

    const { startScheduler } = await import('../src/scheduler');
    await startScheduler();
    await sigintHandlers[0]('SIGINT');

    syncSubscribers.mockClear();
    scheduledCallback?.();
    expect(syncSubscribers).not.toHaveBeenCalled();
  });

  it('logs and continues when the initial subscriber sync rejects', async () => {
    const cron = jest.requireMock('node-cron') as { schedule: jest.Mock };
    cron.schedule.mockReturnValue({ stop: jest.fn() });
    const { syncSubscribers } = jest.requireMock('../src/sync/subscribers') as {
      syncSubscribers: jest.Mock;
    };
    const { syncPosts } = jest.requireMock('../src/sync/posts') as { syncPosts: jest.Mock };
    syncSubscribers.mockRejectedValue(new Error('Beehiiv is down'));
    syncPosts.mockResolvedValue(EMPTY_RESULT);

    const { startScheduler } = await import('../src/scheduler');
    await expect(startScheduler()).resolves.toBeDefined();
    expect(syncPosts).toHaveBeenCalledTimes(1);
  });

  it('logs and does not crash when a scheduled recurring sync rejects', async () => {
    const cron = jest.requireMock('node-cron') as { schedule: jest.Mock };
    let scheduledCallback: (() => void) | undefined;
    cron.schedule.mockImplementation((_expr: string, cb: () => void) => {
      scheduledCallback = cb;
      return { stop: jest.fn() };
    });
    const { syncSubscribers } = jest.requireMock('../src/sync/subscribers') as {
      syncSubscribers: jest.Mock;
    };
    const { syncPosts } = jest.requireMock('../src/sync/posts') as { syncPosts: jest.Mock };
    syncSubscribers.mockResolvedValue(EMPTY_RESULT);
    syncPosts.mockResolvedValue(EMPTY_RESULT);

    const { startScheduler } = await import('../src/scheduler');
    await startScheduler();

    syncSubscribers.mockRejectedValue(new Error('boom'));
    scheduledCallback?.();
    // Allow the rejected promise chain inside the cron callback to settle.
    await new Promise((resolve) => setImmediate(resolve));

    expect(console.error).toHaveBeenCalled();
  });
});
