# Changelog

All notable changes to this project are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0] - 2026-08-23

### Fixed

- **Pagination silently stopped after the first page.** The Beehiiv API returns pagination fields as flat, snake_case keys (`next_cursor`, `has_more`) — the code read camelCase `raw.nextCursor`, which is never present, so `getAllSubscribers`/`getAllPosts` only ever fetched the first 100 subscribers / 50 posts on every sync.
- **Subscriber `SubscribedAt` was always empty.** The Beehiiv field is `created`, not `created_at`.
- **Subscriber `Tags` was always empty.** Beehiiv only returns `tags` when the request includes `expand[]=tags`; the request wasn't sending it.
- **All post stats (`TotalSent`, `Opens`, `OpenRate`, `Clicks`, `ClickRate`, `Unsubscribes`) synced as empty.** Beehiiv nests these under `stats.email.*` (and web metrics under `stats.web.*`), not a flat `stats.*`.

All four were verified against the live Beehiiv API reference, not assumed — see `CLAUDE.md` for the specifics.

### Added

- Runtime response validation (zod) for every Beehiiv API call — a future field-name/shape drift now fails the sync loudly (`BeehiivSchemaError`) instead of silently writing nulls to Notion.
- Typed error hierarchy (`ConfigError`, `BeehiivApiError`, `BeehiivSchemaError`, `NotionApiError`) with proper `cause` chaining.
- Unchanged-record skip: a sync hashes each record's mapped Notion properties and skips the Notion write entirely when nothing changed since the last run (state cached in `.sync-state.json`, configurable via `SYNC_STATE_FILE`). `sync --force` bypasses it.
- `sync --concurrency <n>` / `--rate-limit-ms <ms>` — override Notion request throttling per run (also configurable via `NOTION_CONCURRENCY`/`NOTION_RATE_LIMIT_MS`).
- `sync --json` — machine-readable summary output, with progress spinners suppressed so stdout stays clean for piping.
- Graceful shutdown for `start`: `SIGINT`/`SIGTERM` stop the cron schedule and wait for any in-progress sync to finish before exiting, instead of killing it mid-batch.
- New Posts database columns `WebViews`/`WebClicks` (from `stats.web.*`, now that it's parsed correctly).
- Defensive Notion write handling: rich_text/title/url content truncated to Notion's 2000-character limit, multi-select capped at Notion's 100-option limit, commas stripped from select/multi-select option names (unsupported by the Notion API).
- Docker support (`Dockerfile`, `docker-compose.yml`) for running `start` as a persistent service.
- ESLint (flat config) + Prettier, enforced via a Husky pre-commit hook and CI.
- GitHub Actions CI (lint, format check, typecheck, build, test with coverage — Node 18/20/22).
- Expanded test suite (13 suites, 100+ tests) covering the Beehiiv client, zod schemas, sync orchestration (including the skip/force paths), the scheduler's shutdown behavior, and typed errors — coverage thresholds enforced in CI.

### Changed

- `tsconfig.json` target bumped `ES2020` → `ES2022` (for the `Error` `cause` option used by the new typed errors).
- `axios` and `form-data` bumped to patch several disclosed high-severity advisories.

### Migration notes

- **Add `WebViews`/`WebClicks` to your existing Posts database** (or re-run `setup` for a fresh one) — new number properties, not auto-created by Notion.
- **No `--force` needed to pick up the pagination/field-name fixes.** The unchanged-record cache is itself new in this version, so it starts empty on your first post-upgrade sync — every record gets freshly re-written with the now-correct values regardless, then the cache takes over from there.
