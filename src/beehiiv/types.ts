// Re-exported from schemas.ts, which is the single source of truth: these
// types are inferred from the zod schemas that validate every API response
// at runtime, so the compile-time shape and the runtime-checked shape can
// never drift apart.
export type { BeehiivSubscriber, BeehiivPost, BeehiivPostStats } from './schemas';

export interface BeehiivPaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
  totalResults: number | null;
}
