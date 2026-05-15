import { supabase } from '@/integrations/supabase/client';

export type SentimentLabel = 'bad' | 'neutral' | 'good';
export type TrendDirection = 'up' | 'down' | 'flat';

export interface SentimentResult {
  symbol: string;
  source_json: {
    providers: Record<string, { status: string; count: number; error?: string }>;
    items: Array<{
      provider: string;
      title?: string;
      summary?: string;
      url?: string;
      domain?: string;
      score: number;
      catalyst_terms: string[];
      published_at?: string;
    }>;
    top_catalyst_terms: string[];
  };
  score_json: {
    sentiment_score: number;
    sentiment_label: SentimentLabel;
    mention_score: number;
    source_confidence: number;
    source_count: number;
    good_count: number;
    bad_count: number;
    neutral_count: number;
  };
  trend_json: {
    trend_direction: TrendDirection;
    reason_short: string;
    reason_short_en: string;
    asia_watch_score: number;
    reddit_heat: number;
    news_mood: number;
    most_mentioned_rank?: number;
  };
}

export class SentimentError extends Error {
  code?: string;
  plan?: string;

  constructor(message: string, details: Partial<SentimentError> = {}) {
    super(message);
    this.name = 'SentimentError';
    this.code = details.code;
    this.plan = details.plan;
  }
}

const SENTIMENT_SESSION_TTL_MS = 5 * 60 * 1000;

function readSessionCache<T>(key: string): T | null {
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

function writeSessionCache<T>(key: string, value: T) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ value, expiresAt: Date.now() + SENTIMENT_SESSION_TTL_MS }));
  } catch {
    // Browser storage can be unavailable in private or restricted contexts.
  }
}

async function invokeSentiment<T>(body: Record<string, unknown>): Promise<T> {
  const cacheKey = `sentiment:${JSON.stringify(body)}`;
  const cached = readSessionCache<T>(cacheKey);
  if (cached) return cached;

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  const { data, error } = await supabase.functions.invoke('sentiment-scan', {
    method: 'POST',
    body,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  if (error) {
    const context = 'context' in error ? error.context : null;
    if (context instanceof Response) {
      const details = await context.json().catch(() => null);
      if (details?.error) throw new SentimentError(details.error, details);
    }
    throw new SentimentError(error.message || 'Sentiment scan failed');
  }
  if (data?.error) throw new SentimentError(data.error, data);
  writeSessionCache(cacheKey, data as T);
  return data as T;
}

export async function getMarketSentiment(limit = 3) {
  const cacheKey = `sentiment-cache:market:${limit}`;
  const cached = readSessionCache<{
    trends: SentimentResult[];
    summary: { most_mentioned: string | null; news_mood: number; reddit_heat: number; asia_watch: number };
    cache_hit: boolean;
    created_at: string;
  }>(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('sentiment_snapshots')
    .select('trend_json, score_json, created_at')
    .eq('symbol', 'MARKET')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new SentimentError('Trend cache could not be loaded.');

  const trendJson = (data?.trend_json || {}) as { trends?: SentimentResult[] };
  const scoreJson = (data?.score_json || {}) as Partial<{
    most_mentioned: string | null;
    news_mood: number;
    reddit_heat: number;
    asia_watch: number;
  }>;

  const result = {
    trends: (trendJson.trends || []).slice(0, limit),
    summary: {
      most_mentioned: scoreJson.most_mentioned || null,
      news_mood: Number(scoreJson.news_mood || 0),
      reddit_heat: Number(scoreJson.reddit_heat || 0),
      asia_watch: Number(scoreJson.asia_watch || 0),
    },
    cache_hit: true,
    created_at: data?.created_at || '',
  };
  writeSessionCache(cacheKey, result, SENTIMENT_SESSION_TTL_MS);
  return result;
}

export async function refreshMarketSentiment(limit = 3) {
  const data = await invokeSentiment<{
    trends: SentimentResult[];
    summary: { most_mentioned: string | null; news_mood: number; reddit_heat: number; asia_watch: number };
    cache_hit: boolean;
    created_at: string;
  }>({ mode: 'market', limit });
  sessionStorage.removeItem(`sentiment-cache:market:${limit}`);
  return data;
}

export async function getCoinSentiment(symbol: string) {
  return invokeSentiment<{ sentiment: SentimentResult; cache_hit: boolean; created_at: string }>({ mode: 'coin', symbol });
}
