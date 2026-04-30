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
  tweet_count_delta: number | null;
  sentiment_score: number | null;
  source_region: string | null;
  social_confidence: number | null;
  status: string;
}

export interface AiSummary {
  direction_bias: 'up' | 'down' | 'neutral';
  continuation_probability: number;
  risk_level: 'Low' | 'Moderate' | 'High' | 'Critical';
  summary_tr: string;
  watch_points: string[];
  not_advice_notice: string;
}

export interface CoinAnalysis {
  id: string;
  symbol: string;
  timeframe: AnalysisTimeframe;
  price: number;
  indicator_json: IndicatorSummary;
  risk_json: RiskSummary;
  social_json: SocialSummary;
  ai_summary_json: AiSummary;
  created_at: string;
  expires_at: string;
  cache_hit?: boolean;
}

export async function analyzeCoin(
  symbol: string,
  timeframe: AnalysisTimeframe,
  force = false
): Promise<CoinAnalysis> {
  const { data, error } = await supabase.functions.invoke('analyze-coin', {
    method: 'POST',
    body: { symbol, timeframe, force },
  });

  if (error) {
    throw new Error(error.message || 'Coin analysis failed');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data.analysis as CoinAnalysis;
}

export async function scanMarket(): Promise<CoinAnalysis[]> {
  const { data, error } = await supabase.functions.invoke('analyze-coin', {
    method: 'POST',
    body: { mode: 'scan-market' },
  });

  if (error) {
    throw new Error(error.message || 'Market scan failed');
  }

  if (data?.error) {
    throw new Error(data.error);
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
