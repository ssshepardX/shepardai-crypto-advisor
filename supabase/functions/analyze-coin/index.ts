import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIMEFRAMES = ["5m", "15m", "30m", "1h", "4h"] as const;
type Timeframe = typeof TIMEFRAMES[number];

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

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function getGeminiApiKey(): string {
  return Deno.env.get("GEMINI_API_KEY") ||
    Deno.env.get("GOOGLE_API_KEY") ||
    Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") ||
    "";
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
  const totalQuote = klines.reduce((sum, kline) => sum + kline.quoteVolume, 0);
  const totalBase = klines.reduce((sum, kline) => sum + kline.volume, 0);
  const takerBuyRatio = last.quoteVolume > 0 ? last.takerBuyQuoteVolume / last.quoteVolume : 0.5;
  const candleRange = Math.max(last.high - last.low, 0.00000001);
  const bodyPct = Math.abs(last.close - last.open) / candleRange * 100;
  const upperWickPct = (last.high - Math.max(last.open, last.close)) / candleRange * 100;
  const lowerWickPct = (Math.min(last.open, last.close) - last.low) / candleRange * 100;
  const swingWindow = klines.slice(-40);

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
    support: round(Math.min(...swingWindow.map((kline) => kline.low))),
    resistance: round(Math.max(...swingWindow.map((kline) => kline.high))),
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

function fallbackAiSummary(risk: RiskSummary) {
  const isBullish = risk.trend_score >= 60 && risk.momentum_score >= 55;
  const continuation = clamp((risk.trend_score + risk.momentum_score + risk.volume_confirmation_score - risk.reversal_risk_score) / 3);
  const riskLevel = risk.pump_dump_risk_score > 70 ? "High" : risk.pump_dump_risk_score > 45 ? "Moderate" : "Low";
  return {
    direction_bias: isBullish ? "up" : risk.momentum_score < 40 ? "down" : "neutral",
    continuation_probability: round(continuation, 0),
    risk_level: riskLevel,
    summary_tr: "Teknik skorlar algoritmik olarak hesaplandı. AI özeti için GEMINI_API_KEY Supabase secrets içinde tanımlanmalı.",
    watch_points: risk.labels.slice(0, 3),
    not_advice_notice: "Bu finansal tavsiye değildir; yalnızca piyasa sinyalidir.",
  };
}

async function getAiSummary(symbol: string, timeframe: Timeframe, price: number, indicators: IndicatorSummary, risk: RiskSummary, social: Record<string, unknown>) {
  const geminiApiKey = getGeminiApiKey();
  if (!geminiApiKey) return fallbackAiSummary(risk);

  const compactPayload = {
    symbol,
    timeframe,
    price: round(price),
    scores: {
      trend: risk.trend_score,
      momentum: risk.momentum_score,
      volume: risk.volume_confirmation_score,
      reversal: risk.reversal_risk_score,
      whale: risk.whale_risk_score,
      pumpDump: risk.pump_dump_risk_score,
    },
    indicators: {
      rsi14: indicators.rsi14,
      macdHistogram: indicators.macdHistogram,
      atrPct: indicators.atrPct,
      volumeMultiplier: indicators.volumeMultiplier,
      takerBuyRatio: indicators.takerBuyRatio,
    },
    labels: risk.labels,
    social,
  };

  const prompt = `Kisa ve temkinli bir Turkce kripto piyasa yorumu uret. Ham veriye karar verme; skorlar zaten hesaplandi. JSON disinda metin yazma.\n${JSON.stringify(compactPayload)}\nOutput schema: {"direction_bias":"up|down|neutral","continuation_probability":0-100,"risk_level":"Low|Moderate|High|Critical","summary_tr":"max 2 cumle","watch_points":["max 3 kisa madde"],"not_advice_notice":"Bu finansal tavsiye degildir."}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
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
    if (!response.ok) throw new Error(`Gemini failed: ${response.status}`);
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    return { ...fallbackAiSummary(risk), ...JSON.parse(text) };
  } catch (error) {
    console.error("AI summary failed:", error);
    return fallbackAiSummary(risk);
  }
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

async function analyzeCoin(symbolInput: string, timeframeInput: string, force = false) {
  const symbol = normalizeSymbol(symbolInput);
  const timeframe = TIMEFRAMES.includes(timeframeInput as Timeframe) ? timeframeInput as Timeframe : "15m";
  if (!force) {
    const cached = await readCached(symbol, timeframe);
    if (cached) return { ...cached, cache_hit: true };
  }

  const klines = await fetchKlines(symbol, timeframe);
  if (klines.length < 60) throw new Error("Not enough candle data");

  const price = klines.at(-1)?.close || 0;
  const [orderbook, indicators] = await Promise.all([
    fetchOrderbook(symbol, price),
    Promise.resolve(calculateIndicators(klines)),
  ]);
  const risk = calculateRisk(indicators, orderbook, price);
  const social = {
    tweet_count_delta: null,
    sentiment_score: null,
    source_region: null,
    social_confidence: null,
    status: "not_configured",
  };
  const aiSummary = await getAiSummary(symbol, timeframe, price, indicators, risk, social);
  const expiresAt = new Date(Date.now() + ttlMinutes(timeframe) * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("coin_analyses")
    .insert({
      symbol,
      timeframe,
      price,
      indicator_json: indicators,
      risk_json: risk,
      social_json: social,
      ai_summary_json: aiSummary,
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return { ...data, cache_hit: false };
}

async function scanMarket() {
  const symbols = await fetchTopSymbols(40);
  const analyzed = [];
  for (const symbol of symbols) {
    try {
      const result = await analyzeCoin(symbol, "15m", false);
      const risk = result.risk_json as RiskSummary;
      if (risk.pump_dump_risk_score >= 45 || risk.volume_confirmation_score >= 65 || risk.whale_risk_score >= 55) {
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
    if (body.mode === "scan-market") {
      const analyses = await scanMarket();
      return new Response(JSON.stringify({ analyses, scanned_at: new Date().toISOString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysis = await analyzeCoin(body.symbol || "BTCUSDT", body.timeframe || "15m", Boolean(body.force));
    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
