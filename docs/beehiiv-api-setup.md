# Beehiiv API Setup

## 1. Get your API Key

1. Log in to your Beehiiv account at [app.beehiiv.com](https://app.beehiiv.com)
2. Click your workspace name in the top-left corner
3. Go to **Settings** (gear icon)
4. In the left sidebar, click **Integrations**
5. Click **API** under the Integrations section
6. Click **Generate API Key** if you don't have one yet
7. Copy the key — it starts with `bh_api_...`

Add it to your `.env` file:

```
BEEHIIV_API_KEY=bh_api_xxxxxxxx
```

## 2. Get your Publication ID

1. In Beehiiv Settings, go to **Publication** in the left sidebar
2. Scroll to the **Publication Details** section
3. Your Publication ID is displayed — it starts with `pub_...`

Add it to your `.env` file:

```
BEEHIIV_PUBLICATION_ID=pub_xxxxxxxxxxxxxxxx
```

## API Permissions

The API key needs read access to Subscriptions and Posts. A newly generated Beehiiv API key has read access to all resources by default — no additional configuration is needed.
