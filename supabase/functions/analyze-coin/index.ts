import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIMEFRAMES = ["5m", "15m", "30m", "1h", "4h"] as const;
const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
] as const;
const OPENROUTER_MODEL = "openrouter/free";
const SUPPORTED_LANGUAGES = ["tr", "en", "de", "es", "fr", "ar", "ru"] as const;
type Timeframe = typeof TIMEFRAMES[number];
type OutputLanguage = typeof SUPPORTED_LANGUAGES[number];

type Kline = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteVolume: number;
  trades: number;
  takerBuyBaseVolume: number;
  takerBuyQuoteVolume: number;
};

type OrderbookSummary = {
  bidDepthUsd: number;
  askDepthUsd: number;
  spreadPct: number;
  imbalancePct: number;
  isThin: boolean;
};

type TradeSummary = {
  largeTradeCount: number;
  largeTradeUsd: number;
  largestTradeUsd: number;
  buyPressurePct: number;
  sellPressurePct: number;
};

type IndicatorSummary = {
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
};

type RiskSummary = {
  trend_score: number;
  momentum_score: number;
  volatility_score: number;
  volume_confirmation_score: number;
  reversal_risk_score: number;
  whale_risk_score: number;
  pump_dump_risk_score: number;
  labels: string[];
  orderbook: OrderbookSummary;
};

type CauseSummary = {
  likely_cause: "organic_demand" | "whale_push" | "thin_liquidity_move" | "fomo_trap" | "fraud_pump_risk" | "news_social_catalyst" | "balanced_market";
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
};

type PlanId = "free" | "pro" | "trader";

type Entitlement = {
  aiDailyLimit: number;
  canRunScanner: boolean;
};

type AuthContext = {
  userId: string;
  email: string | null;
  plan: PlanId;
  entitlement: Entitlement;
};

class ApiError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ENTITLEMENTS: Record<PlanId, Entitlement> = {
  free: { aiDailyLimit: 3, canRunScanner: false },
  pro: { aiDailyLimit: 50, canRunScanner: false },
  trader: { aiDailyLimit: 250, canRunScanner: true },
};

function getGeminiApiKey(): string {
  return Deno.env.get("GEMINI_API_KEY") ||
    Deno.env.get("GOOGLE_API_KEY") ||
    Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") ||
    "";
}

function getOpenRouterApiKey(): string {
  return Deno.env.get("OPENROUTER_API_KEY") || "";
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizePlan(plan: string | null | undefined): PlanId {
  if (plan === "pro" || plan === "trader") return plan;
  return "free";
}

function normalizeLanguage(value: unknown): OutputLanguage {
  return SUPPORTED_LANGUAGES.includes(value as OutputLanguage) ? value as OutputLanguage : "tr";
}

async function getAuthContext(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(401, "AUTH_REQUIRED", "Oturum gerekli.");
  }

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new ApiError(401, "AUTH_INVALID", "Oturum dogrulanamadi.");
  }

  const { data: subscription } = await supabase
    .from("user_subscriptions")
    .select("plan")
    .eq("user_id", data.user.id)
    .eq("active", true)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const plan = normalizePlan(subscription?.plan);
  return {
    userId: data.user.id,
    email: data.user.email || null,
    plan,
    entitlement: ENTITLEMENTS[plan],
  };
}

async function getTodayUsage(userId: string): Promise<{ ai_analysis_count: number; scanner_run_count: number }> {
  const { data } = await supabase
    .from("user_usage_daily")
    .select("ai_analysis_count, scanner_run_count")
    .eq("user_id", userId)
    .eq("usage_date", todayIsoDate())
    .maybeSingle();

  return {
    ai_analysis_count: Number(data?.ai_analysis_count || 0),
    scanner_run_count: Number(data?.scanner_run_count || 0),
  };
}

async function assertCanGenerateAi(auth: AuthContext) {
  const usage = await getTodayUsage(auth.userId);
  if (usage.ai_analysis_count >= auth.entitlement.aiDailyLimit) {
    throw new ApiError(403, "AI_LIMIT_REACHED", "Daily analysis limit reached. Upgrade to run more checks.", {
      plan: auth.plan,
      used: usage.ai_analysis_count,
      limit: auth.entitlement.aiDailyLimit,
    });
  }
}

