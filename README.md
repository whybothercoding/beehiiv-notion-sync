# beehiiv-notion-sync

Automatically sync your Beehiiv newsletter subscribers and post analytics into Notion databases. Run it once, schedule it, or integrate it into your workflow.

---

## What It Syncs

### Subscriber Fields

| Beehiiv Field | Notion Property | Type |
|---|---|---|
| `email` | Email | Title |
| `status` | Status | Select (active / inactive / unsubscribed) |
| `created_at` | SubscribedAt | Date |
| `subscription_tier` | Tier | Select |
| `utm_source` | UtmSource | Text |
| `utm_medium` | UtmMedium | Text |
| `utm_campaign` | UtmCampaign | Text |
| `tags` | Tags | Multi-select |
| `id` | BeehiivId | Text (deduplication key) |

### Post Analytics Fields

| Beehiiv Field | Notion Property | Type |
|---|---|---|
| `title` | Title | Title |
| `subtitle` | Subtitle | Text |
| `status` | Status | Select |
| `publish_date` | PublishDate | Date |
| `web_url` | WebUrl | URL |
| `stats.total_sent` | TotalSent | Number |
| `stats.opens` | Opens | Number |
| `stats.open_rate` | OpenRate | Number (%) |
| `stats.clicks` | Clicks | Number |
| `stats.click_rate` | ClickRate | Number (%) |
| `stats.unsubscribes` | Unsubscribes | Number |
| `id` | BeehiivPostId | Text (deduplication key) |

---

## Prerequisites

- Node.js ≥ 18
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
beehiiv-notion-sync sync                # sync both (default)
beehiiv-notion-sync sync --subscribers  # subscribers only
beehiiv-notion-sync sync --posts        # posts only
beehiiv-notion-sync sync --dry-run      # fetch data but skip all Notion writes
```

### `start`

Runs the sync on a recurring schedule (configured by `SYNC_INTERVAL_HOURS` in `.env`). Performs an initial sync immediately on startup, then repeats.

```bash
beehiiv-notion-sync start
```

---

## Scheduling

The `start` command uses `node-cron` to repeat the sync every N hours. See [docs/scheduling.md](docs/scheduling.md) for instructions on running it persistently with pm2, nohup, or as a systemd service.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `BEEHIIV_API_KEY` | Yes | Your Beehiiv API key |
| `BEEHIIV_PUBLICATION_ID` | Yes | Your publication ID (`pub_...`) |
| `NOTION_API_KEY` | Yes | Your Notion integration token (`secret_...`) |
| `NOTION_SUBSCRIBERS_DB_ID` | Yes (sync/start) | Notion database ID for subscribers |
| `NOTION_POSTS_DB_ID` | Yes (sync/start) | Notion database ID for posts |
| `SYNC_INTERVAL_HOURS` | No | Hours between scheduled syncs (default: 6) |

---

## Notion Database Schemas

### Subscribers Database

| Property | Type | Notes |
|---|---|---|
| Email | Title | Primary field |
| Status | Select | active / inactive / unsubscribed |
| SubscribedAt | Date | |
| Tier | Select | Free / Premium / etc. |
| UtmSource | Text | |
| UtmMedium | Text | |
| UtmCampaign | Text | |
| Tags | Multi-select | |
| BeehiivId | Text | Used for deduplication |

### Posts Database

| Property | Type | Notes |
|---|---|---|
| Title | Title | Primary field |
| Subtitle | Text | |
| Status | Select | confirmed / draft / archived |
| PublishDate | Date | |
| WebUrl | URL | |
| TotalSent | Number | |
| Opens | Number | |
| OpenRate | Number | Percent format |
| Clicks | Number | |
| ClickRate | Number | Percent format |
| Unsubscribes | Number | |
| BeehiivPostId | Text | Used for deduplication |

---

## Development

```bash
npm install
npm run build       # compile TypeScript
npm run dev         # run without building (ts-node)
npm test            # run unit tests
npm run test:watch  # run tests in watch mode
```

---

## License

MIT
