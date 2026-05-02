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
  BeehiivPostId: NotionRichTextProperty;
}

export function titleProp(content: string): NotionTitleProperty {
  return { title: [{ text: { content } }] };
}

export function richTextProp(content: string): NotionRichTextProperty {
  return { rich_text: [{ text: { content: content ?? '' } }] };
}

export function selectProp(name: string | null | undefined): NotionSelectProperty {
  return { select: name ? { name } : null };
}

export function multiSelectProp(names: string[]): NotionMultiSelectProperty {
  return { multi_select: names.map((name) => ({ name })) };
}

export function dateProp(unixTimestamp: number | null | undefined): NotionDateProperty {
  if (!unixTimestamp) return { date: null };
  const iso = new Date(unixTimestamp * 1000).toISOString().split('T')[0];
  return { date: { start: iso as string } };
}

export function urlProp(url: string | null | undefined): NotionUrlProperty {
  return { url: url ?? null };
}

export function numberProp(value: number | null | undefined): NotionNumberProperty {
  return { number: value ?? null };
}