async function incrementUsage(userId: string, field: "ai_analysis_count" | "scanner_run_count") {
  const usage = await getTodayUsage(userId);
  const next = {
    user_id: userId,
    usage_date: todayIsoDate(),
    ai_analysis_count: usage.ai_analysis_count + (field === "ai_analysis_count" ? 1 : 0),
    scanner_run_count: usage.scanner_run_count + (field === "scanner_run_count" ? 1 : 0),
  };

  const { error } = await supabase
    .from("user_usage_daily")
    .upsert(next, { onConflict: "user_id,usage_date" });

  if (error) throw new Error(error.message);
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function round(value: number, digits = 4): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeSymbol(symbol: string): string {
  const cleaned = symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.endsWith("USDT") ? cleaned : `${cleaned}USDT`;
}

function ttlMinutes(timeframe: Timeframe): number {
  if (timeframe === "5m") return 5;
  if (timeframe === "15m") return 10;
  if (timeframe === "30m") return 15;
  if (timeframe === "1h") return 30;
  return 60;
}

async function fetchKlines(symbol: string, timeframe: Timeframe, limit = 180): Promise<Kline[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${timeframe}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Binance klines failed: ${response.status}`);
  const rows = await response.json();
  return rows.map((row: unknown[]) => ({
    openTime: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    closeTime: Number(row[6]),
    quoteVolume: Number(row[7]),
    trades: Number(row[8]),
    takerBuyBaseVolume: Number(row[9]),
    takerBuyQuoteVolume: Number(row[10]),
  }));
}

async function fetchTopSymbols(limit = 40): Promise<string[]> {
  const response = await fetch("https://api.binance.com/api/v3/ticker/24hr");
  if (!response.ok) return [];
  const rows = await response.json();
  return rows
    .filter((ticker: { symbol: string; quoteVolume: string }) => ticker.symbol.endsWith("USDT"))
    .sort((a: { quoteVolume: string }, b: { quoteVolume: string }) => Number(b.quoteVolume) - Number(a.quoteVolume))
    .slice(0, limit)
    .map((ticker: { symbol: string }) => ticker.symbol);
}

async function fetchOrderbook(symbol: string, price: number): Promise<OrderbookSummary> {
  const response = await fetch(`https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=100`);
  if (!response.ok) {
    return { bidDepthUsd: 0, askDepthUsd: 0, spreadPct: 0, imbalancePct: 0, isThin: true };
  }

  const data = await response.json();
  const bids = data.bids as [string, string][];
  const asks = data.asks as [string, string][];
  const lower = price * 0.98;
  const upper = price * 1.02;
  const bestBid = Number(bids[0]?.[0] || price);
  const bestAsk = Number(asks[0]?.[0] || price);

  const bidDepthUsd = bids
    .filter(([levelPrice]) => Number(levelPrice) >= lower)
    .reduce((sum, [levelPrice, qty]) => sum + Number(levelPrice) * Number(qty), 0);
  const askDepthUsd = asks
    .filter(([levelPrice]) => Number(levelPrice) <= upper)
    .reduce((sum, [levelPrice, qty]) => sum + Number(levelPrice) * Number(qty), 0);
  const totalDepth = bidDepthUsd + askDepthUsd;
  const imbalancePct = totalDepth > 0 ? ((bidDepthUsd - askDepthUsd) / totalDepth) * 100 : 0;
  const spreadPct = price > 0 ? ((bestAsk - bestBid) / price) * 100 : 0;

  return {
    bidDepthUsd: round(bidDepthUsd, 2),
    askDepthUsd: round(askDepthUsd, 2),
    spreadPct: round(spreadPct, 4),
    imbalancePct: round(imbalancePct, 2),
    isThin: totalDepth < 1_300_000,
  };
}

async function fetchRecentTrades(symbol: string, price: number): Promise<TradeSummary> {
  const response = await fetch(`https://api.binance.com/api/v3/aggTrades?symbol=${symbol}&limit=500`);
  if (!response.ok) {
    return { largeTradeCount: 0, largeTradeUsd: 0, largestTradeUsd: 0, buyPressurePct: 50, sellPressurePct: 50 };
  }

  const rows = await response.json();
  const largeThresholdUsd = Math.max(50_000, price * 10);
  let largeTradeCount = 0;
  let largeTradeUsd = 0;
  let largestTradeUsd = 0;
  let buyUsd = 0;
  let sellUsd = 0;

  for (const row of rows as Array<{ p: string; q: string; m: boolean }>) {
    const usd = Number(row.p) * Number(row.q);
    if (row.m) sellUsd += usd;
    else buyUsd += usd;
    if (usd >= largeThresholdUsd) {
      largeTradeCount += 1;
      largeTradeUsd += usd;
      largestTradeUsd = Math.max(largestTradeUsd, usd);
    }
  }

  const total = buyUsd + sellUsd;
  return {
    largeTradeCount,
    largeTradeUsd: round(largeTradeUsd, 2),
    largestTradeUsd: round(largestTradeUsd, 2),
    buyPressurePct: round(total > 0 ? buyUsd / total * 100 : 50, 2),
    sellPressurePct: round(total > 0 ? sellUsd / total * 100 : 50, 2),
  };
}

function ema(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const multiplier = 2 / (period + 1);
  const result: number[] = [];
  let previous = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  result.push(previous);
  for (let i = period; i < values.length; i++) {
    previous = (values[i] - previous) * multiplier + previous;
    result.push(previous);
  }
  return result;
}

function sma(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < values.length; i++) {
    result.push(values.slice(i - period + 1, i + 1).reduce((sum, value) => sum + value, 0) / period);
  }
  return result;
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function zScore(value: number, values: number[]): number {
  const deviation = standardDeviation(values);
  if (deviation === 0) return 0;
  const mean = values.reduce((sum, item) => sum + item, 0) / Math.max(values.length, 1);
  return (value - mean) / deviation;
}

function rsi(values: number[], period = 14): number {
  if (values.length <= period) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  if (losses === 0) return 100;
  const rs = gains / period / (losses / period);
  return 100 - 100 / (1 + rs);
}

function atr(klines: Kline[], period = 14): number {
  if (klines.length <= period) return 0;
  const trs: number[] = [];
  for (let i = klines.length - period; i < klines.length; i++) {
    const current = klines[i];
    const previous = klines[i - 1];
    trs.push(Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close),
    ));
  }
  return trs.reduce((sum, value) => sum + value, 0) / trs.length;
}

