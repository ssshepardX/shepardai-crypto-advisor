import { supabase } from '@/integrations/supabase/client';

export type SentimentLabel = 'bad' | 'neutral' | 'good';
export type TrendDirection = 'up' | 'down' | 'flat';

export interface SentimentResult {
  symbol: string;
  source_json: {
    providers: Record<string, { status: string; count: number; error?: string }>;
    items: Array<{ provider: string; url?: string; domain?: string; score: number; catalyst_terms: string[] }>;
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

async function invokeSentiment<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('sentiment-scan', {
    method: 'POST',
    body,
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
  return data as T;
}

export async function getMarketSentiment(limit = 12) {
  return invokeSentiment<{
    trends: SentimentResult[];
    summary: { most_mentioned: string | null; news_mood: number; reddit_heat: number; asia_watch: number };
    cache_hit: boolean;
    created_at: string;
  }>({ mode: 'market', limit });
}

export async function getCoinSentiment(symbol: string) {
  return invokeSentiment<{ sentiment: SentimentResult; cache_hit: boolean; created_at: string }>({ mode: 'coin', symbol });
}
