export const TIMEFRAMES = ["5m", "15m", "30m", "1h", "4h"] as const;
export type Timeframe = typeof TIMEFRAMES[number];

export type Kline = {
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

export type OrderbookSummary = {
  bidDepthUsd: number;
  askDepthUsd: number;
  spreadPct: number;
  imbalancePct: number;
  isThin: boolean;
};

export type TradeSummary = {
  largeTradeCount: number;
  largeTradeUsd: number;
  largestTradeUsd: number;
  buyPressurePct: number;
  sellPressurePct: number;
};

export type IndicatorSummary = {
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

export type RiskSummary = {
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

export type CauseSummary = {
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

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

export function round(value: number, digits = 4): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function normalizeSymbol(symbol: string): string {
  const cleaned = symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.endsWith("USDT") ? cleaned : `${cleaned}USDT`;
}

export function normalizeTimeframe(value: unknown): Timeframe {
  return TIMEFRAMES.includes(value as Timeframe) ? value as Timeframe : "15m";
}

export async function fetchKlines(symbol: string, timeframe: Timeframe, limit = 180, startTime?: number, endTime?: number): Promise<Kline[]> {
  const params = new URLSearchParams({ symbol, interval: timeframe, limit: String(Math.min(limit, 1000)) });
  if (startTime) params.set("startTime", String(startTime));
  if (endTime) params.set("endTime", String(endTime));
  const response = await fetch(`https://api.binance.com/api/v3/klines?${params.toString()}`);
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

export async function fetchTopSymbols(limit = 40): Promise<string[]> {
  const response = await fetch("https://api.binance.com/api/v3/ticker/24hr");
  if (!response.ok) return [];
  const rows = await response.json();
  return rows
    .filter((ticker: { symbol: string; quoteVolume: string }) => ticker.symbol.endsWith("USDT"))
    .sort((a: { quoteVolume: string }, b: { quoteVolume: string }) => Number(b.quoteVolume) - Number(a.quoteVolume))
    .slice(0, limit)
    .map((ticker: { symbol: string }) => ticker.symbol);
}

export async function fetchOrderbook(symbol: string, price: number): Promise<OrderbookSummary> {
  const response = await fetch(`https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=100`);
  if (!response.ok) return { bidDepthUsd: 0, askDepthUsd: 0, spreadPct: 0, imbalancePct: 0, isThin: true };
  const data = await response.json();
  const bids = data.bids as [string, string][];
  const asks = data.asks as [string, string][];
  const lower = price * 0.98;
  const upper = price * 1.02;
  const bestBid = Number(bids[0]?.[0] || price);
  const bestAsk = Number(asks[0]?.[0] || price);
  const bidDepthUsd = bids.filter(([p]) => Number(p) >= lower).reduce((sum, [p, q]) => sum + Number(p) * Number(q), 0);
  const askDepthUsd = asks.filter(([p]) => Number(p) <= upper).reduce((sum, [p, q]) => sum + Number(p) * Number(q), 0);
  const totalDepth = bidDepthUsd + askDepthUsd;
  return {
    bidDepthUsd: round(bidDepthUsd, 2),
    askDepthUsd: round(askDepthUsd, 2),
    spreadPct: round(price > 0 ? ((bestAsk - bestBid) / price) * 100 : 0, 4),
    imbalancePct: round(totalDepth > 0 ? ((bidDepthUsd - askDepthUsd) / totalDepth) * 100 : 0, 2),
    isThin: totalDepth < 1_300_000,
  };
}

export async function fetchRecentTrades(symbol: string, price: number): Promise<TradeSummary> {
  const response = await fetch(`https://api.binance.com/api/v3/aggTrades?symbol=${symbol}&limit=500`);
  if (!response.ok) return { largeTradeCount: 0, largeTradeUsd: 0, largestTradeUsd: 0, buyPressurePct: 50, sellPressurePct: 50 };
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

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
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
    trs.push(Math.max(current.high - current.low, Math.abs(current.high - previous.close), Math.abs(current.low - previous.close)));
  }
  return trs.reduce((sum, value) => sum + value, 0) / trs.length;
}

function bollinger(values: number[], period = 20) {
  const slice = values.slice(-period);
  const middle = slice.reduce((sum, value) => sum + value, 0) / slice.length;
  const deviation = standardDeviation(slice);
  return { upper: middle + deviation * 2, middle, lower: middle - deviation * 2 };
}

export function calculateIndicators(klines: Kline[]): IndicatorSummary {
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

export function calculateRisk(indicators: IndicatorSummary, orderbook: OrderbookSummary, price: number): RiskSummary {
  const trendScore = clamp((price > indicators.ema9 ? 25 : 0) + (indicators.ema9 > indicators.ema21 ? 25 : 0) + (indicators.ema21 > indicators.ema50 ? 25 : 0) + (price > indicators.vwap ? 25 : 0));
  const momentumScore = clamp((indicators.rsi14 > 55 ? 25 : indicators.rsi14 < 45 ? -10 : 10) + (indicators.macdHistogram > 0 ? 35 : 5) + (indicators.takerBuyRatio > 0.55 ? 25 : 10) + (indicators.bodyPct > 55 ? 15 : 5));
  const volatilityScore = clamp(indicators.atrPct * 14 + Math.abs(indicators.bollingerUpper - indicators.bollingerLower) / price * 400);
  const volumeConfirmationScore = clamp((indicators.volumeMultiplier - 1) * 28 + Math.max(0, indicators.takerBuyRatio - 0.5) * 120);
  const reversalRiskScore = clamp((indicators.rsi14 > 78 ? 32 : indicators.rsi14 < 25 ? 20 : 0) + (indicators.upperWickPct > 45 ? 25 : 0) + (indicators.volumeMultiplier > 4 ? 25 : 0) + (price > indicators.resistance * 0.995 ? 10 : 0));
  const whaleRiskScore = clamp((orderbook.isThin ? 30 : 0) + (Math.abs(orderbook.imbalancePct) > 35 ? 22 : 0) + (orderbook.spreadPct > 0.08 ? 18 : 0) + (indicators.volumeMultiplier > 3 ? 18 : 0) + (indicators.takerBuyRatio > 0.7 || indicators.takerBuyRatio < 0.3 ? 12 : 0));
  const pumpDumpRiskScore = clamp(reversalRiskScore * 0.35 + whaleRiskScore * 0.35 + volumeConfirmationScore * 0.2 + volatilityScore * 0.1);
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

export function calculateCause(indicators: IndicatorSummary, risk: RiskSummary, orderbook: OrderbookSummary, trades: TradeSummary, social: Record<string, unknown> = {}, news: Record<string, unknown> = {}): CauseSummary {
  const socialConfidence = Number(social.confidence || social.social_confidence || 0);
  const newsConfidence = Number(news.confidence || 0);
  const newsSocial = clamp((Number(social.mention_delta || 0) * 7 + socialConfidence * 0.6 + newsConfidence * 0.9 + Number(news.source_count || 0) * 8) / 2);
  const technicalBreakout = clamp(risk.trend_score * 0.35 + risk.volume_confirmation_score * 0.25 + Math.max(0, indicators.rangeBreakoutPct) * 10 + indicators.multiTimeframeAgreement * 0.2 + Math.max(0, indicators.priceAccelerationPct) * 3);
  const lowLiquidity = clamp((orderbook.isThin ? 45 : 0) + Math.max(0, orderbook.spreadPct - 0.03) * 250 + Math.abs(orderbook.imbalancePct) * 0.45);
  const whale = clamp(risk.whale_risk_score * 0.45 + trades.largeTradeCount * 6 + Math.min(35, trades.largeTradeUsd / 150_000) + Math.max(0, trades.buyPressurePct - 58) * 0.8 + Math.max(0, trades.sellPressurePct - 58) * 0.8);
  const fraudPump = clamp(risk.pump_dump_risk_score * 0.45 + risk.reversal_risk_score * 0.25 + lowLiquidity * 0.25 + (indicators.upperWickPct > 40 ? 18 : 0) + (indicators.volumeZScore > 3 ? 15 : 0));
  const organic = clamp(technicalBreakout * 0.45 + risk.momentum_score * 0.25 + risk.volume_confirmation_score * 0.25 - fraudPump * 0.2 - lowLiquidity * 0.15);
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
  const map: Record<string, CauseSummary["likely_cause"]> = {
    organic: "organic_demand",
    whale: "whale_push",
    fraud_pump: "fraud_pump_risk",
    news_social: "news_social_catalyst",
    technical_breakout: "organic_demand",
    low_liquidity: "thin_liquidity_move",
  };
  const likelyCause = sorted[0]?.[1] < 35 ? "balanced_market" : map[top] || "balanced_market";
  const confidence = clamp(35 + (orderbook.bidDepthUsd + orderbook.askDepthUsd > 0 ? 15 : 0) + Math.min(20, Math.abs(sorted[0]?.[1] - (sorted[1]?.[1] || 0))) + Math.min(15, newsConfidence / 8) + Math.min(15, socialConfidence / 8));
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
