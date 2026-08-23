import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import { getSubscribers, getAllSubscribers, getPosts, getAllPosts } from '../../src/beehiiv/client';
import { BeehiivApiError, BeehiivSchemaError } from '../../src/errors';

describe('getSubscribers', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(axios);
  });
  afterEach(() => {
    mock.restore();
  });

  it('parses a well-formed response and normalizes the pagination envelope', async () => {
    mock.onGet('https://api.beehiiv.com/v2/publications/pub_1/subscriptions').reply(200, {
      data: [
        {
          id: 'sub_1',
          email: 'a@example.com',
          status: 'active',
          created: 1705276800,
          subscription_tier: 'free',
          utm_source: null,
          utm_medium: null,
          utm_campaign: null,
          tags: ['vip'],
        },
      ],
      next_cursor: 'cursor_abc',
      has_more: true,
      total_results: 500,
    });

    const page = await getSubscribers('key', 'pub_1');
    expect(page.data).toHaveLength(1);
    expect(page.data[0].email).toBe('a@example.com');
    expect(page.nextCursor).toBe('cursor_abc');
    expect(page.hasMore).toBe(true);
    expect(page.totalResults).toBe(500);
  });

  it('requests expand[]=tags and passes the cursor through as a query param', async () => {
    mock.onGet('https://api.beehiiv.com/v2/publications/pub_1/subscriptions').reply((config) => {
      expect(config.params.get('cursor')).toBe('prev_cursor');
      expect(config.params.getAll('expand[]')).toEqual(['tags']);
      return [200, { data: [], next_cursor: null, has_more: false }];
    });

    await getSubscribers('key', 'pub_1', 'prev_cursor');
  });

  it('throws BeehiivApiError on a non-2xx response', async () => {
    mock.onGet('https://api.beehiiv.com/v2/publications/pub_1/subscriptions').reply(401, {
      message: 'Unauthorized',
    });

    await expect(getSubscribers('bad-key', 'pub_1')).rejects.toThrow(BeehiivApiError);
  });

  it('throws BeehiivSchemaError when the response shape does not match', async () => {
    mock.onGet('https://api.beehiiv.com/v2/publications/pub_1/subscriptions').reply(200, {
      data: [{ id: 'sub_1' /* missing required fields like email/status/created */ }],
    });

    await expect(getSubscribers('key', 'pub_1')).rejects.toThrow(BeehiivSchemaError);
  });
});

describe('getAllSubscribers', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(axios);
  });
  afterEach(() => {
    mock.restore();
  });

  it('follows next_cursor across multiple pages and stops when has_more is false', async () => {
    const url = 'https://api.beehiiv.com/v2/publications/pub_1/subscriptions';
    mock
      .onGet(url)
      .replyOnce(200, {
        data: [
          {
            id: 'sub_1',
            email: 'a@example.com',
            status: 'active',
            created: 1,
            subscription_tier: 'free',
          },
        ],
        next_cursor: 'page2',
        has_more: true,
      })
      .onGet(url)
      .replyOnce(200, {
        data: [
          {
            id: 'sub_2',
            email: 'b@example.com',
            status: 'active',
            created: 2,
            subscription_tier: 'free',
          },
        ],
        next_cursor: null,
        has_more: false,
      });

    const all = await getAllSubscribers('key', 'pub_1');
    expect(all.map((s) => s.id)).toEqual(['sub_1', 'sub_2']);
  });

  it('stops after the first page when next_cursor is absent', async () => {
    mock.onGet('https://api.beehiiv.com/v2/publications/pub_1/subscriptions').reply(200, {
      data: [
        {
          id: 'sub_1',
          email: 'a@example.com',
          status: 'active',
          created: 1,
          subscription_tier: 'free',
        },
      ],
    });

    const all = await getAllSubscribers('key', 'pub_1');
    expect(all).toHaveLength(1);
    expect(mock.history.get).toHaveLength(1);
  });
});

describe('getPosts', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(axios);
  });
  afterEach(() => {
    mock.restore();
  });

  it('requests expand[]=stats and parses nested stats.email/stats.web', async () => {
    mock.onGet('https://api.beehiiv.com/v2/publications/pub_1/posts').reply((config) => {
      expect(config.params.getAll('expand[]')).toEqual(['stats']);
      return [
        200,
        {
          data: [
            {
              id: 'post_1',
              title: 'Issue #1',
              status: 'confirmed',
              stats: { email: { recipients: 100, opens: 40 }, web: { views: 10 } },
            },
          ],
          next_cursor: null,
          has_more: false,
        },
      ];
    });

    const page = await getPosts('key', 'pub_1');
    expect(page.data[0].stats?.email?.recipients).toBe(100);
    expect(page.data[0].stats?.web?.views).toBe(10);
  });
});

describe('getAllPosts', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(axios);
  });
  afterEach(() => {
    mock.restore();
  });

  it('paginates until has_more is false', async () => {
    const url = 'https://api.beehiiv.com/v2/publications/pub_1/posts';
    mock
      .onGet(url)
      .replyOnce(200, {
        data: [{ id: 'post_1', title: 'Issue #1', status: 'confirmed' }],
        next_cursor: 'p2',
        has_more: true,
      })
      .onGet(url)
      .replyOnce(200, {
        data: [{ id: 'post_2', title: 'Issue #2', status: 'draft' }],
        next_cursor: null,
        has_more: false,
      });

    const all = await getAllPosts('key', 'pub_1');
    expect(all.map((p) => p.id)).toEqual(['post_1', 'post_2']);
  });
});
