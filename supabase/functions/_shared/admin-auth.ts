import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

export function adminEmails() {
  return `${Deno.env.get("ADMIN_EMAIL") || ""},${Deno.env.get("ADMIN_EMAILS") || ""}`
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function serviceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return createClient(supabaseUrl, serviceKey);
}

export async function requireAdmin(req: Request) {
  const supabase = serviceClient();
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) throw new Error("Unauthorized");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized");
  const normalized = data.user.email?.trim().toLowerCase();
  if (!normalized || !adminEmails().includes(normalized)) throw new Error("Admin required");
  return data.user;
}

export function hasValidCronSecret(req: Request) {
  const secret = Deno.env.get("CRON_SECRET") || "";
  return Boolean(secret && req.headers.get("x-cron-secret") === secret);
}