function bollinger(values: number[], period = 20) {
  const slice = values.slice(-period);
  const middle = slice.reduce((sum, value) => sum + value, 0) / slice.length;
  const variance = slice.reduce((sum, value) => sum + (value - middle) ** 2, 0) / slice.length;
  const deviation = Math.sqrt(variance);
  return { upper: middle + deviation * 2, middle, lower: middle - deviation * 2 };
}

function calculateIndicators(klines: Kline[]): IndicatorSummary {
  const closes = klines.map((kline) => kline.close);
  const quoteVolumes = klines.map((kline) => kline.quoteVolume);
  const last = klines[klines.length - 1];
  const ema9 = ema(closes, 9).at(-1) || last.close;
  const ema21 = ema(closes, 21).at(-1) || last.close;
  const ema50 = ema(closes, 50).at(-1) || last.close;
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const offset = ema12.length - ema26.length;
  const macdSeries = ema26.map((value, index) => ema12[index + offset] - value);
  const macdSignalSeries = ema(macdSeries, 9);
  const macdValue = macdSeries.at(-1) || 0;
  const macdSignal = macdSignalSeries.at(-1) || 0;
  const bb = bollinger(closes, 20);
  const atr14 = atr(klines, 14);
  const recentVolume = quoteVolumes.slice(-21, -1);
  const avgVolume = recentVolume.reduce((sum, value) => sum + value, 0) / Math.max(recentVolume.length, 1);
  const recentTrades = klines.slice(-31, -1).map((kline) => kline.trades);
  const totalQuote = klines.reduce((sum, kline) => sum + kline.quoteVolume, 0);
  const totalBase = klines.reduce((sum, kline) => sum + kline.volume, 0);
  const takerBuyRatio = last.quoteVolume > 0 ? last.takerBuyQuoteVolume / last.quoteVolume : 0.5;
  const candleRange = Math.max(last.high - last.low, 0.00000001);
  const bodyPct = Math.abs(last.close - last.open) / candleRange * 100;
  const upperWickPct = (last.high - Math.max(last.open, last.close)) / candleRange * 100;
  const lowerWickPct = (Math.min(last.open, last.close) - last.low) / candleRange * 100;
  const swingWindow = klines.slice(-40);
  const previousClose = klines.at(-2)?.close || last.open;
  const close5 = klines.at(-6)?.close || previousClose;
  const close10 = klines.at(-11)?.close || close5;
  const move5 = close5 > 0 ? (last.close - close5) / close5 * 100 : 0;
  const previousMove5 = close10 > 0 ? (close5 - close10) / close10 * 100 : 0;
  const recentRanges = klines.slice(-21, -1).map((kline) => kline.high - kline.low);
  const avgRange = recentRanges.reduce((sum, value) => sum + value, 0) / Math.max(recentRanges.length, 1);
  const resistance = Math.max(...swingWindow.map((kline) => kline.high));
  const support = Math.min(...swingWindow.map((kline) => kline.low));
  const higherTimeframeBias = (last.close > ema21 ? 1 : 0) + (ema9 > ema21 ? 1 : 0) + (ema21 > ema50 ? 1 : 0);

  return {
    ema9: round(ema9),
    ema21: round(ema21),
    ema50: round(ema50),
    rsi14: round(rsi(closes, 14), 2),
    macd: round(macdValue, 6),
    macdSignal: round(macdSignal, 6),
    macdHistogram: round(macdValue - macdSignal, 6),
    bollingerUpper: round(bb.upper),
    bollingerMiddle: round(bb.middle),
    bollingerLower: round(bb.lower),
    atr14: round(atr14),
    atrPct: round(last.close > 0 ? atr14 / last.close * 100 : 0, 2),
    vwap: round(totalBase > 0 ? totalQuote / totalBase : last.close),
    volumeMultiplier: round(avgVolume > 0 ? last.quoteVolume / avgVolume : 1, 2),
    takerBuyRatio: round(takerBuyRatio, 3),
    bodyPct: round(bodyPct, 2),
    upperWickPct: round(upperWickPct, 2),
    lowerWickPct: round(lowerWickPct, 2),
    support: round(support),
    resistance: round(resistance),
    priceAccelerationPct: round(move5 - previousMove5, 2),
    volumeZScore: round(zScore(last.quoteVolume, recentVolume), 2),
    tradeCountZScore: round(zScore(last.trades, recentTrades), 2),
    candleExpansion: round(avgRange > 0 ? candleRange / avgRange : 1, 2),
    rangeBreakoutPct: round(resistance > 0 ? (last.close - resistance) / resistance * 100 : 0, 2),
    multiTimeframeAgreement: round(higherTimeframeBias / 3 * 100, 0),
  };
}

