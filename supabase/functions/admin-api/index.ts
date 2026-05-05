import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const adminEmail = (Deno.env.get("ADMIN_EMAIL") || "").trim().toLowerCase();
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
  const { data, error } = await supabase.auth.getUser(token);
  if (error) return null;
  return data.user || null;
}

function isAdminEmail(email?: string | null) {
  return Boolean(adminEmail && email?.trim().toLowerCase() === adminEmail);
}

async function listAdminData() {
  const [usersResult, profilesResult, subsResult, usageResult, messagesResult] = await Promise.all([
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabase.from("profiles").select("id, display_name, last_seen_at, satisfaction"),
    supabase.from("user_subscriptions").select("*").eq("active", true),
    supabase.from("user_usage_daily").select("*").eq("usage_date", new Date().toISOString().slice(0, 10)),
    supabase.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(100),
  ]);

  if (usersResult.error) throw new Error(`list_users_failed: ${usersResult.error.message}`);
  if (profilesResult.error) throw new Error(`profiles_failed: ${profilesResult.error.message}`);
  if (subsResult.error) throw new Error(`subscriptions_failed: ${subsResult.error.message}`);
  if (usageResult.error) throw new Error(`usage_failed: ${usageResult.error.message}`);
  if (messagesResult.error) throw new Error(`messages_failed: ${messagesResult.error.message}`);

  const authUsers = usersResult.data;
  const profiles = profilesResult.data;
  const subs = subsResult.data;
  const usage = usageResult.data;
  const messages = messagesResult.data;

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
  if (!supabaseUrl || !serviceKey) return json({ error: "Supabase service env missing" }, 500);
  if (!adminEmail) return json({ error: "ADMIN_EMAIL missing" }, 500);

  const user = await getUser(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));

  if (!isAdminEmail(user.email)) return json({ error: "Admin required" }, 403);

  if (body.action === "list") {
    try {
      return json(await listAdminData());
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Admin list failed" }, 500);
    }
  }

  if (body.action === "set-subscription") {
    if (!body.user_id || !["free", "pro", "trader"].includes(body.plan)) return json({ error: "Invalid input" }, 400);
    const { error: updateError } = await supabase.from("user_subscriptions").update({ active: false }).eq("user_id", body.user_id).eq("active", true);
    if (updateError) return json({ error: updateError.message }, 500);
    const { error: insertError } = await supabase.from("user_subscriptions").insert({
      user_id: body.user_id,
      plan: body.plan,
      interval: body.interval || "monthly",
      status: "active",
      active: true,
      current_period_start: new Date().toISOString(),
      current_period_end: body.days ? new Date(Date.now() + Number(body.days) * 86400000).toISOString() : null,
    });
    if (insertError) return json({ error: insertError.message }, 500);
    return json({ ok: true });
  }

  if (body.action === "set-message-status") {
    if (!body.id || !["new", "read", "closed"].includes(body.status)) return json({ error: "Invalid input" }, 400);
    const { error } = await supabase.from("contact_messages").update({ status: body.status }).eq("id", body.id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
});
