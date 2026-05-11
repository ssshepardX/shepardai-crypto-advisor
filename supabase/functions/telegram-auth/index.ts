import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { json } from "../_shared/admin-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function hex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function hmac(key: ArrayBuffer | Uint8Array, text: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(text));
}

async function verifyTelegramInitData(initData: string) {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN missing");
  const params = new URLSearchParams(initData);
  const hash = params.get("hash") || "";
  if (!hash) throw new Error("Telegram hash missing");
  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = await hmac(new TextEncoder().encode("WebAppData"), botToken);
  const calculated = hex(await hmac(secretKey, dataCheckString));
  if (calculated !== hash) throw new Error("Invalid Telegram signature");
  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Date.now() / 1000 - authDate > 86400) throw new Error("Telegram auth expired");
  const userRaw = params.get("user");
  const user = userRaw ? JSON.parse(userRaw) : null;
  if (!user?.id) throw new Error("Telegram user missing");
  return {
    user,
    start_param: params.get("start_param") || null,
    auth_date: authDate,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, corsHeaders);
  try {
    const body = await req.json().catch(() => ({}));
    const result = await verifyTelegramInitData(String(body.initData || ""));
    return json({
      ok: true,
      telegram_user: result.user,
      start_param: result.start_param,
      auth_date: result.auth_date,
    }, 200, corsHeaders);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Telegram auth failed" }, 401, corsHeaders);
  }
});
