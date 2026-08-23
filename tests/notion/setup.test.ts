import type { Client } from '@notionhq/client';
import { createSubscribersDatabase, createPostsDatabase, runSetup } from '../../src/notion/setup';

function makeMockNotion(idsInOrder: string[]) {
  let call = 0;
  const create = jest.fn().mockImplementation(() => Promise.resolve({ id: idsInOrder[call++] }));
  return { databases: { create } } as unknown as Client;
}

describe('createSubscribersDatabase', () => {
  it('creates a database under the given parent page with the expected properties', async () => {
    const notion = makeMockNotion(['db_subs']);
    const id = await createSubscribersDatabase(notion, 'page_123');
    expect(id).toBe('db_subs');

    const call = (notion.databases.create as jest.Mock).mock.calls[0][0];
    expect(call.parent).toEqual({ type: 'page_id', page_id: 'page_123' });
    expect(Object.keys(call.properties)).toEqual([
      'Email',
      'Status',
      'SubscribedAt',
      'Tier',
      'UtmSource',
      'UtmMedium',
      'UtmCampaign',
      'Tags',
      'BeehiivId',
    ]);
    expect(call.properties.Email).toEqual({ title: {} });
    expect(call.properties.BeehiivId).toEqual({ rich_text: {} });
  });
});

describe('createPostsDatabase', () => {
  it('creates a database with number properties for both email and web stats', async () => {
    const notion = makeMockNotion(['db_posts']);
    const id = await createPostsDatabase(notion, 'page_123');
    expect(id).toBe('db_posts');

    const call = (notion.databases.create as jest.Mock).mock.calls[0][0];
    expect(call.properties.TotalSent).toEqual({ number: { format: 'number' } });
    expect(call.properties.OpenRate).toEqual({ number: { format: 'percent' } });
    expect(call.properties.WebViews).toEqual({ number: { format: 'number' } });
    expect(call.properties.WebClicks).toEqual({ number: { format: 'number' } });
    expect(call.properties.BeehiivPostId).toEqual({ rich_text: {} });
  });
});

jest.mock('@notionhq/client', () => {
  const actual = jest.requireActual('@notionhq/client');
  return {
    ...actual,
    Client: jest.fn(),
  };
});

describe('runSetup', () => {
  it('creates both databases and logs their IDs', async () => {
    const { Client } = jest.requireMock('@notionhq/client') as { Client: jest.Mock };
    const create = jest
      .fn()
      .mockResolvedValueOnce({ id: 'db_subs' })
      .mockResolvedValueOnce({ id: 'db_posts' });
    Client.mockImplementation(() => ({ databases: { create } }));

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    await runSetup('secret_test', 'page_123');

    expect(create).toHaveBeenCalledTimes(2);
    const logged = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logged).toContain('db_subs');
    expect(logged).toContain('db_posts');

    logSpy.mockRestore();
  });
});
