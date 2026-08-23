# beehiiv-notion-sync

[![CI](https://github.com/whybothercoding/beehiiv-notion-sync/actions/workflows/ci.yml/badge.svg)](https://github.com/whybothercoding/beehiiv-notion-sync/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Statements](https://img.shields.io/badge/statements-96.15%25-brightgreen.svg?style=flat)
![Branches](https://img.shields.io/badge/branches-84.95%25-yellow.svg?style=flat)
![Functions](https://img.shields.io/badge/functions-92.59%25-brightgreen.svg?style=flat)
![Lines](https://img.shields.io/badge/lines-96.53%25-brightgreen.svg?style=flat)

Automatically sync your Beehiiv newsletter subscribers and post analytics into Notion databases. Run it once, schedule it, or run it in a container.

Every Beehiiv API field name and pagination behavior this tool relies on is verified against the [official API reference](https://developers.beehiiv.com/api-reference) and enforced at runtime with [zod](https://zod.dev) — a shape mismatch fails loudly instead of silently writing empty fields to Notion.

---

## What It Syncs

### Subscriber Fields

| Beehiiv Field       | Notion Property | Type                             |
| -------------------- | ---------------- | --------------------------------- |
| `email`               | Email             | Title                              |
| `status`               | Status            | Select — `validating` / `invalid` / `pending` / `active` / `inactive` / `needs_attention` / `paused` |
| `created`              | SubscribedAt      | Date                                |
| `subscription_tier`    | Tier              | Select — `free` / `premium`         |
| `utm_source`           | UtmSource         | Text                                 |
| `utm_medium`           | UtmMedium         | Text                                 |
| `utm_campaign`         | UtmCampaign       | Text                                 |
| `tags` (expanded)      | Tags              | Multi-select                         |
| `id`                   | BeehiivId         | Text (deduplication key)             |

### Post Analytics Fields

| Beehiiv Field            | Notion Property | Type            |
| -------------------------- | ---------------- | ---------------- |
| `title`                     | Title             | Title              |
| `subtitle`                  | Subtitle          | Text                |
| `status`                    | Status            | Select — `draft` / `confirmed` / `archived` |
| `publish_date`              | PublishDate       | Date                |
| `web_url`                   | WebUrl            | URL                 |
| `stats.email.recipients` (expanded) | TotalSent  | Number              |
| `stats.email.opens`         | Opens             | Number              |
| `stats.email.open_rate`     | OpenRate          | Number (%)          |
| `stats.email.clicks`        | Clicks            | Number              |
| `stats.email.click_rate`    | ClickRate         | Number (%)          |
| `stats.email.unsubscribes`  | Unsubscribes      | Number              |
| `stats.web.views`           | WebViews          | Number              |
| `stats.web.clicks`          | WebClicks         | Number              |
| `id`                        | BeehiivPostId     | Text (deduplication key) |

Stats are nested under `stats.email` / `stats.web` (not flat) and are only present when the request includes `expand[]=stats`, which this tool always sends. `tags` on a subscriber similarly requires `expand[]=tags`.

---

## Prerequisites

- Node.js ≥ 18 (or Docker)
- A Beehiiv account with API access
- A Notion account with an integration set up

---

## Installation

```bash
git clone https://github.com/whybothercoding/beehiiv-notion-sync.git
cd beehiiv-notion-sync
npm install
npm run build
```

---

## Quick Start

1. **Copy the env template**

   ```bash
   cp .env.example .env
   ```

2. **Fill in your API keys**

   - Get your Beehiiv API key and Publication ID → [docs/beehiiv-api-setup.md](docs/beehiiv-api-setup.md)
   - Set up your Notion integration → [docs/notion-integration-setup.md](docs/notion-integration-setup.md)

3. **Run the setup command** to create your Notion databases

   ```bash
   node dist/index.js setup --parent-page-id YOUR_NOTION_PAGE_ID
   ```

4. **Copy the printed database IDs into your `.env`**

   ```
   NOTION_SUBSCRIBERS_DB_ID=...
   NOTION_POSTS_DB_ID=...
   ```

5. **Run your first sync**

   ```bash
   node dist/index.js sync
   ```

---

## CLI Commands

### `setup`

Creates both Notion databases under a parent page. Run this once before your first sync.

```bash
beehiiv-notion-sync setup --parent-page-id <notion-page-id>
```

### `sync`

Syncs data from Beehiiv to Notion. Runs both subscribers and posts by default.

```bash
beehiiv-notion-sync sync                       # sync both (default)
beehiiv-notion-sync sync --subscribers          # subscribers only
beehiiv-notion-sync sync --posts                # posts only
beehiiv-notion-sync sync --dry-run              # fetch data but skip all Notion writes
beehiiv-notion-sync sync --force                # re-write every record, bypassing the unchanged-record cache
beehiiv-notion-sync sync --concurrency 5        # override concurrent Notion requests (default: 3)
beehiiv-notion-sync sync --rate-limit-ms 500    # override delay between Notion requests (default: 350)
beehiiv-notion-sync sync --json                 # print a machine-readable summary instead of progress output
```

**Unchanged-record skipping:** every sync hashes each record's mapped Notion properties and caches it in a local state file (`.sync-state.json` by default, override with `SYNC_STATE_FILE`). On the next run, a record whose hash hasn't changed is skipped entirely — no Notion API call — instead of being re-written every time. Since Notion writes are the rate-limited, slow part of a sync (not the Beehiiv fetch), this is what makes repeat syncs of a large, mostly-static list fast. Use `--force` to bypass it, e.g. after a Notion schema change.

### `start`

Runs the sync on a recurring schedule (configured by `SYNC_INTERVAL_HOURS` in `.env`). Performs an initial sync immediately on startup, then repeats. `Ctrl+C` (or `SIGTERM`) stops the cron schedule and waits for any in-progress sync to finish before exiting, rather than killing it mid-write.

```bash
beehiiv-notion-sync start
```

---

## Running with Docker

```bash
cp .env.example .env   # fill in your keys
docker compose up -d --build
```

This runs `start` (the scheduler) in the background, restarting on failure, with the unchanged-record cache persisted to a named volume so it survives container restarts. To run a one-off `sync` instead of the scheduler:

```bash
docker compose run --rm beehiiv-notion-sync sync --dry-run
```

---

## Scheduling (without Docker)

See [docs/scheduling.md](docs/scheduling.md) for instructions on running `start` persistently with pm2, nohup, or as a systemd service.

---

## Environment Variables

| Variable                    | Required         | Description                                                    |
| ---------------------------- | ------------------ | ---------------------------------------------------------------- |
| `BEEHIIV_API_KEY`             | Yes                | Your Beehiiv API key                                              |
| `BEEHIIV_PUBLICATION_ID`      | Yes                | Your publication ID (`pub_...`)                                   |
| `NOTION_API_KEY`              | Yes                | Your Notion integration token (`secret_...`)                      |
| `NOTION_SUBSCRIBERS_DB_ID`    | Yes (sync/start)   | Notion database ID for subscribers                                |
| `NOTION_POSTS_DB_ID`          | Yes (sync/start)   | Notion database ID for posts                                      |
| `SYNC_INTERVAL_HOURS`         | No                 | Hours between scheduled syncs (default: 6)                        |
| `NOTION_CONCURRENCY`          | No                 | Concurrent Notion write requests (default: 3)                     |
| `NOTION_RATE_LIMIT_MS`        | No                 | Delay between Notion requests, in ms (default: 350)                |
| `SYNC_STATE_FILE`             | No                 | Path to the unchanged-record cache (default: `.sync-state.json`)   |

---

## Notion Database Schemas

### Subscribers Database

| Property     | Type         | Notes                        |
| ------------- | ------------- | ------------------------------ |
| Email          | Title         | Primary field                   |
| Status         | Select        | See subscriber status values above — Notion auto-creates any not pre-seeded |
| SubscribedAt   | Date          |                                  |
| Tier           | Select        | `free` / `premium`               |
| UtmSource      | Text          |                                  |
| UtmMedium      | Text          |                                  |
| UtmCampaign    | Text          |                                  |
| Tags           | Multi-select  |                                  |
| BeehiivId      | Text          | Used for deduplication          |

### Posts Database

| Property        | Type    | Notes             |
| ----------------- | -------- | ------------------- |
| Title               | Title    | Primary field         |
| Subtitle            | Text     |                       |
| Status              | Select   | `draft` / `confirmed` / `archived` |
| PublishDate         | Date     |                       |
| WebUrl              | URL      |                       |
| TotalSent           | Number   | `stats.email.recipients` |
| Opens               | Number   |                       |
| OpenRate            | Number   | Percent format         |
| Clicks              | Number   |                       |
| ClickRate           | Number   | Percent format         |
| Unsubscribes        | Number   |                       |
| WebViews            | Number   | `stats.web.views`     |
| WebClicks           | Number   | `stats.web.clicks`    |
| BeehiivPostId       | Text     | Used for deduplication |

---

## Development

```bash
npm install
npm run build          # compile TypeScript
npm run dev             # run without building (ts-node)
npm test                # run unit tests
npm run test:watch      # run tests in watch mode
npm run test:coverage   # run tests with a coverage report
npm run lint             # lint with ESLint
npm run lint:fix         # lint and auto-fix
npm run format            # format with Prettier
npm run format:check      # check formatting without writing
npm run typecheck          # tsc --noEmit
```

A pre-commit hook (Husky + lint-staged) runs lint/format on staged files and a full typecheck before every commit. CI (`.github/workflows/ci.yml`) runs the same checks plus the full test suite with coverage thresholds enforced, on Node 18/20/22.

---

## License

MIT
