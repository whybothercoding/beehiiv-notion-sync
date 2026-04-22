import axios, { AxiosInstance } from 'axios';
import {
  BeehiivSubscriber,
  BeehiivPost,
  BeehiivPaginatedResponse,
} from './types';

function createAxiosInstance(apiKey: string): AxiosInstance {
  return axios.create({
    baseURL: 'https://api.beehiiv.com/v2',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });
}

export async function getSubscribers(
  apiKey: string,
  publicationId: string,
  cursor?: string
): Promise<BeehiivPaginatedResponse<BeehiivSubscriber>> {
  const client = createAxiosInstance(apiKey);
  const params: Record<string, string | number> = { limit: 100 };
  if (cursor) params['cursor'] = cursor;

  const response = await client.get(
    `/publications/${publicationId}/subscriptions`,
    { params }
  );

  const raw = response.data;
  return {
    data: raw.data as BeehiivSubscriber[],
    nextCursor: raw.nextCursor ?? null,
    total: raw.total ?? 0,
  };
}

export async function getAllSubscribers(
  apiKey: string,
  publicationId: string
): Promise<BeehiivSubscriber[]> {
  const all: BeehiivSubscriber[] = [];
  let cursor: string | undefined;

  do {
    const page = await getSubscribers(apiKey, publicationId, cursor);
    all.push(...page.data);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  return all;
}

export async function getPosts(
  apiKey: string,
  publicationId: string,
  cursor?: string
): Promise<BeehiivPaginatedResponse<BeehiivPost>> {
  const client = createAxiosInstance(apiKey);
  const params: Record<string, string | number> = {
    limit: 50,
    'expand[]': 'stats',
  };
  if (cursor) params['cursor'] = cursor;

  const response = await client.get(
    `/publications/${publicationId}/posts`,
    { params }
  );

  const raw = response.data;
  return {
    data: raw.data as BeehiivPost[],
    nextCursor: raw.nextCursor ?? null,
    total: raw.total ?? 0,
  };
}

export async function getAllPosts(
  apiKey: string,
  publicationId: string
): Promise<BeehiivPost[]> {
  const all: BeehiivPost[] = [];
  let cursor: string | undefined;

  do {
    const page = await getPosts(apiKey, publicationId, cursor);
    all.push(...page.data);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  return all;
}
