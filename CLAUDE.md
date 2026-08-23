# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build          # Compile TypeScript → dist/
npm run dev             # Run directly with ts-node (no build needed)
npm start                # Run compiled output from dist/
npm test                  # Run unit tests (Jest)
npm run test:watch         # Run tests in watch mode
npm run test:coverage       # Run tests with a coverage report (thresholds enforced, see jest.config.ts)
npm run lint                 # ESLint (flat config, eslint.config.mjs)
npm run lint:fix               # ESLint with --fix
npm run format                   # Prettier --write
npm run format:check               # Prettier --check
npm run typecheck                    # tsc --noEmit
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
npx ts-node src/index.ts sync [--subscribers] [--posts] [--dry-run] [--force] [--json] [--concurrency <n>] [--rate-limit-ms <ms>]
npx ts-node src/index.ts start
```

A pre-commit hook (Husky + lint-staged, `.husky/pre-commit`) runs lint/format on staged files and a full `tsc --noEmit` before every commit. CI (`.github/workflows/ci.yml`) runs lint, format check, typecheck, build, and the full test suite with coverage thresholds on Node 18/20/22.

## Architecture

CLI tool built with Commander. Three commands: `setup`, `sync`, `start`.

**Data flow:**

1. `setup` — creates the two Notion databases (Subscribers, Posts) under a given parent page and prints the DB IDs to add to `.env`
2. `sync` — fetches all records from Beehiiv (cursor-paginated), validates the response shape with zod, maps them to Notion property shapes, hashes each mapped record and skips the Notion write if unchanged since the last sync, then upserts. `--dry-run` fetches but skips all Notion writes and the state file; `--force` bypasses the unchanged-record skip
3. `start` — runs `sync` immediately then schedules it on a cron derived from `SYNC_INTERVAL_HOURS`; `SIGINT`/`SIGTERM` stop the cron schedule and wait for any in-progress sync to finish before exiting

**Beehiiv API field names — verified against the live API reference (2026-08-23), not assumed:**

- Pagination is a flat envelope: `data`, `next_cursor`, `has_more`, `total_results` — **not** nested under a `pagination` key, and **not** camelCase (`nextCursor`/`total`, which is what the code used to read before this was verified — pagination silently stopped after page 1 on every sync as a result).
- A subscriber's creation timestamp field is `created`, **not** `created_at`.
- A subscriber's `tags` and `custom_fields` are only present in the response when the request includes `expand[]=tags` / `expand[]=custom_fields`. This tool requests `expand[]=tags`; `custom_fields` is validated by the schema but not requested or synced.
- A post's engagement numbers are nested under `stats.email.*` (recipients, opens, open_rate, clicks, click_rate, unsubscribes, ...) and `stats.web.*` (views, clicks) — **not** a flat `stats.total_sent` etc. `stats` itself is only present with `expand[]=stats`, which this tool always requests.
- Subscriber `status` has 7 real values (`validating`, `invalid`, `pending`, `active`, `inactive`, `needs_attention`, `paused`), not the 3 this repo assumed pre-verification.

All of the above is enforced by the zod schemas in `src/beehiiv/schemas.ts` — a future API shape change fails the sync loudly (`BeehiivSchemaError`) instead of silently writing nulls to Notion. Re-verify against `https://developers.beehiiv.com/api-reference` (the `.md` suffix on any reference page returns clean markdown) before changing these schemas, rather than trusting memory.

**Module layout:**

