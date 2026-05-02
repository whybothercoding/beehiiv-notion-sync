import { Client } from '@notionhq/client';
import { fetchExistingIds } from '../../src/notion/client';

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
        rich_text: [{
          type: 'text' as const,
          text: { content: propertyValue, link: null },
          annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default' as const },
          plain_text: propertyValue,
          href: null,
        }],
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
    const map = await fetchExistingIds(makeMockNotion([makeMockPage('page-1', 'BeehiivId', 'sub_abc')]), 'db-123', 'BeehiivId');
    expect(map.get('sub_abc')).toBe('page-1');
  });
  it('maps multiple records', async () => {
    const map = await fetchExistingIds(makeMockNotion([
      makeMockPage('page-1', 'BeehiivId', 'sub_aaa'),
      makeMockPage('page-2', 'BeehiivId', 'sub_bbb'),
      makeMockPage('page-3', 'BeehiivId', 'sub_ccc'),
    ]), 'db-123', 'BeehiivId');
    expect(map.size).toBe(3);
    expect(map.get('sub_bbb')).toBe('page-2');
  });
  it('ignores pages where the property is missing', async () => {
    const map = await fetchExistingIds(makeMockNotion([makeMockPage('page-1', 'OtherProp', 'value')]), 'db-123', 'BeehiivId');
    expect(map.size).toBe(0);
  });
});
