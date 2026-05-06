import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { calculateCause, calculateIndicators, calculateRisk, fetchKlines, normalizeSymbol, normalizeTimeframe, round, type IndicatorSummary, type Kline, type Timeframe } from "../_shared/analysis-engine.ts";
import { json, requireAdmin, serviceClient } from "../_shared/admin-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const flatOrderbook = { bidDepthUsd: 2_000_000, askDepthUsd: 2_000_000, spreadPct: 0.02, imbalancePct: 0, isThin: false };
const flatTrades = { largeTradeCount: 0, largeTradeUsd: 0, largestTradeUsd: 0, buyPressurePct: 50, sellPressurePct: 50 };

function thresholdFor(timeframe: Timeframe) {
  if (timeframe === "5m") return 0.8;
  if (timeframe === "15m") return 1.1;
  if (timeframe === "30m") return 1.5;
  return 2.2;
}

function lookaheadBars(timeframe: Timeframe) {
  if (timeframe === "5m") return 24;
  if (timeframe === "15m") return 12;
  if (timeframe === "30m") return 8;
  return 6;
}

function outcome(klines: Kline[], index: number, movePct: number, timeframe: Timeframe, indicators: IndicatorSummary) {
  const start = klines[index];
  const future = klines.slice(index + 1, index + 1 + lookaheadBars(timeframe));
  if (!future.length) return "unknown";
  const direction = movePct >= 0 ? 1 : -1;
  const maxMove = Math.max(...future.map((k) => direction > 0 ? (k.high - start.close) / start.close * 100 : (start.close - k.low) / start.close * 100));
  const endMove = (future.at(-1)!.close - start.close) / start.close * 100 * direction;
  const wickTrap = direction > 0 ? indicators.upperWickPct > 45 : indicators.lowerWickPct > 45;
  if (wickTrap && endMove < 0) return "wick_trap";
  if (endMove > Math.abs(movePct) * 0.35 || maxMove > Math.abs(movePct) * 0.8) return "continued";
  if (endMove < -Math.abs(movePct) * 0.35) return "reversed";
  return "low_signal";
}

function detectEvents(symbol: string, timeframe: Timeframe, klines: Kline[]) {
  const events = [];
  const threshold = thresholdFor(timeframe);
  for (let i = 60; i < klines.length - 2; i++) {
    const window = klines.slice(Math.max(0, i - 80), i + 1);
    const current = klines[i];
    const previous = klines[i - 1];
    const movePct = previous.close > 0 ? (current.close - previous.close) / previous.close * 100 : 0;
    const indicators = calculateIndicators(window);
    const risk = calculateRisk(indicators, flatOrderbook, current.close);
    const cause = calculateCause(indicators, risk, flatOrderbook, flatTrades);
    const isSignal =
      Math.abs(movePct) >= threshold ||
      indicators.volumeZScore >= 2.5 ||
      indicators.candleExpansion >= 2 ||
      risk.pump_dump_risk_score >= 45 ||
      cause.early_warning_score >= 45;
    if (!isSignal) continue;
    events.push({
      symbol,
      timeframe,
      event_start: new Date(current.openTime).toISOString(),
      event_end: new Date(current.closeTime).toISOString(),
      move_pct: round(movePct, 2),
      volume_zscore: indicators.volumeZScore,
      detected_label: cause.likely_cause,
      realized_outcome: outcome(klines, i, movePct, timeframe, indicators),
      confidence_score: cause.confidence_score,
      details_json: { indicators, risk, cause },
    });
    i += 2;
  }
  return events;
}