- `src/config.ts` — env loading; `loadSetupConfig()` requires 3 vars, `loadConfig()` requires the 5 core vars plus optional `NOTION_CONCURRENCY` (default 3), `NOTION_RATE_LIMIT_MS` (default 350), `SYNC_STATE_FILE` (default `.sync-state.json`). `SYNC_INTERVAL_HOURS` and the two Notion tuning vars are guarded against `NaN`/non-positive values via `positiveIntEnv`
- `src/errors.ts` — typed error hierarchy (`SyncError` base; `ConfigError`, `BeehiivApiError` with `.status`, `BeehiivSchemaError` with `.issues`, `NotionApiError` with `.notionCode`), all using the ES2022 `Error` `cause` option (hence `tsconfig.json` targets `ES2022`, not `ES2020`)
- `src/beehiiv/schemas.ts` — zod schemas for the subscriber/post/pagination-envelope shapes (source of truth); `parseBeehiivResponse` turns a validation failure into a `BeehiivSchemaError` with per-field issue messages
- `src/beehiiv/types.ts` — re-exports `z.infer` types from `schemas.ts`, plus the internal `BeehiivPaginatedResponse<T>` normalized-fetch-result shape (camelCase `nextCursor`/`hasMore`/`totalResults` — this is our own abstraction, not the raw API envelope)
- `src/beehiiv/client.ts` — cursor-paginated fetchers (`getAllSubscribers`, `getAllPosts`); subscriptions fetch with `expand[]=tags`, posts with `expand[]=stats`; every response is parsed through the zod schemas; HTTP failures are wrapped as `BeehiivApiError`
- `src/notion/types.ts` — Notion property builder functions (`titleProp`, `richTextProp`, `selectProp`, etc.), typed `SubscriberProperties` / `PostProperties` interfaces, and the `NotionPropertyValue` union type. Text-family builders truncate to Notion's 2000-char rich_text limit; `multiSelectProp` caps at Notion's 100-option limit; `selectProp`/`multiSelectProp` replace commas in option names (unsupported by the Notion API). Both property interfaces extend `Record<string, NotionPropertyValue>` so they pass to `createPage`/`updatePage` without casts
- `src/notion/client.ts` — thin wrappers over `@notionhq/client`, all Notion client errors rethrown as `NotionApiError` via `withNotionError`. `fetchExistingIds` does a single paginated query of the database and returns `Map<externalId, notionPageId>` — call this once per sync run instead of querying per record. `upsertByExternalId`/`findPageByProperty` are retained for external use but are no longer used internally
- `src/notion/setup.ts` — creates the two databases with the exact property schema expected by the sync mappers, including the `WebViews`/`WebClicks` post columns
- `src/sync/state.ts` — `loadSyncState`/`saveSyncState` (JSON file, missing/corrupt file → empty state, never a thrown error) and `hashProperties` (stable sha256 of a mapped-properties object, key order independent) — the unchanged-record skip mechanism
- `src/sync/subscribers.ts` and `src/sync/posts.ts` — orchestrate fetch → bulk lookup → hash-compare → upsert loop with an `ora` spinner (or a no-op spinner in `quiet`/`--json` mode). Concurrency/rate-limit are read from `SyncOptions` and fall back to config. Both use `withRetry(3, 1000ms)` per record. Failures surface via `spinner.warn` with record identity (email / post title) and are counted, not silently swallowed or allowed to abort the batch
- `src/sync/utils.ts` — `RateLimiter` (concurrency queue with inter-request delay), `withRetry` (exponential backoff, honours `Retry-After` on 429s), `createSpinner`/`Spinner` (real `ora` or a no-op `NullSpinner` for quiet mode), and the shared `SyncOptions`/`SyncResult` types
- `src/scheduler.ts` — wraps sync in a `node-cron` schedule; clamps an hour interval above 23 (node-cron's hour field is 0-23) rather than emitting an invalid cron expression; registers `SIGINT`/`SIGTERM` handlers that stop the cron task and await any in-flight sync before `process.exit(0)`

**Test layout** (`tests/` mirrors `src/`):

- `tests/beehiiv/schemas.test.ts` — zod schema acceptance/rejection cases (wrong field names, unrecognized-but-valid enum values, both pagination envelope styles) and `parseBeehiivResponse` error shape
- `tests/beehiiv/client.test.ts` — pagination envelope parsing, cursor/expand query params (via `axios-mock-adapter`), multi-page `getAllSubscribers`/`getAllPosts`, `BeehiivApiError`/`BeehiivSchemaError` on failure
- `tests/notion/types.test.ts` — all property builder functions including the 2000-char truncation, 100-option cap, and comma-sanitization edge cases
- `tests/notion/client.test.ts` — `fetchExistingIds`, `findPageByProperty`, `createPage`/`updatePage`, `upsertByExternalId`, and the `NotionApiError` wrapping path, all with a mocked Notion client
- `tests/notion/setup.test.ts` — both database creators' property schemas, plus `runSetup` with a mocked `@notionhq/client` `Client` constructor
- `tests/sync/utils.test.ts` — `withRetry` (retry count, last-error rethrow) and `RateLimiter` (concurrency ceiling, full queue drain)
- `tests/sync/mappers.test.ts` — `mapSubscriberToNotion` and `mapPostToNotion`, including null fields, zero/missing stats, and the nested `stats.email`/`stats.web` shape
- `tests/sync/state.test.ts` — state file round-trip, missing/corrupt file handling, `hashProperties` stability
- `tests/sync/subscribers.test.ts` / `tests/sync/posts.test.ts` — full orchestration with mocked Beehiiv/Notion clients: create, update, skip-when-unchanged, `--force`, dry-run, and a failure that's counted without aborting the batch
- `tests/scheduler.test.ts` — immediate-sync-on-startup, the interval-clamp, SIGINT stop-and-wait, no-new-sync-after-shutdown, and both sync-rejection paths, with `node-cron` and the sync modules mocked
- `tests/errors.test.ts` — typed error class identity, `.status`/`.notionCode`/`.issues`, and `cause` propagation
- `tests/config.test.ts` — `loadSetupConfig` and `loadConfig` with mocked `process.env`, including whitespace-only, non-numeric, and the new optional-var cases

`src/index.ts` (CLI wiring) is intentionally excluded from coverage collection (`jest.config.ts`) — it's Commander flag parsing and `process.exit` calls, exercised by hand via the documented CLI commands rather than unit tests.

**Notion upsert key convention:** Subscribers are keyed on `BeehiivId` (rich_text); posts on `BeehiivPostId` (rich_text). The property name must exactly match what `setup` created and what `fetchExistingIds` queries by.

**Rate limiting:** Notion API defaults to 3 concurrent requests with 350ms between completions, overridable via `NOTION_CONCURRENCY`/`NOTION_RATE_LIMIT_MS` or `sync --concurrency`/`--rate-limit-ms`. Beehiiv pagination uses 100 items/page for subscribers and 50/page for posts.

**Unchanged-record skip:** each sync hashes a record's mapped Notion properties (`hashProperties` in `src/sync/state.ts`) and compares it against the last-known hash for that external ID, persisted in `SYNC_STATE_FILE`. If unchanged and the Notion page already exists, the write is skipped — no Notion API call — which is the actual perf lever for repeat syncs, since Notion writes (not the Beehiiv fetch) are what's rate-limited. `--force` bypasses this.
