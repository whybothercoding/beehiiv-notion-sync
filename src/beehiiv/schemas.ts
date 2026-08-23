import { z } from 'zod';
import { BeehiivSchemaError } from '../errors';

// Field names verified against https://developers.beehiiv.com/api-reference
// (2026-08-23). The Beehiiv API has no published OpenAPI/JSON schema, so this
// is the single source of truth for what we actually expect back — it turns
// silent API drift into a loud, typed failure instead of null-filled Notion
// pages.

const beehiivCustomFieldSchema = z.object({
  name: z.string().optional(),
  kind: z.string().optional(),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
});

// `status`/`subscription_tier` are intentionally z.string() rather than a
// closed enum: the app treats them as opaque values passed straight into a
// Notion select (which auto-creates the option), so a new value Beehiiv adds
// later should not fail the whole sync.
export const beehiivSubscriberSchema = z.object({
  id: z.string(),
  email: z.string(),
  status: z.string(),
  created: z.number(), // Unix seconds — NOT `created_at`
  subscription_tier: z.string(),
  utm_source: z.string().nullable().optional(),
  utm_medium: z.string().nullable().optional(),
  utm_campaign: z.string().nullable().optional(),
  // Only present when the request includes `expand[]=tags`.
  tags: z.array(z.string()).optional(),
  // Only present when the request includes `expand[]=custom_fields`
  // (we don't request it today — kept for forward compatibility).
  custom_fields: z.array(beehiivCustomFieldSchema).optional(),
});

const beehiivPostStatsEmailSchema = z.object({
  recipients: z.number().optional(),
  opens: z.number().optional(),
  open_rate: z.number().optional(),
  clicks: z.number().optional(),
  click_rate: z.number().optional(),
  unsubscribes: z.number().optional(),
});

const beehiivPostStatsWebSchema = z.object({
  views: z.number().optional(),
  clicks: z.number().optional(),
});

export const beehiivPostSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().nullable().optional(),
  status: z.string(),
  publish_date: z.number().nullable().optional(),
  web_url: z.string().nullable().optional(),
  // Nested under stats.email / stats.web — NOT flat stats.total_sent etc.
  // Only present when the request includes `expand[]=stats`.
  stats: z
    .object({
      email: beehiivPostStatsEmailSchema.optional(),
      web: beehiivPostStatsWebSchema.optional(),
    })
    .nullable()
    .optional(),
});

export function beehiivPaginatedEnvelope<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    // Pagination fields are flat siblings of `data`, not nested under a
    // "pagination" key.
    next_cursor: z.string().nullable().optional(),
    has_more: z.boolean().optional(),
    total_results: z.number().optional(),
  });
}

export const beehiivSubscribersEnvelopeSchema = beehiivPaginatedEnvelope(beehiivSubscriberSchema);
export const beehiivPostsEnvelopeSchema = beehiivPaginatedEnvelope(beehiivPostSchema);

export type BeehiivSubscriber = z.infer<typeof beehiivSubscriberSchema>;
export type BeehiivPost = z.infer<typeof beehiivPostSchema>;
export type BeehiivPostStats = NonNullable<BeehiivPost['stats']>;

export function parseBeehiivResponse<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  context: string
): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`
    );
    throw new BeehiivSchemaError(`Unexpected Beehiiv API response shape (${context})`, issues);
  }
  return result.data;
}
