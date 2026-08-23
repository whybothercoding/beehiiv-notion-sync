import type { AxiosInstance } from 'axios';
import axios, { isAxiosError } from 'axios';
import {
  beehiivSubscribersEnvelopeSchema,
  beehiivPostsEnvelopeSchema,
  parseBeehiivResponse,
} from './schemas';
import type { BeehiivSubscriber, BeehiivPost, BeehiivPaginatedResponse } from './types';
import { BeehiivApiError } from '../errors';

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

function buildParams(limit: number, cursor: string | undefined, expand: string[]): URLSearchParams {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (cursor) params.set('cursor', cursor);
  for (const field of expand) params.append('expand[]', field);
  return params;
}

async function get<T>(
  client: AxiosInstance,
  url: string,
  params: URLSearchParams,
  context: string
): Promise<T> {
  try {
    const response = await client.get(url, { params });
    return response.data as T;
  } catch (error) {
    if (isAxiosError(error)) {
      throw new BeehiivApiError(
        `Beehiiv API request failed (${context}): ${error.response?.status ?? 'network error'} ${error.message}`,
        error.response?.status,
        { cause: error }
      );
    }
    throw error;
  }
}

export async function getSubscribers(
  apiKey: string,
  publicationId: string,
  cursor?: string
): Promise<BeehiivPaginatedResponse<BeehiivSubscriber>> {
  const client = createAxiosInstance(apiKey);
  const params = buildParams(100, cursor, ['tags']);

  const raw = await get<unknown>(
    client,
    `/publications/${publicationId}/subscriptions`,
    params,
    'subscriptions'
  );
  const parsed = parseBeehiivResponse(beehiivSubscribersEnvelopeSchema, raw, 'subscriptions');

  return {
    data: parsed.data,
    nextCursor: parsed.next_cursor ?? null,
    hasMore: parsed.has_more ?? false,
    totalResults: parsed.total_results ?? null,
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
  const params = buildParams(50, cursor, ['stats']);

  const raw = await get<unknown>(client, `/publications/${publicationId}/posts`, params, 'posts');
  const parsed = parseBeehiivResponse(beehiivPostsEnvelopeSchema, raw, 'posts');

  return {
    data: parsed.data,
    nextCursor: parsed.next_cursor ?? null,
    hasMore: parsed.has_more ?? false,
    totalResults: parsed.total_results ?? null,
  };
}

export async function getAllPosts(apiKey: string, publicationId: string): Promise<BeehiivPost[]> {
  const all: BeehiivPost[] = [];
  let cursor: string | undefined;

  do {
    const page = await getPosts(apiKey, publicationId, cursor);
    all.push(...page.data);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  return all;
}
