import { supabase } from '@/integrations/supabase/client';

export type OverviewTrendItem = {
  symbol: string;
  sentiment_score: number;
  sentiment_label: 'bad' | 'neutral' | 'good';
  reason: string | null;
  title: string | null;
  url: string | null;
  domain: string | null;
  published_at: string | null;
};

export type OverviewMoverItem = {
  symbol: string;
  price: number;
  move_pct: number;
  quote_volume: number;
  sparkline: number[];
  cause: string | null;
  continuation: string | null;
  risk_score: number | null;
  reason: string | null;
  cached_at: string | null;
};

export type OverviewScannerItem = {
  symbol: string;
  created_at: string;
  risk_score: number;
  confidence: number;
  cause: string | null;
  continuation: string | null;
  reason: string | null;
  sparkline: number[];
};

export type MarketOverviewPayload = {
  trend_news: { items: OverviewTrendItem[]; created_at: string | null; most_mentioned: string | null; cache_source: string };
  scanner: { items: OverviewScannerItem[]; cache_source: string };
  gainers: { items: OverviewMoverItem[]; cache_source: string };
  losers: { items: OverviewMoverItem[]; cache_source: string };
  created_at: string | null;
};

const OVERVIEW_TTL_MS = 60 * 1000;

function readCache<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { expiresAt: number; value: T };
    if (parsed.expiresAt <= Date.now()) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ value, expiresAt: Date.now() + OVERVIEW_TTL_MS }));
  } catch {
    // ignore session cache failures
  }
}

export async function getMarketOverview() {
  const cacheKey = 'market-overview';
  const cached = readCache<MarketOverviewPayload>(cacheKey);
  if (cached) return cached;

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  const { data, error } = await supabase.functions.invoke('market-overview', {
    method: 'GET',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  if (error) throw new Error(error.message || 'Market overview failed');
  writeCache(cacheKey, data as MarketOverviewPayload);
  return data as MarketOverviewPayload;
}
