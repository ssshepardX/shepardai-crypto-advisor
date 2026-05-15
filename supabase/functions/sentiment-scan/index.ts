import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { scanMarketSentiment, scanSymbolSentiment } from "../_shared/sentiment-engine.ts";
import { adminEmails, hasValidCronSecret, json, serviceClient } from "../_shared/admin-auth.ts";
import { normalizeSymbol } from "../_shared/analysis-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

type PlanId = "free" | "pro" | "trader";
const PLAN_PRIORITY: Record<PlanId, number> = { free: 0, pro: 1, trader: 2 };

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

function ttlMinutes(mode: string, hasSignal = true) {
  if (mode === "market") return hasSignal ? 60 : 15;
  return hasSignal ? 720 : 60;
}

function hasSentimentSignal(result: Record<string, unknown>) {
  const trends = Array.isArray(result.trends) ? result.trends as Array<{ score_json?: { source_count?: number; mention_score?: number } }> : [];
  if (trends.length) {
    return trends.some((trend) => Number(trend.score_json?.source_count || 0) > 0 || Number(trend.score_json?.mention_score || 0) > 0);
  }
  const score = result.score_json as { source_count?: number; mention_score?: number } | undefined;
  return Number(score?.source_count || 0) > 0 || Number(score?.mention_score || 0) > 0;
}

function isAdminEmail(email?: string | null) {
  const normalized = email?.trim().toLowerCase();
  return Boolean(normalized && adminEmails().includes(normalized));
}

function normalizePlan(plan: string | null | undefined): PlanId {
  if (plan === "pro" || plan === "trader") return plan;
  return "free";
}

async function authContext(req: Request) {
  if (hasValidCronSecret(req)) return { userId: null, email: null, plan: "trader" as PlanId, cron: true };
  const supabase = serviceClient();
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) throw new ApiError(401, "AUTH_REQUIRED", "Oturum gerekli.");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new ApiError(401, "AUTH_INVALID", "Oturum dogrulanamadi.");
  const email = data.user.email || null;
  if (isAdminEmail(email)) return { userId: data.user.id, email, plan: "trader" as PlanId, cron: false };
  const { data: subscriptions } = await supabase
    .from("user_subscriptions")
    .select("plan")
    .eq("user_id", data.user.id)
    .eq("active", true)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false });
  const plan = (subscriptions || [])
    .map((row) => normalizePlan(row.plan))
    .sort((a, b) => PLAN_PRIORITY[b] - PLAN_PRIORITY[a])[0] || "free";
  return { userId: data.user.id, email, plan, cron: false };
}

function assertAllowed(plan: PlanId) {
  if (plan === "free") {
    throw new ApiError(403, "SENTIMENT_REQUIRES_PRO", "Sentiment intelligence is available on Pro and Trader.", { plan });
  }
}

async function readCached(symbol: string, mode: "market" | "coin") {
  const supabase = serviceClient();
  if (mode === "market") {
    const { data } = await supabase
      .from("sentiment_snapshots")
      .select("*")
      .eq("symbol", "MARKET")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  }
  const { data } = await supabase
    .from("sentiment_snapshots")
    .select("*")
    .eq("symbol", symbol)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function writeSnapshot(symbol: string, result: Record<string, unknown>, mode: "market" | "coin") {
  const supabase = serviceClient();
  const expiresAt = new Date(Date.now() + ttlMinutes(mode, hasSentimentSignal(result)) * 60 * 1000).toISOString();
  const row = mode === "market"
    ? {
      symbol: "MARKET",
      source_json: { mode, count: Array.isArray(result.trends) ? result.trends.length : 0 },
      score_json: result.summary || {},
      trend_json: result,
      expires_at: expiresAt,
    }
    : {
      symbol,
      source_json: result.source_json || {},
      score_json: result.score_json || {},
      trend_json: result.trend_json || {},
      expires_at: expiresAt,
    };
  const { data, error } = await supabase.from("sentiment_snapshots").insert(row).select("*").single();
  if (error) {
    console.error("sentiment cache write failed:", error.message);
    return null;
  }
  return data;
}

async function updateSources(result: Record<string, unknown>) {
  const supabase = serviceClient();
  const providers = result.source_json && typeof result.source_json === "object"
    ? (result.source_json as { providers?: Record<string, { status: string; error?: string }> }).providers || {}
    : {};
  const writes = await Promise.allSettled(Object.entries(providers).map(([provider, info]) =>
    supabase.from("sentiment_sources").upsert({
      provider,
      status: info.status,
      last_error: info.error || null,
      last_success_at: info.status === "configured" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }),
  ));
  const failed = writes.filter((write) => write.status === "rejected").length;
  if (failed) console.error("sentiment source status writes failed:", failed);
}

async function marketScan(limitInput: unknown) {
  const limit = Math.min(Math.max(Number(limitInput || 12), 3), 20);
  const cached = await readCached("MARKET", "market");
  if (cached) return { trends: cached.trend_json?.trends || [], summary: cached.score_json || {}, cache_hit: true, created_at: cached.created_at };

  const trends = await scanMarketSentiment(limit);
  for (const result of trends) await updateSources(result as unknown as Record<string, unknown>);
  const summary = {
    most_mentioned: trends[0]?.symbol || null,
    news_mood: trends.length ? Math.round(trends.reduce((sum, item) => sum + item.score_json.sentiment_score, 0) / trends.length) : 50,
    reddit_heat: trends.length ? Math.round(trends.reduce((sum, item) => sum + item.trend_json.reddit_heat, 0) / trends.length) : 0,
    asia_watch: trends.length ? Math.round(trends.reduce((sum, item) => sum + item.trend_json.asia_watch_score, 0) / trends.length) : 0,
  };
  await writeSnapshot("MARKET", { trends, summary }, "market");
  return { trends, summary, cache_hit: false, created_at: new Date().toISOString() };
}

async function coinScan(symbolInput: unknown) {
  const symbol = normalizeSymbol(String(symbolInput || "BTCUSDT"));
  const cached = await readCached(symbol, "coin");
  if (cached) {
    return {
      sentiment: {
        symbol,
        source_json: cached.source_json,
        score_json: cached.score_json,
        trend_json: cached.trend_json,
      },
      cache_hit: true,
      created_at: cached.created_at,
    };
  }
  const result = await scanSymbolSentiment(symbol);
  await updateSources(result as unknown as Record<string, unknown>);
  const row = await writeSnapshot(symbol, result as unknown as Record<string, unknown>, "coin");
  return { sentiment: result, cache_hit: false, created_at: row?.created_at || new Date().toISOString() };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!["POST", "GET"].includes(req.method)) return json({ error: "Method not allowed" }, 405, corsHeaders);

  try {
    const auth = await authContext(req);
    assertAllowed(auth.plan);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const url = new URL(req.url);
    const mode = String(body.mode || url.searchParams.get("mode") || "market");
    if (mode === "coin") {
      return json(await coinScan(body.symbol || url.searchParams.get("symbol")), 200, corsHeaders);
    }
    return json(await marketScan(body.limit || url.searchParams.get("limit")), 200, corsHeaders);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const payload = error instanceof ApiError
      ? { error: error.message, code: error.code, ...error.details }
      : { error: error instanceof Error ? error.message : "Sentiment scan failed" };
    return json(payload, status, corsHeaders);
  }
});
