export interface BeehiivSubscriber {
  id: string;
  email: string;
  status: 'active' | 'inactive' | 'unsubscribed';
  created_at: number; // Unix timestamp
  subscription_tier: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  tags: string[];
  custom_fields: Record<string, string>;
}

export interface BeehiivPostStats {
  total_sent: number;
  opens: number;
  open_rate: number;
  clicks: number;
  click_rate: number;
  unsubscribes: number;
}

export interface BeehiivPost {
  id: string;
  title: string;
  subtitle: string | null;
  status: string;
  publish_date: number | null; // Unix timestamp
  web_url: string | null;
  stats: BeehiivPostStats | null;
}

export interface BeehiivPaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  total: number;
}
