import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const adminEmail = (Deno.env.get("ADMIN_EMAIL") || "").toLowerCase();
const supabase = createClient(supabaseUrl, serviceKey);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getUser(req: Request) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data } = await supabase.auth.getUser(token);
  return data.user || null;
}

function isAdminEmail(email?: string | null) {
  return Boolean(adminEmail && email?.toLowerCase() === adminEmail);
}

async function listAdminData() {
  const [{ data: authUsers }, { data: profiles }, { data: subs }, { data: usage }, { data: messages }] = await Promise.all([
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabase.from("profiles").select("id, display_name, last_seen_at, satisfaction"),
    supabase.from("user_subscriptions").select("*").eq("active", true),
    supabase.from("user_usage_daily").select("*").eq("usage_date", new Date().toISOString().slice(0, 10)),
    supabase.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(100),
  ]);

  const profileMap = new Map((profiles || []).map((item) => [item.id, item]));
  const subMap = new Map((subs || []).map((item) => [item.user_id, item]));
  const usageMap = new Map((usage || []).map((item) => [item.user_id, item]));
  const now = Date.now();

  const users = (authUsers.users || []).map((user) => {
    const profile = profileMap.get(user.id);
    const sub = subMap.get(user.id);
    const lastSeen = profile?.last_seen_at ? new Date(profile.last_seen_at).getTime() : 0;
    const daysLeft = sub?.current_period_end
      ? Math.max(0, Math.ceil((new Date(sub.current_period_end).getTime() - now) / 86400000))
      : null;
    return {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      online: lastSeen > now - 5 * 60 * 1000,
      last_seen_at: profile?.last_seen_at || null,
      role: isAdminEmail(user.email) ? "admin" : "user",
      satisfaction: profile?.satisfaction || null,
      subscription: sub || null,
      days_left: daysLeft,
      usage_today: usageMap.get(user.id) || null,
    };
  });

  return { users, messages: messages || [] };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await getUser(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));

  if (!isAdminEmail(user.email)) return json({ error: "Admin required" }, 403);

  if (body.action === "list") return json(await listAdminData());

  if (body.action === "set-subscription") {
    if (!body.user_id || !["free", "pro", "trader"].includes(body.plan)) return json({ error: "Invalid input" }, 400);
    await supabase.from("user_subscriptions").update({ active: false }).eq("user_id", body.user_id).eq("active", true);
    await supabase.from("user_subscriptions").insert({
      user_id: body.user_id,
      plan: body.plan,
      interval: body.interval || "monthly",
      status: "active",
      active: true,
      current_period_start: new Date().toISOString(),
      current_period_end: body.days ? new Date(Date.now() + Number(body.days) * 86400000).toISOString() : null,
    });
    return json({ ok: true });
  }

  if (body.action === "set-message-status") {
    if (!body.id || !["new", "read", "closed"].includes(body.status)) return json({ error: "Invalid input" }, 400);
    await supabase.from("contact_messages").update({ status: body.status }).eq("id", body.id);
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
});
