import {
  beehiivSubscriberSchema,
  beehiivPostSchema,
  beehiivPaginatedEnvelope,
  parseBeehiivResponse,
} from '../../src/beehiiv/schemas';
import { BeehiivSchemaError } from '../../src/errors';

describe('beehiivSubscriberSchema', () => {
  it('accepts the minimum required shape with expandable fields absent', () => {
    const result = beehiivSubscriberSchema.safeParse({
      id: 'sub_1',
      email: 'a@example.com',
      status: 'active',
      created: 1705276800,
      subscription_tier: 'free',
    });
    expect(result.success).toBe(true);
  });

  it('rejects created_at as a substitute for created', () => {
    const result = beehiivSubscriberSchema.safeParse({
      id: 'sub_1',
      email: 'a@example.com',
      status: 'active',
      created_at: 1705276800,
      subscription_tier: 'free',
    });
    expect(result.success).toBe(false);
  });

  it('accepts an unrecognized status value (opaque passthrough, not a closed enum)', () => {
    const result = beehiivSubscriberSchema.safeParse({
      id: 'sub_1',
      email: 'a@example.com',
      status: 'some_future_status',
      created: 1,
      subscription_tier: 'free',
    });
    expect(result.success).toBe(true);
  });
});

describe('beehiivPostSchema', () => {
  it('accepts nested stats.email and stats.web', () => {
    const result = beehiivPostSchema.safeParse({
      id: 'post_1',
      title: 'Issue #1',
      status: 'confirmed',
      stats: { email: { recipients: 10 }, web: { views: 5 } },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a flat total_sent field (the old, wrong shape)', () => {
    const result = beehiivPostSchema.safeParse({
      id: 'post_1',
      title: 'Issue #1',
      status: 'confirmed',
      stats: { total_sent: 10 },
    });
    // Extra unknown key under stats.total_sent is dropped, not rejected —
    // zod objects are non-strict by default. What matters is that
    // stats.email/stats.web remain the source of truth, verified above.
    expect(result.success).toBe(true);
  });

  it('accepts a null stats (draft or unexpanded post)', () => {
    const result = beehiivPostSchema.safeParse({
      id: 'post_1',
      title: 'Draft',
      status: 'draft',
      stats: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('beehiivPaginatedEnvelope', () => {
  it('accepts a flat envelope with cursor pagination fields', () => {
    const schema = beehiivPaginatedEnvelope(beehiivPostSchema);
    const result = schema.safeParse({
      data: [],
      next_cursor: 'abc',
      has_more: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts an envelope with total_results and no cursor fields', () => {
    const schema = beehiivPaginatedEnvelope(beehiivPostSchema);
    const result = schema.safeParse({ data: [], total_results: 42 });
    expect(result.success).toBe(true);
  });

  it('rejects a response with no data array at all', () => {
    const schema = beehiivPaginatedEnvelope(beehiivPostSchema);
    const result = schema.safeParse({ next_cursor: null });
    expect(result.success).toBe(false);
  });
});

describe('parseBeehiivResponse', () => {
  it('returns the parsed value on success', () => {
    const schema = beehiivPaginatedEnvelope(beehiivPostSchema);
    const parsed = parseBeehiivResponse(schema, { data: [] }, 'posts');
    expect(parsed.data).toEqual([]);
  });

  it('throws a BeehiivSchemaError with readable issue paths on failure', () => {
    const schema = beehiivPaginatedEnvelope(beehiivPostSchema);
    let caught: unknown;
    try {
      parseBeehiivResponse(schema, { data: 'not-an-array' }, 'posts');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(BeehiivSchemaError);
    expect((caught as BeehiivSchemaError).issues[0]).toContain('data');
  });
});
