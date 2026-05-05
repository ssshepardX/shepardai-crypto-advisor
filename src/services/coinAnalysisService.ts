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
  volumeMultiplier: number;
  takerBuyRatio: number;
  bodyPct: number;
  upperWickPct: number;
  lowerWickPct: number;
  support: number;
  resistance: number;
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

export async function analyzeCoin(
  symbol: string,
  timeframe: AnalysisTimeframe,
  force = false,
  language = 'tr'
): Promise<CoinAnalysis> {
  const { data, error } = await supabase.functions.invoke('analyze-coin', {
    method: 'POST',
    body: { symbol, timeframe, force, language },
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

  return data.analysis as CoinAnalysis;
}

export async function scanMarket(): Promise<CoinAnalysis[]> {
  const { data, error } = await supabase.functions.invoke('analyze-coin', {
    method: 'POST',
    body: { mode: 'scan-market' },
  });

  if (error) {
    const context = 'context' in error ? error.context : null;
    if (context instanceof Response) {
      const details = await context.json().catch(() => null);
      if (details?.error) throw new CoinAnalysisError(details.error, details);
    }
    throw new CoinAnalysisError(error.message || 'Market scan failed');
  }

  if (data?.error) {
    throw new CoinAnalysisError(data.error, data);
  }

  return data.analyses as CoinAnalysis[];
}

export async function getRecentAnalyses(): Promise<CoinAnalysis[]> {
  const { data, error } = await supabase.functions.invoke('analyze-coin', {
    method: 'GET',
  });

  if (error) {
    throw new Error(error.message || 'Failed to load recent analyses');
  }

  return (data?.analyses || []) as CoinAnalysis[];
}
