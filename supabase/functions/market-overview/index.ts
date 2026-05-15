import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
);

type OverviewPanelType = "trend_news" | "scanner" | "gainers" | "losers";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function ttlMinutes(panel: OverviewPanelType) {
  return panel === "gainers" || panel === "losers" ? 5 : 15;
}

function hasValidCronSecret(req: Request) {
  const secret = Deno.env.get("CRON_SECRET") || "";
  return Boolean(secret && req.headers.get("x-cron-secret") === secret);
}

async function requireAuth(req: Request) {
  if (hasValidCronSecret(req)) return;
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) throw new Error("AUTH_REQUIRED");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error("AUTH_INVALID");
}

async function readPanel(panel: OverviewPanelType) {
  const { data, error } = await supabase
    .from("market_overview_snapshots")
    .select("payload_json,created_at")
    .eq("panel_type", panel)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data;
}

async function writePanel(panel: OverviewPanelType, payload: unknown) {
  await supabase.from("market_overview_snapshots").insert({
    panel_type: panel,
    payload_json: payload,
    expires_at: new Date(Date.now() + ttlMinutes(panel) * 60 * 1000).toISOString(),
  });
}

async function binance24h() {
  const response = await fetch("https://api.binance.com/api/v3/ticker/24hr");
  if (!response.ok) throw new Error(`BINANCE_${response.status}`);
  const data = await response.json();
  return data
    .filter((row: { symbol: string }) => row.symbol.endsWith("USDT"))
    .map((row: { symbol: string; lastPrice: string; priceChangePercent: string; quoteVolume: string }) => ({
      symbol: row.symbol,
      price: Number(row.lastPrice),
      price_change_percent: Number(row.priceChangePercent),
      quote_volume: Number(row.quoteVolume),
    }))
    .filter((row: { quote_volume: number }) => row.quote_volume > 1000000);
}

