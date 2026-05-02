import { Client, isFullPage } from '@notionhq/client';
import type {
  PageObjectResponse,
  QueryDatabaseParameters,
} from '@notionhq/client/build/src/api-endpoints';
import type { NotionPropertyValue } from './types';

export function createNotionClient(apiKey: string): Client {
  return new Client({ auth: apiKey });
}

export async function queryDatabase(
  notion: Client,
  databaseId: string,
  filter?: QueryDatabaseParameters['filter']
): Promise<PageObjectResponse[]> {
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const page of response.results) {
      if (isFullPage(page)) {
        pages.push(page);
      }
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return pages;
}

export async function findPageByProperty(
  notion: Client,
  databaseId: string,
  propertyName: string,
  value: string
): Promise<PageObjectResponse | null> {
  const filter: QueryDatabaseParameters['filter'] = {
    property: propertyName,
    rich_text: { equals: value },
  };

  const pages = await queryDatabase(notion, databaseId, filter);
  return pages[0] ?? null;
}

export async function createPage(
  notion: Client,
  databaseId: string,
  properties: Record<string, NotionPropertyValue>
): Promise<string> {
  const response = await notion.pages.create({
    parent: { database_id: databaseId },
    properties: properties as Parameters<typeof notion.pages.create>[0]['properties'],
  });
  return response.id;
}

export async function updatePage(
  notion: Client,
  pageId: string,
  properties: Record<string, NotionPropertyValue>
): Promise<void> {
  await notion.pages.update({
    page_id: pageId,
    properties: properties as Parameters<typeof notion.pages.update>[0]['properties'],
  });
}

export async function upsertByExternalId(
  notion: Client,
  databaseId: string,
  idProperty: string,
  idValue: string,
  properties: Record<string, NotionPropertyValue>
): Promise<'created' | 'updated'> {
  const existing = await findPageByProperty(
    notion,
    databaseId,
    idProperty,
    idValue
  );

  if (existing) {
    await updatePage(notion, existing.id, properties);
    return 'updated';
  }

  await createPage(notion, databaseId, properties);
  return 'created';
}