function metrics(events: Array<{ detected_label: string; realized_outcome: string; confidence_score: number }>) {
  const total = events.length;
  const positives = events.filter((event) => event.realized_outcome === "continued" || event.realized_outcome === "wick_trap");
  const falsePositive = events.filter((event) => event.realized_outcome === "low_signal" || event.realized_outcome === "unknown");
  const fraudOrWhale = events.filter((event) => ["whale_push", "fraud_pump_risk", "thin_liquidity_move", "fomo_trap"].includes(event.detected_label));
  return {
    event_count: total,
    precision: total ? round(positives.length / total * 100, 1) : 0,
    false_positive_rate: total ? round(falsePositive.length / total * 100, 1) : 0,
    whale_fraud_proxy_rate: total ? round(fraudOrWhale.length / total * 100, 1) : 0,
    avg_confidence: total ? round(events.reduce((sum, event) => sum + Number(event.confidence_score || 0), 0) / total, 1) : 0,
  };
}

async function runHistorical(body: Record<string, unknown>, userId: string) {
  const supabase = serviceClient();
  const timeframe = normalizeTimeframe(body.timeframe);
  const symbols = ((body.symbols as string[] | undefined) || ["BTCUSDT", "ETHUSDT", "SOLUSDT"]).slice(0, 20).map(normalizeSymbol);
  const from = body.from ? new Date(String(body.from)).getTime() : Date.now() - 14 * 86400000;
  const to = body.to ? new Date(String(body.to)).getTime() : Date.now();
  const allEvents = [];
  for (const symbol of symbols) {
    const klines = await fetchKlines(symbol, timeframe, 1000, from, to);
    allEvents.push(...detectEvents(symbol, timeframe, klines));
  }
  const metricsJson = metrics(allEvents);
  const { data, error } = await supabase.from("backtest_runs").insert({
    config_json: { mode: "historical_kline", timeframe, from: new Date(from).toISOString(), to: new Date(to).toISOString() },
    symbols,
    date_range: `[${new Date(from).toISOString()},${new Date(to).toISOString()}]`,
    metrics_json: metricsJson,
    events_json: allEvents.slice(0, 500),
    created_by: userId,
  }).select("*").single();
  if (error) throw error;
  return { run: data, events: allEvents.slice(0, 200), metrics: metricsJson };
}

async function runSnapshot(body: Record<string, unknown>, userId: string) {
  const supabase = serviceClient();
  const timeframe = normalizeTimeframe(body.timeframe);
  const symbols = ((body.symbols as string[] | undefined) || []).map(normalizeSymbol);
  const from = body.from ? new Date(String(body.from)).toISOString() : new Date(Date.now() - 7 * 86400000).toISOString();
  const to = body.to ? new Date(String(body.to)).toISOString() : new Date().toISOString();
  let query = supabase
    .from("movement_events")
    .select("*")
    .eq("timeframe", timeframe)
    .gte("event_start", from)
    .lte("event_start", to)
    .order("event_start", { ascending: false })
    .limit(500);
  if (symbols.length) query = query.in("symbol", symbols);
  const { data: events, error } = await query;
  if (error) throw error;
  const metricsJson = metrics((events || []).map((event) => ({
    detected_label: event.detected_label,
    realized_outcome: event.realized_outcome,
    confidence_score: Number(event.confidence_score || 0),
  })));
  const runSymbols = symbols.length ? symbols : Array.from(new Set((events || []).map((event) => event.symbol)));
  const { data, error: runError } = await supabase.from("backtest_runs").insert({
    config_json: { mode: "snapshot", timeframe, from, to },
    symbols: runSymbols,
    date_range: `[${from},${to}]`,
    metrics_json: metricsJson,
    events_json: events || [],
    created_by: userId,
  }).select("*").single();
  if (runError) throw runError;
  return { run: data, events: events || [], metrics: metricsJson };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, corsHeaders);
  try {
    const user = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "historical_kline";
    if (mode === "snapshot") return json(await runSnapshot(body, user.id), 200, corsHeaders);
    return json(await runHistorical(body, user.id), 200, corsHeaders);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backtest failed";
    return json({ error: message }, message.includes("Admin") || message.includes("Unauthorized") ? 403 : 500, corsHeaders);
  }
});