function calculateRisk(indicators: IndicatorSummary, orderbook: OrderbookSummary, price: number): RiskSummary {
  const trendScore = clamp(
    (price > indicators.ema9 ? 25 : 0) +
    (indicators.ema9 > indicators.ema21 ? 25 : 0) +
    (indicators.ema21 > indicators.ema50 ? 25 : 0) +
    (price > indicators.vwap ? 25 : 0)
  );
  const momentumScore = clamp(
    (indicators.rsi14 > 55 ? 25 : indicators.rsi14 < 45 ? -10 : 10) +
    (indicators.macdHistogram > 0 ? 35 : 5) +
    (indicators.takerBuyRatio > 0.55 ? 25 : 10) +
    (indicators.bodyPct > 55 ? 15 : 5)
  );
  const volatilityScore = clamp(indicators.atrPct * 14 + Math.abs(indicators.bollingerUpper - indicators.bollingerLower) / price * 400);
  const volumeConfirmationScore = clamp((indicators.volumeMultiplier - 1) * 28 + Math.max(0, indicators.takerBuyRatio - 0.5) * 120);
  const reversalRiskScore = clamp(
    (indicators.rsi14 > 78 ? 32 : indicators.rsi14 < 25 ? 20 : 0) +
    (indicators.upperWickPct > 45 ? 25 : 0) +
    (indicators.volumeMultiplier > 4 ? 25 : 0) +
    (price > indicators.resistance * 0.995 ? 10 : 0)
  );
  const whaleRiskScore = clamp(
    (orderbook.isThin ? 30 : 0) +
    (Math.abs(orderbook.imbalancePct) > 35 ? 22 : 0) +
    (orderbook.spreadPct > 0.08 ? 18 : 0) +
    (indicators.volumeMultiplier > 3 ? 18 : 0) +
    (indicators.takerBuyRatio > 0.7 || indicators.takerBuyRatio < 0.3 ? 12 : 0)
  );
  const pumpDumpRiskScore = clamp(
    reversalRiskScore * 0.35 +
    whaleRiskScore * 0.35 +
    volumeConfirmationScore * 0.2 +
    volatilityScore * 0.1
  );
  const labels: string[] = [];
  if (trendScore > 70 && volumeConfirmationScore > 45) labels.push("organic_breakout");
  if (reversalRiskScore > 55 && volumeConfirmationScore > 60) labels.push("fomo_trap");
  if (orderbook.isThin) labels.push("thin_orderbook");
  if (whaleRiskScore > 55) labels.push("possible_whale_push");
  if (indicators.volumeZScore > 3) labels.push("abnormal_volume");
  if (indicators.tradeCountZScore > 2.5) labels.push("abnormal_trade_count");
  if (indicators.candleExpansion > 2.2) labels.push("range_expansion");
  if (indicators.priceAccelerationPct > 1.5) labels.push("price_acceleration");
  if (indicators.rsi14 > 78) labels.push("overbought");
  if (indicators.rsi14 < 28) labels.push("oversold");
  if (labels.length === 0) labels.push("balanced_market");

  return {
    trend_score: round(trendScore, 0),
    momentum_score: round(momentumScore, 0),
    volatility_score: round(volatilityScore, 0),
    volume_confirmation_score: round(volumeConfirmationScore, 0),
    reversal_risk_score: round(reversalRiskScore, 0),
    whale_risk_score: round(whaleRiskScore, 0),
    pump_dump_risk_score: round(pumpDumpRiskScore, 0),
    labels,
    orderbook,
  };
}

