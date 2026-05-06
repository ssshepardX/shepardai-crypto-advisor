import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { calculateCause, calculateIndicators, calculateRisk, fetchKlines, fetchOrderbook, fetchRecentTrades, fetchTopSymbols, normalizeTimeframe } from "../_shared/analysis-engine.ts";
import { hasValidCronSecret, json, requireAdmin, serviceClient } from "../_shared/admin-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

async function collect(symbolsInput: string[] | undefined, timeframeInput: unknown, limitInput: unknown) {
  const supabase = serviceClient();
  const timeframe = normalizeTimeframe(timeframeInput);
  const limit = Math.min(Number(limitInput || 40), 40);
  const symbols = (symbolsInput?.length ? symbolsInput : await fetchTopSymbols(limit)).slice(0, limit);
  const inserted = [];
  const events = [];
  const errors = [];

  for (const symbol of symbols) {
    try {
      const klines = await fetchKlines(symbol, timeframe, 180);
      const price = klines.at(-1)?.close || 0;
      const [orderbook, trades] = await Promise.all([
        fetchOrderbook(symbol, price),
        fetchRecentTrades(symbol, price),
      ]);
      const indicators = calculateIndicators(klines);
      const risk = calculateRisk(indicators, orderbook, price);
      const cause = calculateCause(indicators, risk, orderbook, trades);
      const latest = klines.at(-1);
      const previous = klines.at(-2);
      const movePct = latest && previous?.close ? ((latest.close - previous.close) / previous.close) * 100 : 0;
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

  return { inserted, events, errors, snapshot_count: inserted.length, event_count: events.length };
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
