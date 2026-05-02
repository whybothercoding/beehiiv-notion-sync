# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build        # Compile TypeScript → dist/
npm run dev          # Run directly with ts-node (no build needed)
npm start            # Run compiled output from dist/
npm test             # Run unit tests (Jest)
npm run test:watch   # Run tests in watch mode
```

To run a single test file:
```bash
npx jest tests/notion/types.test.ts --verbose
```

To run a single named test:
```bash
npx jest --testNamePattern="dateProp converts"
```

To invoke CLI commands without building:
```bash
npx ts-node src/index.ts setup --parent-page-id <id>
npx ts-node src/index.ts sync [--subscribers] [--posts] [--dry-run]
npx ts-node src/index.ts start
```

There is no linter configured.

## Architecture

CLI tool built with Commander. Three commands: `setup`, `sync`, `start`.

**Data flow:**
1. `setup` — creates the two Notion databases (Subscribers, Posts) under a given parent page and prints the DB IDs to add to `.env`
2. `sync` — fetches all records from Beehiiv (cursor-paginated), maps them to Notion property shapes, then upserts. `--dry-run` fetches but skips all Notion writes
3. `start` — runs `sync` immediately then schedules it on a cron derived from `SYNC_INTERVAL_HOURS`

**Module layout:**
- `src/config.ts` — env loading; `loadSetupConfig()` requires 3 vars, `loadConfig()` requires all 5. `SYNC_INTERVAL_HOURS` is guarded against `NaN`/non-positive values, falling back to 6
- `src/beehiiv/client.ts` — cursor-paginated fetchers (`getAllSubscribers`, `getAllPosts`); posts fetch with `expand[]=stats`
- `src/beehiiv/types.ts` — raw Beehiiv API shapes
- `src/notion/types.ts` — Notion property builder functions (`titleProp`, `richTextProp`, `selectProp`, etc.), typed `SubscriberProperties` / `PostProperties` interfaces, and the `NotionPropertyValue` union type. Both property interfaces extend `Record<string, NotionPropertyValue>` so they pass to `createPage`/`updatePage` without casts
- `src/notion/client.ts` — thin wrappers over `@notionhq/client`. `fetchExistingIds` does a single paginated query of the database and returns `Map<externalId, notionPageId>` — call this once per sync run instead of querying per record. `upsertByExternalId` is retained for external use but is no longer used internally
- `src/notion/setup.ts` — creates the two databases with the exact property schema expected by the sync mappers
- `src/sync/subscribers.ts` and `src/sync/posts.ts` — orchestrate fetch → bulk lookup → upsert loop with an `ora` spinner. Both use `RateLimiter(3, 350ms)` + `withRetry(3, 1000ms)`. Failures surface via `spinner.warn` with record identity (email / post title), not silently swallowed
- `src/sync/utils.ts` — `RateLimiter` (concurrency queue with inter-request delay) and `withRetry` (exponential backoff, honours `Retry-After` on 429s)
- `src/scheduler.ts` — wraps sync in a `node-cron` schedule

**Test layout** (`tests/` mirrors `src/`):
- `tests/notion/types.test.ts` — all 7 property builder functions, including edge cases (null, undefined, zero)
- `tests/notion/client.test.ts` — `fetchExistingIds` with a mocked Notion client
- `tests/sync/utils.test.ts` — `withRetry` (retry count, last-error rethrow) and `RateLimiter` (concurrency ceiling, full queue drain)
- `tests/sync/mappers.test.ts` — `mapSubscriberToNotion` and `mapPostToNotion`, including null fields and zero stats
- `tests/config.test.ts` — `loadSetupConfig` and `loadConfig` with mocked `process.env`, including whitespace-only and non-numeric env var cases

**Notion upsert key convention:** Subscribers are keyed on `BeehiivId` (rich_text); posts on `BeehiivPostId` (rich_text). The property name must exactly match what `setup` created and what `fetchExistingIds` queries by.

**Rate limiting:** Notion API is throttled at 3 concurrent requests with 350ms between completions. Beehiiv pagination uses 100 items/page for subscribers and 50/page for posts (posts include stats expansion).