function calculateCause(
  indicators: IndicatorSummary,
  risk: RiskSummary,
  orderbook: OrderbookSummary,
  trades: TradeSummary,
  social: Record<string, unknown>,
  news: Record<string, unknown>,
): CauseSummary {
  const socialConfidence = Number(social.confidence || social.social_confidence || 0);
  const newsConfidence = Number(news.confidence || 0);
  const socialCatalyst = clamp(Number(social.mention_delta || 0) * 7 + socialConfidence * 0.6);
  const newsCatalyst = clamp(newsConfidence * 0.9 + Number(news.source_count || 0) * 8);

  const technicalBreakout = clamp(
    risk.trend_score * 0.35 +
    risk.volume_confirmation_score * 0.25 +
    Math.max(0, indicators.rangeBreakoutPct) * 10 +
    indicators.multiTimeframeAgreement * 0.2 +
    Math.max(0, indicators.priceAccelerationPct) * 3,
  );
  const lowLiquidity = clamp(
    (orderbook.isThin ? 45 : 0) +
    Math.max(0, orderbook.spreadPct - 0.03) * 250 +
    Math.abs(orderbook.imbalancePct) * 0.45,
  );
  const whale = clamp(
    risk.whale_risk_score * 0.45 +
    trades.largeTradeCount * 6 +
    Math.min(35, trades.largeTradeUsd / 150_000) +
    Math.max(0, trades.buyPressurePct - 58) * 0.8 +
    Math.max(0, trades.sellPressurePct - 58) * 0.8,
  );
  const fraudPump = clamp(
    risk.pump_dump_risk_score * 0.45 +
    risk.reversal_risk_score * 0.25 +
    lowLiquidity * 0.25 +
    (indicators.upperWickPct > 40 ? 18 : 0) +
    (indicators.volumeZScore > 3 ? 15 : 0),
  );
  const newsSocial = clamp((socialCatalyst + newsCatalyst) / 2);
  const organic = clamp(
    technicalBreakout * 0.45 +
    risk.momentum_score * 0.25 +
    risk.volume_confirmation_score * 0.25 -
    fraudPump * 0.2 -
    lowLiquidity * 0.15,
  );

  const scores = {
    organic: round(organic, 0),
    whale: round(whale, 0),
    fraud_pump: round(fraudPump, 0),
    news_social: round(newsSocial, 0),
    technical_breakout: round(technicalBreakout, 0),
    low_liquidity: round(lowLiquidity, 0),
  };
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top = sorted[0]?.[0] || "balanced_market";
  const likelyCauseMap: Record<string, CauseSummary["likely_cause"]> = {
    organic: "organic_demand",
    whale: "whale_push",
    fraud_pump: "fraud_pump_risk",
    news_social: "news_social_catalyst",
    technical_breakout: "organic_demand",
    low_liquidity: "thin_liquidity_move",
  };
  const likelyCause = sorted[0]?.[1] < 35 ? "balanced_market" : likelyCauseMap[top] || "balanced_market";
  const confidence = clamp(
    35 +
    (orderbook.bidDepthUsd + orderbook.askDepthUsd > 0 ? 15 : 0) +
    Math.min(20, Math.abs(sorted[0]?.[1] - (sorted[1]?.[1] || 0))) +
    Math.min(15, newsConfidence / 8) +
    Math.min(15, socialConfidence / 8),
  );
  const earlyWarning = clamp(fraudPump * 0.35 + whale * 0.25 + lowLiquidity * 0.2 + risk.reversal_risk_score * 0.2);
  const labels = [...risk.labels];
  if (likelyCause === "news_social_catalyst") labels.push("external_catalyst");
  if (earlyWarning > 65) labels.push("early_warning_high");

  return {
    likely_cause: likelyCause,
    movement_cause_score: scores,
    confidence_score: round(confidence, 0),
    early_warning_score: round(earlyWarning, 0),
    risk_labels: Array.from(new Set(labels)),
  };
}

function baseAsset(symbol: string): string {
  return symbol.replace(/USDT$/, "");
}

function sentimentFromText(text: string): number {
  const lower = text.toLowerCase();
  const positive = ["partnership", "listing", "approval", "upgrade", "surge", "bullish", "accumulation", "breakout", "launch"];
  const negative = ["hack", "exploit", "lawsuit", "sec", "delist", "scam", "fraud", "rug", "dump", "investigation"];
  const pos = positive.reduce((sum, word) => sum + (lower.includes(word) ? 1 : 0), 0);
  const neg = negative.reduce((sum, word) => sum + (lower.includes(word) ? 1 : 0), 0);
  return clamp(50 + (pos - neg) * 12, 0, 100);
}

function catalystTerms(text: string): string[] {
  const terms = ["listing", "partnership", "hack", "exploit", "lawsuit", "sec", "whale", "transfer", "upgrade", "airdrop", "delist", "rug", "scam", "etf", "mainnet"];
  const lower = text.toLowerCase();
  return terms.filter((term) => lower.includes(term)).slice(0, 6);
}

