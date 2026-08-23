export interface NotionTitleProperty {
  title: Array<{ text: { content: string } }>;
}

export interface NotionRichTextProperty {
  rich_text: Array<{ text: { content: string } }>;
}

export interface NotionSelectProperty {
  select: { name: string } | null;
}

export interface NotionMultiSelectProperty {
  multi_select: Array<{ name: string }>;
}

export interface NotionDateProperty {
  date: { start: string } | null;
}

export interface NotionUrlProperty {
  url: string | null;
}

export interface NotionNumberProperty {
  number: number | null;
}

export type NotionPropertyValue =
  | NotionTitleProperty
  | NotionRichTextProperty
  | NotionSelectProperty
  | NotionMultiSelectProperty
  | NotionDateProperty
  | NotionUrlProperty
  | NotionNumberProperty;

export interface SubscriberProperties extends Record<string, NotionPropertyValue> {
  Email: NotionTitleProperty;
  Status: NotionSelectProperty;
  SubscribedAt: NotionDateProperty;
  Tier: NotionSelectProperty;
  UtmSource: NotionRichTextProperty;
  UtmMedium: NotionRichTextProperty;
  UtmCampaign: NotionRichTextProperty;
  Tags: NotionMultiSelectProperty;
  BeehiivId: NotionRichTextProperty;
}

export interface PostProperties extends Record<string, NotionPropertyValue> {
  Title: NotionTitleProperty;
  Subtitle: NotionRichTextProperty;
  Status: NotionSelectProperty;
  PublishDate: NotionDateProperty;
  WebUrl: NotionUrlProperty;
  TotalSent: NotionNumberProperty;
  Opens: NotionNumberProperty;
  OpenRate: NotionNumberProperty;
  Clicks: NotionNumberProperty;
  ClickRate: NotionNumberProperty;
  Unsubscribes: NotionNumberProperty;
  WebViews: NotionNumberProperty;
  WebClicks: NotionNumberProperty;
  BeehiivPostId: NotionRichTextProperty;
}

// Notion rejects a pages.create/pages.update call outright if any rich_text
// (or title, which is the same underlying type) content exceeds 2000
// characters — https://developers.notion.com/reference/request-limits.
// Truncating defensively means one oversized field fails softly instead of
// the whole record's sync throwing.
const NOTION_TEXT_LIMIT = 2000;
// Multi-select values are capped at 100 options per property.
const NOTION_MULTI_SELECT_LIMIT = 100;

function truncate(content: string, max: number): string {
  return content.length > max ? content.slice(0, max) : content;
}

// Commas in select/multi-select option names are unsupported by the Notion
// API (they're the delimiter Notion itself uses for option lists), so a
// literal comma in source data — a Beehiiv tag like "b2b, saas" — either gets
// silently stripped or rejected depending on client. Swap it for a safe
// separator instead of losing the distinction entirely.
function sanitizeOptionName(name: string): string {
  return truncate(name.replace(/,/g, ';'), NOTION_TEXT_LIMIT);
}

export function titleProp(content: string): NotionTitleProperty {
  return { title: [{ text: { content: truncate(content, NOTION_TEXT_LIMIT) } }] };
}

export function richTextProp(content: string): NotionRichTextProperty {
  return { rich_text: [{ text: { content: truncate(content, NOTION_TEXT_LIMIT) } }] };
}

export function selectProp(name: string | null | undefined): NotionSelectProperty {
  return { select: name ? { name: sanitizeOptionName(name) } : null };
}

export function multiSelectProp(names: string[]): NotionMultiSelectProperty {
  return {
    multi_select: names.slice(0, NOTION_MULTI_SELECT_LIMIT).map((name) => ({
      name: sanitizeOptionName(name),
    })),
  };
}

export function dateProp(unixTimestamp: number | null | undefined): NotionDateProperty {
  if (!unixTimestamp) return { date: null };
  const iso = new Date(unixTimestamp * 1000).toISOString().split('T')[0];
  return { date: { start: iso } };
}

export function urlProp(url: string | null | undefined): NotionUrlProperty {
  if (!url) return { url: null };
  return { url: truncate(url, NOTION_TEXT_LIMIT) };
}

export function numberProp(value: number | null | undefined): NotionNumberProperty {
  return { number: value ?? null };
}
