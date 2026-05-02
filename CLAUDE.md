# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build        # Compile TypeScript → dist/
npm run dev          # Run directly with ts-node (no build needed)
npm start            # Run compiled output from dist/
```

There are no tests. There is no linter configured.

To run a specific command in dev mode:
```bash
npx ts-node src/index.ts setup --parent-page-id <id>
npx ts-node src/index.ts sync --subscribers
npx ts-node src/index.ts sync --posts
npx ts-node src/index.ts start
```

## Architecture

CLI tool built with Commander. Three commands: `setup`, `sync`, `start`.

**Data flow:**
1. `setup` — creates the two Notion databases (Subscribers, Posts) under a given parent page and prints the DB IDs to add to `.env`
2. `sync` — fetches all records from Beehiiv (cursor-paginated), maps them to Notion property shapes, and upserts each record into Notion using the Beehiiv ID as the idempotency key
3. `start` — runs `sync` immediately then schedules it on a cron derived from `SYNC_INTERVAL_HOURS`

**Module layout:**
- `src/config.ts` — env loading; `loadSetupConfig()` requires only 3 vars, `loadConfig()` requires all 5 + interval
- `src/beehiiv/client.ts` — cursor-paginated fetchers (`getAllSubscribers`, `getAllPosts`); posts fetch with `expand[]=stats`
- `src/beehiiv/types.ts` — raw Beehiiv API shapes
- `src/notion/client.ts` — thin wrappers over `@notionhq/client`; `upsertByExternalId` is the core write primitive (find-by-rich-text-property → create or update)
- `src/notion/setup.ts` — creates the two databases with the exact property schema expected by the sync mappers
- `src/notion/types.ts` — Notion property builder functions (`titleProp`, `richTextProp`, `selectProp`, etc.) and the typed `SubscriberProperties` / `PostProperties` interfaces
- `src/sync/subscribers.ts` and `src/sync/posts.ts` — orchestrate fetch → map → upsert with an `ora` spinner; both use `RateLimiter(3, 350ms)` + `withRetry(3, 1000ms)`
- `src/sync/utils.ts` — `RateLimiter` (concurrency queue with inter-request delay) and `withRetry` (exponential backoff, honours `Retry-After` on 429s)
- `src/scheduler.ts` — wraps sync in a `node-cron` schedule

**Notion upsert key convention:** Subscribers are keyed on `BeehiivId` (rich_text); posts on `BeehiivPostId` (rich_text). The property name must exactly match what `setup` created and what `upsertByExternalId` queries by.

**Rate limiting:** Notion API is throttled at 3 concurrent requests with 350ms between completions. Beehiiv pagination uses 100 items/page for subscribers and 50/page for posts (posts include stats expansion).