async function fetchNewsSummary(symbol: string) {
  const key = Deno.env.get("GOOGLE_CUSTOM_SEARCH_API_KEY") || "";
  const cx = Deno.env.get("GOOGLE_CUSTOM_SEARCH_ENGINE_ID") || "";
  if (!key || !cx) {
    return {
      status: "not_configured",
      source_count: 0,
      sentiment_score: null,
      confidence: 0,
      top_catalyst_terms: [],
    };
  }

  try {
    const asset = baseAsset(symbol);
    const query = encodeURIComponent(`${asset} crypto OR ${symbol} listing hack lawsuit partnership whale transfer`);
    const response = await fetch(`https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${query}&num=5&dateRestrict=d7`);
    if (!response.ok) throw new Error(`google_cse_${response.status}`);
    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];
    const joined = items.map((item: { title?: string; snippet?: string }) => `${item.title || ""} ${item.snippet || ""}`).join(" ");
    return {
      status: "configured",
      source_count: items.length,
      sentiment_score: items.length ? round(sentimentFromText(joined), 0) : null,
      confidence: round(clamp(items.length * 14), 0),
      top_catalyst_terms: catalystTerms(joined),
    };
  } catch (error) {
    return {
      status: "provider_error",
      source_count: 0,
      sentiment_score: null,
      confidence: 0,
      top_catalyst_terms: [],
      error: error instanceof Error ? error.message : "unknown_error",
    };
  }
}

async function getRedditToken() {
  const clientId = Deno.env.get("REDDIT_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("REDDIT_CLIENT_SECRET") || "";
  const userAgent = Deno.env.get("REDDIT_USER_AGENT") || "shepard-advisor/0.1";
  if (!clientId || !clientSecret) return null;

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent,
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new Error(`reddit_oauth_${response.status}`);
  const data = await response.json();
  return String(data.access_token || "");
}

async function fetchSocialSummary(symbol: string) {
  const userAgent = Deno.env.get("REDDIT_USER_AGENT") || "shepard-advisor/0.1";
  if (!Deno.env.get("REDDIT_CLIENT_ID") || !Deno.env.get("REDDIT_CLIENT_SECRET")) {
    return {
      status: "not_configured",
      mention_delta: null,
      sentiment_score: null,
      source_count: 0,
      top_catalyst_terms: [],
      confidence: 0,
      x_status: "not_configured",
    };
  }

  try {
    const token = await getRedditToken();
    if (!token) throw new Error("reddit_token_missing");
    const asset = baseAsset(symbol);
    const query = encodeURIComponent(`${asset} OR ${symbol}`);
    const response = await fetch(`https://oauth.reddit.com/r/CryptoCurrency/search?q=${query}&restrict_sr=1&sort=new&t=day&limit=25`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "User-Agent": userAgent,
      },
    });
    if (!response.ok) throw new Error(`reddit_search_${response.status}`);
    const data = await response.json();
    const posts = data?.data?.children?.map((child: { data: { title?: string; selftext?: string; num_comments?: number; score?: number } }) => child.data) || [];
    const joined = posts.map((post: { title?: string; selftext?: string }) => `${post.title || ""} ${post.selftext || ""}`).join(" ");
    const engagement = posts.reduce((sum: number, post: { num_comments?: number; score?: number }) => sum + Number(post.num_comments || 0) + Number(post.score || 0), 0);
    return {
      status: "configured",
      mention_delta: posts.length,
      sentiment_score: posts.length ? round(sentimentFromText(joined), 0) : null,
      source_count: posts.length,
      engagement_score: round(clamp(engagement / 8), 0),
      top_catalyst_terms: catalystTerms(joined),
      confidence: round(clamp(posts.length * 5 + Math.min(35, engagement / 12)), 0),
      x_status: Deno.env.get("X_API_BEARER_TOKEN") ? "configured_not_enabled" : "not_configured",
    };
  } catch (error) {
    return {
      status: "provider_error",
      mention_delta: null,
      sentiment_score: null,
      source_count: 0,
      top_catalyst_terms: [],
      confidence: 0,
      x_status: "not_configured",
      error: error instanceof Error ? error.message : "unknown_error",
    };
  }
}

function fallbackAiSummary(cause: CauseSummary, risk: RiskSummary, language: OutputLanguage, reason = "missing_ai_api_key", detail = "") {
  const riskLevel = risk.pump_dump_risk_score > 70 ? "High" : risk.pump_dump_risk_score > 45 ? "Moderate" : "Low";
  const reasonText = language === "tr"
    ? "Veriler hareketin kaynağına dair net bir baskın sinyal göstermiyor. Büyük işlem, likidite ve hacim skorları birlikte izlenmeli."
    : "The data does not show one clear dominant cause. Large trades, liquidity, and volume scores should be read together.";
  const notice = language === "tr"
    ? "Bu finansal tavsiye değildir; yalnızca piyasa hareketi kaynak analizidir."
    : "This is not financial advice. It is only a market movement source analysis.";
  return {
    language,
    likely_cause: cause.likely_cause,
    manipulation_risk: riskLevel,
    whale_probability: cause.movement_cause_score.whale,
    catalyst_summary_tr: reasonText,
    confidence: cause.confidence_score,
    summary_tr: reasonText,
    watch_points: cause.risk_labels.slice(0, 3),
    not_advice_notice: notice,
    direction_bias: "neutral",
    continuation_probability: cause.early_warning_score,
    risk_level: riskLevel,
    source: "deterministic_fallback",
    fallback_reason: reason,
    provider_error: detail,
  };
}