async function binanceSparkline(symbol: string, limit = 24) {
  const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=15m&limit=${limit}`);
  if (!response.ok) return [];
  const rows = await response.json();
  return rows.map((row: unknown[]) => Number(row[4]));
}

async function scannerRows() {
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const primary = await supabase
    .from("coin_analyses")
    .select("symbol,created_at,price,risk_json,cause_json,continuation_json,ai_summary_json")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(80);
  if (!primary.error) return primary.data || [];
  const fallback = await supabase
    .from("coin_analyses")
    .select("symbol,created_at,price,risk_json,cause_json,ai_summary_json")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(80);
  return fallback.data || [];
}

async function trendRows() {
  const { data } = await supabase
    .from("sentiment_snapshots")
    .select("trend_json,score_json,created_at")
    .eq("symbol", "MARKET")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function buildGainerLoserPanels() {
  const market = await binance24h();
  const scanner = await scannerRows();
  const scannerBySymbol = new Map(scanner.map((row: Record<string, unknown>) => [row.symbol as string, row]));
  const decorate = async (row: { symbol: string; price: number; price_change_percent: number; quote_volume: number }) => {
    const cached = scannerBySymbol.get(row.symbol) as Record<string, unknown> | undefined;
    const sparkline = await binanceSparkline(row.symbol);
    return {
      symbol: row.symbol,
      price: row.price,
      move_pct: Number(row.price_change_percent.toFixed(2)),
      quote_volume: Math.round(row.quote_volume),
      sparkline,
      cause: (cached?.cause_json as Record<string, unknown> | undefined)?.likely_cause || null,
      continuation: (cached?.continuation_json as Record<string, unknown> | undefined)?.continuation_label || null,
      risk_score: (cached?.risk_json as Record<string, unknown> | undefined)?.pump_dump_risk_score || null,
      reason: (cached?.ai_summary_json as Record<string, unknown> | undefined)?.catalyst_summary || (cached?.ai_summary_json as Record<string, unknown> | undefined)?.summary_tr || null,
      cached_at: cached?.created_at || null,
    };
  };
  const gainers = await Promise.all(market.slice().sort((a, b) => b.price_change_percent - a.price_change_percent).slice(0, 10).map(decorate));
  const losers = await Promise.all(market.slice().sort((a, b) => a.price_change_percent - b.price_change_percent).slice(0, 10).map(decorate));
  return { gainers, losers };
}

async function buildScannerPanel() {
  const rows = await scannerRows();
  const seen = new Set<string>();
  const items = await Promise.all(rows
    .filter((row: Record<string, unknown>) => {
      const symbol = row.symbol as string;
      if (seen.has(symbol)) return false;
      seen.add(symbol);
      return true;
    })
    .slice(0, 10)
    .map(async (row: Record<string, unknown>) => ({
      symbol: row.symbol,
      created_at: row.created_at,
      risk_score: (row.risk_json as Record<string, unknown>)?.pump_dump_risk_score || 0,
      confidence: (row.cause_json as Record<string, unknown>)?.confidence_score || 0,
      cause: (row.cause_json as Record<string, unknown>)?.likely_cause || null,
      continuation: (row.continuation_json as Record<string, unknown>)?.continuation_label || null,
      reason: (row.ai_summary_json as Record<string, unknown>)?.catalyst_summary || (row.ai_summary_json as Record<string, unknown>)?.summary_tr || null,
      sparkline: await binanceSparkline(row.symbol as string),
    })));
  return items;
}

async function buildTrendPanel() {
  const snapshot = await trendRows();
  const trends = ((snapshot?.trend_json as Record<string, unknown> | undefined)?.trends as Array<Record<string, unknown>> | undefined) || [];
  const items = trends.slice(0, 10).map((trend) => {
    const source = ((trend.source_json as Record<string, unknown> | undefined)?.items as Array<Record<string, unknown>> | undefined)?.find((item) => item.url) ||
      ((trend.source_json as Record<string, unknown> | undefined)?.items as Array<Record<string, unknown>> | undefined)?.[0];
    return {
      symbol: trend.symbol,
      sentiment_score: (trend.score_json as Record<string, unknown>)?.sentiment_score || 0,
      sentiment_label: (trend.score_json as Record<string, unknown>)?.sentiment_label || "neutral",
      reason: source?.summary || (trend.trend_json as Record<string, unknown>)?.reason_short || null,
      title: source?.title || null,
      url: source?.url || null,
      domain: source?.domain || null,
      published_at: source?.published_at || null,
    };
  });
  return {
    items,
    created_at: snapshot?.created_at || null,
    most_mentioned: (snapshot?.score_json as Record<string, unknown> | undefined)?.most_mentioned || null,
  };
}

async function buildOverview() {
  const trend_news = await readPanel("trend_news");
  const scanner = await readPanel("scanner");
  const gainers = await readPanel("gainers");
  const losers = await readPanel("losers");
  if (!trend_news && !scanner && !gainers && !losers) {
    const [liveTrend, liveScanner, movers] = await Promise.all([
      buildTrendPanel(),
      buildScannerPanel(),
      buildGainerLoserPanels(),
    ]);
    return {
      trend_news: { ...liveTrend, cache_source: "live-fallback" },
      scanner: { items: liveScanner, cache_source: "live-fallback" },
      gainers: { items: movers.gainers, cache_source: "live-fallback" },
      losers: { items: movers.losers, cache_source: "live-fallback" },
      created_at: new Date().toISOString(),
    };
  }
  return {
    trend_news: trend_news?.payload_json || { items: [], created_at: null, cache_source: "db" },
    scanner: scanner?.payload_json || { items: [], cache_source: "db" },
    gainers: gainers?.payload_json || { items: [], cache_source: "db" },
    losers: losers?.payload_json || { items: [], cache_source: "db" },
    created_at: [trend_news?.created_at, scanner?.created_at, gainers?.created_at, losers?.created_at].filter(Boolean).sort().at(-1) || null,
  };
}

async function refreshOverview() {
  const [trend_news, scanner, movers] = await Promise.all([
    buildTrendPanel(),
    buildScannerPanel(),
    buildGainerLoserPanels(),
  ]);
  await Promise.all([
    writePanel("trend_news", { ...trend_news, cache_source: "cron" }),
    writePanel("scanner", { items: scanner, cache_source: "cron" }),
    writePanel("gainers", { items: movers.gainers, cache_source: "cron" }),
    writePanel("losers", { items: movers.losers, cache_source: "cron" }),
  ]);
  return {
    trend_news: { ...trend_news, cache_source: "cron" },
    scanner: { items: scanner, cache_source: "cron" },
    gainers: { items: movers.gainers, cache_source: "cron" },
    losers: { items: movers.losers, cache_source: "cron" },
    created_at: new Date().toISOString(),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    await requireAuth(req);
    if (req.method === "POST") return json(await refreshOverview());
    return json(await buildOverview());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Market overview failed";
    const status = message.startsWith("AUTH_") ? 401 : 500;
    return json({ error: message }, status);
  }
});
