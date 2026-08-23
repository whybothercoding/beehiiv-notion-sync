import { Client, APIErrorCode, APIResponseError } from '@notionhq/client';
import {
  fetchExistingIds,
  findPageByProperty,
  createPage,
  updatePage,
  upsertByExternalId,
} from '../../src/notion/client';
import { NotionApiError } from '../../src/errors';

function makeMockPage(pageId: string, propertyName: string, propertyValue: string) {
  return {
    object: 'page' as const,
    id: pageId,
    url: `https://notion.so/${pageId}`,
    created_time: '2024-01-01T00:00:00.000Z',
    last_edited_time: '2024-01-01T00:00:00.000Z',
    created_by: { object: 'user' as const, id: 'user-1' },
    last_edited_by: { object: 'user' as const, id: 'user-1' },
    cover: null,
    icon: null,
    parent: { type: 'database_id' as const, database_id: 'db-123' },
    archived: false,
    in_trash: false,
    properties: {
      [propertyName]: {
        type: 'rich_text' as const,
        id: 'prop-id',
        rich_text: [
          {
            type: 'text' as const,
            text: { content: propertyValue, link: null },
            annotations: {
              bold: false,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false,
              color: 'default' as const,
            },
            plain_text: propertyValue,
            href: null,
          },
        ],
      },
    },
    public_url: null,
  };
}

function makeMockNotion(pages: ReturnType<typeof makeMockPage>[]): Client {
  return {
    databases: {
      query: jest.fn().mockResolvedValue({
        object: 'list',
        results: pages,
        has_more: false,
        next_cursor: null,
        type: 'page_or_database',
        page_or_database: {},
      }),
    },
  } as unknown as Client;
}

describe('fetchExistingIds', () => {
  it('returns an empty map when the database has no records', async () => {
    const map = await fetchExistingIds(makeMockNotion([]), 'db-123', 'BeehiivId');
    expect(map.size).toBe(0);
  });
  it('maps external ID to Notion page ID', async () => {
    const map = await fetchExistingIds(
      makeMockNotion([makeMockPage('page-1', 'BeehiivId', 'sub_abc')]),
      'db-123',
      'BeehiivId'
    );
    expect(map.get('sub_abc')).toBe('page-1');
  });
  it('maps multiple records', async () => {
    const map = await fetchExistingIds(
      makeMockNotion([
        makeMockPage('page-1', 'BeehiivId', 'sub_aaa'),
        makeMockPage('page-2', 'BeehiivId', 'sub_bbb'),
        makeMockPage('page-3', 'BeehiivId', 'sub_ccc'),
      ]),
      'db-123',
      'BeehiivId'
    );
    expect(map.size).toBe(3);
    expect(map.get('sub_bbb')).toBe('page-2');
  });
  it('ignores pages where the property is missing', async () => {
    const map = await fetchExistingIds(
      makeMockNotion([makeMockPage('page-1', 'OtherProp', 'value')]),
      'db-123',
      'BeehiivId'
    );
    expect(map.size).toBe(0);
  });

  it('wraps a Notion API error as a typed NotionApiError', async () => {
    const apiError = new APIResponseError({
      code: APIErrorCode.ObjectNotFound,
      status: 404,
      message: 'Could not find database',
      headers: {},
      rawBodyText: '{}',
    });
    const notion = {
      databases: { query: jest.fn().mockRejectedValue(apiError) },
    } as unknown as Client;

    await expect(fetchExistingIds(notion, 'db-123', 'BeehiivId')).rejects.toThrow(NotionApiError);

    let caught: unknown;
    try {
      await fetchExistingIds(notion, 'db-123', 'BeehiivId');
    } catch (error) {
      caught = error;
    }
    expect((caught as NotionApiError).notionCode).toBe(APIErrorCode.ObjectNotFound);
    expect((caught as NotionApiError).cause).toBe(apiError);
  });

  it('rethrows a non-Notion error unchanged', async () => {
    const boom = new Error('network exploded');
    const notion = {
      databases: { query: jest.fn().mockRejectedValue(boom) },
    } as unknown as Client;

    await expect(fetchExistingIds(notion, 'db-123', 'BeehiivId')).rejects.toBe(boom);
  });
});

describe('findPageByProperty', () => {
  it('returns the first matching page', async () => {
    const notion = makeMockNotion([makeMockPage('page-1', 'BeehiivId', 'sub_abc')]);
    const page = await findPageByProperty(notion, 'db-123', 'BeehiivId', 'sub_abc');
    expect(page?.id).toBe('page-1');
  });

  it('returns null when no page matches', async () => {
    const notion = makeMockNotion([]);
    const page = await findPageByProperty(notion, 'db-123', 'BeehiivId', 'sub_missing');
    expect(page).toBeNull();
  });
});

describe('createPage / updatePage', () => {
  it('createPage returns the new page id', async () => {
    const notion = {
      pages: { create: jest.fn().mockResolvedValue({ id: 'page-new' }) },
    } as unknown as Client;
    const id = await createPage(notion, 'db-123', {
      Email: { title: [{ text: { content: 'a@example.com' } }] },
    });
    expect(id).toBe('page-new');
  });

  it('updatePage calls pages.update with the page id and properties', async () => {
    const update = jest.fn().mockResolvedValue({});
    const notion = { pages: { update } } as unknown as Client;
    await updatePage(notion, 'page-1', {
      Email: { title: [{ text: { content: 'a@example.com' } }] },
    });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ page_id: 'page-1' }));
  });
});

describe('upsertByExternalId', () => {
  it('updates an existing page', async () => {
    const update = jest.fn().mockResolvedValue({});
    const notion = {
      databases: {
        query: jest.fn().mockResolvedValue({
          object: 'list',
          results: [makeMockPage('page-1', 'BeehiivId', 'sub_abc')],
          has_more: false,
          next_cursor: null,
        }),
      },
      pages: { update, create: jest.fn() },
    } as unknown as Client;

    const outcome = await upsertByExternalId(notion, 'db-123', 'BeehiivId', 'sub_abc', {
      Email: { title: [{ text: { content: 'a@example.com' } }] },
    });
    expect(outcome).toBe('updated');
    expect(update).toHaveBeenCalled();
  });

  it('creates a page when none matches', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'page-new' });
    const notion = {
      databases: {
        query: jest
          .fn()
          .mockResolvedValue({ object: 'list', results: [], has_more: false, next_cursor: null }),
      },
      pages: { create, update: jest.fn() },
    } as unknown as Client;

    const outcome = await upsertByExternalId(notion, 'db-123', 'BeehiivId', 'sub_new', {
      Email: { title: [{ text: { content: 'a@example.com' } }] },
    });
    expect(outcome).toBe('created');
    expect(create).toHaveBeenCalled();
  });
});
