import { supabase } from '@/integrations/supabase/client';

export type AnalysisTimeframe = '5m' | '15m' | '30m' | '1h' | '4h';

export interface IndicatorSummary {
  ema9: number;
  ema21: number;
  ema50: number;
  rsi14: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  atr14: number;
  atrPct: number;
  vwap: number;
  vwapDistancePct?: number;
  volumeMultiplier: number;
  takerBuyRatio: number;
  bodyPct: number;
  bodyToWickRatio?: number;
  upperWickPct: number;
  lowerWickPct: number;
  support: number;
  resistance: number;
  rangeBreakout?: boolean;
  accumulationRangePct?: number;
  priceAccelerationPct: number;
  volumeZScore: number;
  tradeCountZScore: number;
  candleExpansion: number;
  rangeBreakoutPct: number;
  multiTimeframeAgreement: number;
}

export interface RiskSummary {
  trend_score: number;
  momentum_score: number;
  volatility_score: number;
  volume_confirmation_score: number;
  reversal_risk_score: number;
  whale_risk_score: number;
  pump_dump_risk_score: number;
  labels: string[];
  orderbook: {
    bidDepthUsd: number;
    askDepthUsd: number;
    spreadPct: number;
    imbalancePct: number;
    isThin: boolean;
  };
}

export interface SocialSummary {
  mention_delta?: number | null;
  tweet_count_delta?: number | null;
  sentiment_score: number | null;
  source_region?: string | null;
  social_confidence?: number | null;
  source_count?: number;
  top_catalyst_terms?: string[];
  confidence?: number;
  status: string;
  x_status?: string;
}

export interface AiSummary {
  likely_cause?: string;
  manipulation_risk?: 'Low' | 'Moderate' | 'High' | 'Critical';
  whale_probability?: number;
  catalyst_summary?: string;
  catalyst_summary_tr?: string;
  confidence?: number;
  risk_level: 'Low' | 'Moderate' | 'High' | 'Critical';
  summary_tr: string;
  watch_points: string[];
  not_advice_notice: string;
  source?: string;
  fallback_reason?: 'missing_ai_api_key' | 'ai_provider_request_failed' | null;
  gemini_error?: string;
  provider_error?: string;
}

export interface CauseSummary {
  likely_cause: string;
  movement_cause_score: {
    organic: number;
    whale: number;
    fraud_pump: number;
    news_social: number;
    technical_breakout: number;
    low_liquidity: number;
  };
  confidence_score: number;
  early_warning_score: number;
  risk_labels: string[];
}

export interface ContinuationSummary {
  continuation_score_15m: number;
  continuation_score_1h: number;
  continuation_label: 'likely_continue' | 'mixed' | 'likely_fade';
  continuation_reasons: string[];
}

export interface NewsSummary {
  status: string;
  source_count: number;
  sentiment_score: number | null;
  confidence: number;
  top_catalyst_terms: string[];
}

export interface MarketMicrostructure {
  orderbook: RiskSummary['orderbook'];
  trades: {
    largeTradeCount: number;
    largeTradeUsd: number;
    largestTradeUsd: number;
    buyPressurePct: number;
    sellPressurePct: number;
  };
  taker_buy_ratio: number;
  abnormal_volume: number;
  abnormal_trade_count: number;
  candle_expansion: number;
}

export interface CoinAnalysis {
  id: string;
  symbol: string;
  timeframe: AnalysisTimeframe;
  price: number;
  indicator_json: IndicatorSummary;
  risk_json: RiskSummary;
  social_json: SocialSummary;
  cause_json?: CauseSummary;
  continuation_json?: ContinuationSummary;
  market_microstructure_json?: MarketMicrostructure;
  news_json?: NewsSummary;
  confidence_json?: {
    confidence_score: number;
    data_quality: Record<string, string>;
  };
  ai_summary_json: AiSummary;
  created_at: string;
  expires_at: string;
  cache_hit?: boolean;
  ai_cache_hit?: boolean;
  usage_counted?: boolean;
}

export class CoinAnalysisError extends Error {
  code?: string;
  plan?: string;
  used?: number;
  limit?: number;

  constructor(message: string, details: Partial<CoinAnalysisError> = {}) {
    super(message);
    this.name = 'CoinAnalysisError';
    this.code = details.code;
    this.plan = details.plan;
    this.used = details.used;
    this.limit = details.limit;
  }
}

const ANALYSIS_SESSION_TTL_MS = 2 * 60 * 1000;
const RECENT_SESSION_TTL_MS = 2 * 60 * 1000;

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

function writeSessionCache<T>(key: string, value: T, ttlMs: number) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ value, expiresAt: Date.now() + ttlMs }));
  } catch {
    // Browser storage can be unavailable in private or restricted contexts.
  }
}

export async function analyzeCoin(
  symbol: string,
  timeframe: AnalysisTimeframe,
  force = false,
  language = 'tr'
): Promise<CoinAnalysis> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const cacheKey = `analysis:${normalizedSymbol}:${timeframe}:${language}`;
  if (!force) {
    const cached = readSessionCache<CoinAnalysis>(cacheKey);
    if (cached) return { ...cached, cache_hit: true, usage_counted: false };
  }

  const { data, error } = await supabase.functions.invoke('analyze-coin', {
    method: 'POST',
    body: { symbol: normalizedSymbol, timeframe, force, language },
  });

  if (error) {
    const context = 'context' in error ? error.context : null;
    if (context instanceof Response) {
      const details = await context.json().catch(() => null);
      if (details?.error) throw new CoinAnalysisError(details.error, details);
    }
    throw new CoinAnalysisError(error.message || 'Coin analysis failed');
  }

  if (data?.error) {
    throw new CoinAnalysisError(data.error, data);
  }

  const analysis = data.analysis as CoinAnalysis;
  writeSessionCache(cacheKey, analysis, ANALYSIS_SESSION_TTL_MS);
  return analysis;
}

export async function getRecentAnalyses(): Promise<CoinAnalysis[]> {
  const cached = readSessionCache<CoinAnalysis[]>('recent-analyses');
  if (cached) return cached;

  const { data, error } = await supabase.functions.invoke('analyze-coin', {
    method: 'GET',
  });

  if (error) {
    throw new Error(error.message || 'Failed to load recent analyses');
  }

  const analyses = (data?.analyses || []) as CoinAnalysis[];
  writeSessionCache('recent-analyses', analyses, RECENT_SESSION_TTL_MS);
  return analyses;
}
