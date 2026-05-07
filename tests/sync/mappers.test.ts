import { mapSubscriberToNotion } from '../../src/sync/subscribers';
import { mapPostToNotion } from '../../src/sync/posts';
import type { BeehiivSubscriber, BeehiivPost } from '../../src/beehiiv/types';

const baseSubscriber: BeehiivSubscriber = {
  id: 'sub_abc123', email: 'test@example.com', status: 'active',
  created_at: 1705276800, subscription_tier: 'free',
  utm_source: 'twitter', utm_medium: 'social', utm_campaign: 'launch',
  tags: ['vip', 'beta'], custom_fields: {},
};

describe('mapSubscriberToNotion', () => {
  it('maps all fields correctly', () => {
    const r = mapSubscriberToNotion(baseSubscriber);
    expect(r.Email).toEqual({ title: [{ text: { content: 'test@example.com' } }] });
    expect(r.Status).toEqual({ select: { name: 'active' } });
    expect(r.SubscribedAt).toEqual({ date: { start: '2024-01-15' } });
    expect(r.Tier).toEqual({ select: { name: 'free' } });
    expect(r.UtmSource).toEqual({ rich_text: [{ text: { content: 'twitter' } }] });
    expect(r.Tags).toEqual({ multi_select: [{ name: 'vip' }, { name: 'beta' }] });
    expect(r.BeehiivId).toEqual({ rich_text: [{ text: { content: 'sub_abc123' } }] });
  });
  it('handles null UTM fields', () => {
    const sub = { ...baseSubscriber, utm_source: null, utm_medium: null, utm_campaign: null };
    const r = mapSubscriberToNotion(sub);
    expect(r.UtmSource).toEqual({ rich_text: [{ text: { content: '' } }] });
    expect(r.UtmMedium).toEqual({ rich_text: [{ text: { content: '' } }] });
    expect(r.UtmCampaign).toEqual({ rich_text: [{ text: { content: '' } }] });
  });
  it('handles empty tags array', () => {
    const r = mapSubscriberToNotion({ ...baseSubscriber, tags: [] });
    expect(r.Tags).toEqual({ multi_select: [] });
  });
});

const basePost: BeehiivPost = {
  id: 'post_xyz456', title: 'My First Issue', subtitle: 'A great one',
  status: 'confirmed', publish_date: 1705276800,
  web_url: 'https://example.beehiiv.com/p/my-first-issue',
  stats: { total_sent: 1200, opens: 480, open_rate: 0.4, clicks: 96, click_rate: 0.08, unsubscribes: 3 },
};

describe('mapPostToNotion', () => {
  it('maps all fields correctly', () => {
    const r = mapPostToNotion(basePost);
    expect(r.Title).toEqual({ title: [{ text: { content: 'My First Issue' } }] });
    expect(r.Status).toEqual({ select: { name: 'confirmed' } });
    expect(r.PublishDate).toEqual({ date: { start: '2024-01-15' } });
    expect(r.WebUrl).toEqual({ url: 'https://example.beehiiv.com/p/my-first-issue' });
    expect(r.TotalSent).toEqual({ number: 1200 });
    expect(r.OpenRate).toEqual({ number: 0.4 });
    expect(r.BeehiivPostId).toEqual({ rich_text: [{ text: { content: 'post_xyz456' } }] });
  });
  it('handles null subtitle and publish_date', () => {
    const r = mapPostToNotion({ ...basePost, subtitle: null, publish_date: null });
    expect(r.Subtitle).toEqual({ rich_text: [{ text: { content: '' } }] });
    expect(r.PublishDate).toEqual({ date: null });
  });
  it('handles null web_url', () => {
    expect(mapPostToNotion({ ...basePost, web_url: null }).WebUrl).toEqual({ url: null });
  });
  it('handles zero stats', () => {
    const r = mapPostToNotion({ ...basePost, stats: { total_sent: 0, opens: 0, open_rate: 0, clicks: 0, click_rate: 0, unsubscribes: 0 } });
    expect(r.TotalSent).toEqual({ number: 0 });
    expect(r.OpenRate).toEqual({ number: 0 });
  });
  it('handles null stats (draft/unpublished post)', () => {
    const r = mapPostToNotion({ ...basePost, stats: null });
    expect(r.TotalSent).toEqual({ number: null });
    expect(r.Opens).toEqual({ number: null });
    expect(r.OpenRate).toEqual({ number: null });
    expect(r.Clicks).toEqual({ number: null });
    expect(r.ClickRate).toEqual({ number: null });
    expect(r.Unsubscribes).toEqual({ number: null });
  });
});
