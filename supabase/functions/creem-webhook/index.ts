import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const webhookSecret = Deno.env.get("CREEM_WEBHOOK_SECRET") || "";
const supabase = createClient(supabaseUrl, serviceKey);

type Plan = "free" | "pro" | "trader";
type Interval = "monthly" | "quarterly" | "yearly";

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toHex(signature);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function normalizePlan(value: unknown): Plan {
  return value === "pro" || value === "trader" ? value : "free";
}

function normalizeInterval(value: unknown): Interval {
  return value === "quarterly" || value === "yearly" ? value : "monthly";
}

function getMetadata(object: Record<string, unknown>) {
  const metadata = object.metadata as Record<string, unknown> | undefined;
  return {
    userId: metadata?.user_id as string | undefined,
    plan: normalizePlan(metadata?.plan),
    interval: normalizeInterval(metadata?.interval),
  };
}

function getProductId(object: Record<string, unknown>): string | null {
  const product = object.product as Record<string, unknown> | undefined;
  return (product?.id as string | undefined) || (object.product_id as string | undefined) || null;
}

async function upsertSubscription(eventType: string, object: Record<string, unknown>) {
  const { userId, plan, interval } = getMetadata(object);
  if (!userId) return;

  const isCanceled = ["subscription.canceled", "subscription.expired"].includes(eventType);
  const subscriptionId = (object.id as string | undefined) || (object.subscription_id as string | undefined) || null;
  const customer = object.customer as Record<string, unknown> | undefined;

  await supabase
    .from("user_subscriptions")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("active", true);

  if (isCanceled) {
    await supabase.from("user_subscriptions").insert({
      user_id: userId,
      plan: "free",
      interval: "monthly",
      status: "active",
      active: true,
      updated_at: new Date().toISOString(),
    });
    return;
  }

  await supabase.from("user_subscriptions").insert({
    user_id: userId,
    plan,
    interval,
    status: (object.status as string | undefined) || "active",
    active: true,
    creem_customer_id: (customer?.id as string | undefined) || (object.customer_id as string | undefined) || null,
    creem_subscription_id: subscriptionId,
    creem_product_id: getProductId(object),
    current_period_start: (object.current_period_start_date as string | undefined) || null,
    current_period_end: (object.current_period_end_date as string | undefined) || null,
    cancel_at_period_end: Boolean(object.cancel_at_period_end),
    updated_at: new Date().toISOString(),
  });
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!webhookSecret) return new Response("Webhook secret not configured", { status: 500 });

  const rawBody = await req.text();
  const signature = req.headers.get("creem-signature") || "";
  const expected = await hmacSha256(webhookSecret, rawBody);
  if (!timingSafeEqual(expected, signature)) return new Response("Invalid signature", { status: 401 });

  const event = JSON.parse(rawBody);
  const eventId = event.id as string;
  const eventType = event.eventType as string;

  const { error: eventInsertError } = await supabase.from("creem_events").insert({
    event_id: eventId,
    event_type: eventType,
    payload: event,
  });
  if (eventInsertError?.code === "23505") return new Response("OK", { status: 200 });
  if (eventInsertError) return new Response(eventInsertError.message, { status: 500 });

  if ([
    "checkout.completed",
    "subscription.active",
    "subscription.paid",
    "subscription.canceled",
    "subscription.expired",
  ].includes(eventType)) {
    await upsertSubscription(eventType, event.object as Record<string, unknown>);
  }

  return new Response("OK", { status: 200 });
});
