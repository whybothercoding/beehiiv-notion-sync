# Notion Integration Setup

## 1. Create a Notion Integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **+ New integration**
3. Give it a name (e.g. "Beehiiv Sync")
4. Select the workspace where your databases will live
5. Under **Capabilities**, ensure **Read content**, **Update content**, and **Insert content** are checked
6. Click **Save**
7. Copy the **Internal Integration Token** — it starts with `secret_...`

Add it to your `.env` file:

```
NOTION_API_KEY=secret_xxxxxxxxxxxxxxxx
```

## 2. Create a Parent Page and Share It

The setup command creates two databases inside a parent Notion page. You need to:

1. Open Notion and create a new page (or choose an existing one) where the databases should live
2. Click **...** (three dots) in the top-right corner of the page
3. Click **Connect to** → select your integration ("Beehiiv Sync")

Without this step, the integration cannot write to the page and setup will fail.

## 3. Get the Parent Page ID

The page ID is the last part of the Notion page URL:

```
https://www.notion.so/Your-Page-Name-abcdef1234567890abcdef1234567890
                                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                      This is your page ID
```

Copy the 32-character ID. Notion accepts both dashed and undashed formats.

## 4. Run the Setup Command

```bash
npx ts-node src/index.ts setup --parent-page-id YOUR_PAGE_ID
```

Or if you've built the project:

```bash
node dist/index.js setup --parent-page-id YOUR_PAGE_ID
```

The command creates both databases and prints their IDs:

```
✓ Subscribers DB created: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
✓ Posts DB created:       xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

Add these to your .env file:
NOTION_SUBSCRIBERS_DB_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NOTION_POSTS_DB_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## 5. Update Your .env

Copy the printed IDs into your `.env` file. You're now ready to run `sync`.