function parseJsonObject(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text);
  } catch (_) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("model_returned_non_json");
    return JSON.parse(match[0]);
  }
}

async function getAiSummary(
  symbol: string,
  timeframe: Timeframe,
  price: number,
  indicators: IndicatorSummary,
  risk: RiskSummary,
  cause: CauseSummary,
  microstructure: Record<string, unknown>,
  social: Record<string, unknown>,
  news: Record<string, unknown>,
  language: OutputLanguage,
) {
  const geminiApiKey = getGeminiApiKey();
  const openRouterApiKey = getOpenRouterApiKey();
  if (!geminiApiKey && !openRouterApiKey) return fallbackAiSummary(cause, risk, language);

  const compactPayload = {
    symbol,
    timeframe,
    price: round(price),
    scores: {
      cause: cause.movement_cause_score,
      confidence: cause.confidence_score,
      earlyWarning: cause.early_warning_score,
      manipulation: risk.pump_dump_risk_score,
    },
    indicators: {
      rsi14: indicators.rsi14,
      macdHistogram: indicators.macdHistogram,
      atrPct: indicators.atrPct,
      volumeMultiplier: indicators.volumeMultiplier,
      takerBuyRatio: indicators.takerBuyRatio,
    },
    microstructure,
    labels: cause.risk_labels,
    social,
    news,
  };

  const prompt = `Write a short and plain market movement source analysis in language code ${language}. Audience: a regular app user, not a professional trader. Use simple words. Do not mention model/provider/cache/fallback. Do not write price direction, buy/sell, entry/exit, or certainty. Decisions already come from deterministic scores; explain them only. Return JSON only.\n${JSON.stringify(compactPayload)}\nOutput schema: {"likely_cause":"organic_demand|whale_push|thin_liquidity_move|fomo_trap|fraud_pump_risk|news_social_catalyst|balanced_market","manipulation_risk":"Low|Moderate|High|Critical","whale_probability":0-100,"catalyst_summary_tr":"max 2 short sentences","confidence":0-100,"watch_points":["max 3 short items"],"not_advice_notice":"one short disclaimer in target language"}`;

  const errors: string[] = [];
  for (const model of geminiApiKey ? GEMINI_MODELS : []) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.25,
            maxOutputTokens: 350,
            responseMimeType: "application/json",
          },
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${model}: gemini_http_${response.status}: ${errorText.slice(0, 180)}`);
      }
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      return {
        ...fallbackAiSummary(cause, risk, language),
        ...parseJsonObject(text),
        language,
        source: model,
        fallback_reason: null,
        provider_error: "",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      errors.push(message);
      console.error("AI summary failed:", message);
    }
  }

  if (openRouterApiKey) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://wwdnuxpzsmdbeffhdsoy.supabase.co",
          "X-OpenRouter-Title": "Shepard Advisor",
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [
            {
              role: "system",
              content: "Return only valid compact JSON. Do not include markdown.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.25,
          max_tokens: 350,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${OPENROUTER_MODEL}: openrouter_http_${response.status}: ${errorText.slice(0, 180)}`);
      }
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || "{}";
      return {
        ...fallbackAiSummary(cause, risk, language),
        ...parseJsonObject(text),
        language,
        source: data.model || OPENROUTER_MODEL,
        fallback_reason: null,
        provider_error: "",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      errors.push(message);
      console.error("OpenRouter summary failed:", message);
    }
  }

  return fallbackAiSummary(cause, risk, language, "ai_provider_request_failed", errors.join(" | ").slice(0, 600));
}

