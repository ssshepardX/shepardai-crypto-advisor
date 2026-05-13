import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { calculateCause, calculateIndicators, calculateRisk, fetchKlines, fetchOrderbook, fetchRecentTrades, fetchTopSymbols, normalizeTimeframe } from "../_shared/analysis-engine.ts";
import { hasValidCronSecret, json, requireAdmin, serviceClient } from "../_shared/admin-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

async function fetchSmartSymbols(limit: number) {
  const response = await fetch("https://api.binance.com/api/v3/ticker/24hr");
  if (!response.ok) return fetchTopSymbols(limit);
  const rows = await response.json();
  const usdtRows = (rows as Array<{ symbol: string; quoteVolume: string; priceChangePercent: string }>)
    .filter((ticker) => ticker.symbol.endsWith("USDT"));
  const byVolume = [...usdtRows]
    .sort((a, b) => Number(b.quoteVolume) - Number(a.quoteVolume))
    .slice(0, Math.ceil(limit / 2))
    .map((ticker) => ticker.symbol);
  const byMovement = [...usdtRows]
    .sort((a, b) => Math.abs(Number(b.priceChangePercent)) - Math.abs(Number(a.priceChangePercent)))
    .slice(0, limit)
    .map((ticker) => ticker.symbol);
  return Array.from(new Set([...byVolume, ...byMovement])).slice(0, limit);
}

async function hasRecentSnapshot(symbol: string, timeframe: string, intervalMinutes: number) {
  const supabase = serviceClient();
  const since = new Date(Date.now() - intervalMinutes * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("market_snapshots")
    .select("id")
    .eq("symbol", symbol)
    .eq("timeframe", timeframe)
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

async function updateDailyAggregate(row: {
  symbol: string;
  timeframe: string;
  price: number;
  orderbook: { spreadPct?: number };
  indicators: { volumeZScore?: number };
  risk: { whale_risk_score?: number; pump_dump_risk_score?: number };
  cause: { likely_cause?: string };
}) {
  const supabase = serviceClient();
  const aggregateDate = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabase
    .from("market_snapshot_daily_aggregates")
    .select("*")
    .eq("symbol", row.symbol)
    .eq("timeframe", row.timeframe)
    .eq("aggregate_date", aggregateDate)
    .maybeSingle();
  const count = Number(existing?.snapshot_count || 0);
  const nextCount = count + 1;
  const average = (previous: unknown, value: number) => ((Number(previous || 0) * count) + value) / nextCount;
  await supabase
    .from("market_snapshot_daily_aggregates")
    .upsert({
      symbol: row.symbol,
      timeframe: row.timeframe,
      aggregate_date: aggregateDate,
      snapshot_count: nextCount,
      avg_price: average(existing?.avg_price, row.price),
      avg_spread_pct: average(existing?.avg_spread_pct, Number(row.orderbook.spreadPct || 0)),
      avg_volume_zscore: average(existing?.avg_volume_zscore, Number(row.indicators.volumeZScore || 0)),
      avg_whale_risk_score: average(existing?.avg_whale_risk_score, Number(row.risk.whale_risk_score || 0)),
      avg_pump_dump_risk_score: average(existing?.avg_pump_dump_risk_score, Number(row.risk.pump_dump_risk_score || 0)),
      cause_counts_json: {
        ...(existing?.cause_counts_json || {}),
        [row.cause.likely_cause || "balanced_market"]: Number(existing?.cause_counts_json?.[row.cause.likely_cause || "balanced_market"] || 0) + 1,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: "symbol,timeframe,aggregate_date" });
}

async function cleanupOldSnapshots(retentionDays: number) {
  const supabase = serviceClient();
  const before = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("market_snapshots").delete().lt("created_at", before);
}

async function collect(symbolsInput: string[] | undefined, timeframeInput: unknown, limitInput: unknown) {
  const supabase = serviceClient();
  const timeframe = normalizeTimeframe(timeframeInput);
  const limit = Math.min(Number(limitInput || 40), 40);
  const symbols = (symbolsInput?.length ? symbolsInput : await fetchSmartSymbols(limit)).slice(0, limit);
  const inserted = [];
  const skipped = [];
  const events = [];
  const errors = [];

  for (const symbol of symbols) {
    try {
      const klines = await fetchKlines(symbol, timeframe, 180);
      const price = klines.at(-1)?.close || 0;
      const quickIndicators = calculateIndicators(klines);
      const latest = klines.at(-1);
      const previous = klines.at(-2);
      const movePct = latest && previous?.close ? ((latest.close - previous.close) / previous.close) * 100 : 0;
      const active = Math.abs(movePct) >= 0.7 || quickIndicators.volumeZScore >= 2 || quickIndicators.rangeBreakout;
      const intervalMinutes = active ? 5 : 15;
      if (await hasRecentSnapshot(symbol, timeframe, intervalMinutes)) {
        skipped.push({ symbol, interval_minutes: intervalMinutes });
        continue;
      }
      const [orderbook, trades] = await Promise.all([
        fetchOrderbook(symbol, price),
        fetchRecentTrades(symbol, price),
      ]);
      const indicators = quickIndicators;
      const risk = calculateRisk(indicators, orderbook, price);
      const cause = calculateCause(indicators, risk, orderbook, trades);
      const { data, error } = await supabase
        .from("market_snapshots")
        .insert({
          symbol,
          timeframe,
          price,
          kline_json: { latest, recent: klines.slice(-60) },
          orderbook_json: orderbook,
          trades_json: trades,
          indicators_json: indicators,
          risk_json: risk,
          cause_json: cause,
        })
        .select("id,symbol,timeframe,price,created_at")
        .maybeSingle();
      if (error) throw error;
      inserted.push(data || { symbol, timeframe });
      await updateDailyAggregate({ symbol, timeframe, price, orderbook, indicators, risk, cause });
      const shouldCreateEvent =
        Math.abs(movePct) >= 1 ||
        indicators.volumeZScore >= 2.5 ||
        indicators.candleExpansion >= 2 ||
        risk.pump_dump_risk_score >= 45 ||
        cause.early_warning_score >= 55;
      if (shouldCreateEvent && latest) {
        const { data: eventData, error: eventError } = await supabase
          .from("movement_events")
          .insert({
            symbol,
            timeframe,
            event_start: new Date(latest.openTime).toISOString(),
            event_end: new Date(latest.closeTime).toISOString(),
            move_pct: movePct,
            volume_zscore: indicators.volumeZScore,
            detected_label: cause.likely_cause,
            realized_outcome: "unknown",
            confidence_score: cause.confidence_score,
            details_json: { source: "market_snapshot", indicators, risk, cause, orderbook, trades },
          })
          .select("id,symbol,detected_label,confidence_score")
          .maybeSingle();
        if (eventError) throw eventError;
        events.push(eventData);
      }
    } catch (error) {
      errors.push({ symbol, error: error instanceof Error ? error.message : "unknown_error" });
    }
  }

  await cleanupOldSnapshots(30);
  return { inserted, skipped, events, errors, snapshot_count: inserted.length, skipped_count: skipped.length, event_count: events.length };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, corsHeaders);

  try {
    if (!hasValidCronSecret(req)) await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    return json(await collect(body.symbols, body.timeframe || "15m", body.limit), 200, corsHeaders);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Snapshot failed";
    return json({ error: message }, message.includes("Admin") || message.includes("Unauthorized") ? 403 : 500, corsHeaders);
  }
});