async function readCached(symbol: string, timeframe: Timeframe) {
  const { data } = await supabase
    .from("coin_analyses")
    .select("*")
    .eq("symbol", symbol)
    .eq("timeframe", timeframe)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function readRecentAiSummary(symbol: string, timeframe: Timeframe, language: OutputLanguage) {
  const minCreatedAt = new Date(Date.now() - ttlMinutes(timeframe) * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("coin_analyses")
    .select("ai_summary_json")
    .eq("symbol", symbol)
    .eq("timeframe", timeframe)
    .gte("created_at", minCreatedAt)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const summary = data?.ai_summary_json;
  return summary?.language === language ? summary : null;
}

async function analyzeCoin(symbolInput: string, timeframeInput: string, auth: AuthContext, force = false, language: OutputLanguage = "tr") {
  const symbol = normalizeSymbol(symbolInput);
  const timeframe = TIMEFRAMES.includes(timeframeInput as Timeframe) ? timeframeInput as Timeframe : "15m";
  if (!force) {
    const cached = await readCached(symbol, timeframe);
    if (cached?.cause_json && Object.keys(cached.cause_json).length > 0 && cached.ai_summary_json?.language === language) {
      return { ...cached, cache_hit: true, usage_counted: false };
    }
  }

  const klines = await fetchKlines(symbol, timeframe);
  if (klines.length < 60) throw new Error("Not enough candle data");

  const price = klines.at(-1)?.close || 0;
  const [orderbook, trades, indicators, social, news] = await Promise.all([
    fetchOrderbook(symbol, price),
    fetchRecentTrades(symbol, price),
    Promise.resolve(calculateIndicators(klines)),
    fetchSocialSummary(symbol),
    fetchNewsSummary(symbol),
  ]);
  const risk = calculateRisk(indicators, orderbook, price);
  const microstructure = {
    orderbook,
    trades,
    taker_buy_ratio: indicators.takerBuyRatio,
    abnormal_volume: indicators.volumeZScore,
    abnormal_trade_count: indicators.tradeCountZScore,
    candle_expansion: indicators.candleExpansion,
  };
  const cause = calculateCause(indicators, risk, orderbook, trades, social, news);
  const confidence = {
    confidence_score: cause.confidence_score,
    data_quality: {
      binance_klines: "ok",
      orderbook: orderbook.bidDepthUsd + orderbook.askDepthUsd > 0 ? "ok" : "unavailable",
      trades: trades.largeTradeCount >= 0 ? "ok" : "unavailable",
      social: social.status,
      news: news.status,
    },
  };
  const recentAiSummary = await readRecentAiSummary(symbol, timeframe, language);
  if (!recentAiSummary) {
    await assertCanGenerateAi(auth);
  }
  const aiSummary = recentAiSummary || await getAiSummary(symbol, timeframe, price, indicators, risk, cause, microstructure, social, news, language);
  if (!recentAiSummary) {
    await incrementUsage(auth.userId, "ai_analysis_count");
  }
  const expiresAt = new Date(Date.now() + ttlMinutes(timeframe) * 60 * 1000).toISOString();
  const baseInsert = {
    symbol,
    timeframe,
    price,
    indicator_json: indicators,
    risk_json: risk,
    social_json: social,
    ai_summary_json: aiSummary,
    expires_at: expiresAt,
  };
  const { data, error } = await supabase
    .from("coin_analyses")
    .insert({
      ...baseInsert,
      cause_json: cause,
      market_microstructure_json: microstructure,
      news_json: news,
      confidence_json: confidence,
    })
    .select("*")
    .single();

  if (error) {
    const missingNewColumns = ["cause_json", "market_microstructure_json", "news_json", "confidence_json"]
      .some((column) => error.message.includes(column));
    if (!missingNewColumns) throw new Error(error.message);

    const { data: fallbackData, error: fallbackError } = await supabase
      .from("coin_analyses")
      .insert(baseInsert)
      .select("*")
      .single();
    if (fallbackError) throw new Error(fallbackError.message);
    return {
      ...fallbackData,
      cause_json: cause,
      market_microstructure_json: microstructure,
      news_json: news,
      confidence_json: confidence,
      cache_hit: false,
      ai_cache_hit: Boolean(recentAiSummary),
      usage_counted: !recentAiSummary,
      schema_fallback: true,
    };
  }

  return { ...data, cache_hit: false, ai_cache_hit: Boolean(recentAiSummary), usage_counted: !recentAiSummary };
}

async function scanMarket(auth: AuthContext) {
  if (!auth.entitlement.canRunScanner) {
    throw new ApiError(403, "SCANNER_REQUIRES_TRADER", "Market scanner tetikleme Trader planinda aciktir.", {
      plan: auth.plan,
    });
  }
  await incrementUsage(auth.userId, "scanner_run_count");
  const symbols = await fetchTopSymbols(40);
  const analyzed = [];
  for (const symbol of symbols) {
    try {
      const result = await analyzeCoin(symbol, "15m", auth, false, "tr");
      const risk = result.risk_json as RiskSummary;
      const cause = result.cause_json as CauseSummary | undefined;
      if (
        risk.pump_dump_risk_score >= 45 ||
        risk.volume_confirmation_score >= 65 ||
        risk.whale_risk_score >= 55 ||
        (cause?.early_warning_score || 0) >= 55 ||
        (cause?.confidence_score || 0) >= 70
      ) {
        analyzed.push(result);
      }
      if (analyzed.length >= 12) break;
    } catch (error) {
      console.error(`scan failed for ${symbol}:`, error);
    }
  }
  return analyzed;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("coin_analyses")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ analyses: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const auth = await getAuthContext(req);
    if (body.mode === "scan-market") {
      const analyses = await scanMarket(auth);
      return new Response(JSON.stringify({ analyses, scanned_at: new Date().toISOString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysis = await analyzeCoin(body.symbol || "BTCUSDT", body.timeframe || "15m", auth, Boolean(body.force), normalizeLanguage(body.language));
    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return new Response(JSON.stringify({ error: error.message, code: error.code, ...error.details }), {
        status: error.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
