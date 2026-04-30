import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PaidPlan = "pro" | "trader";
type BillingInterval = "monthly" | "quarterly" | "yearly";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const creemApiKey = Deno.env.get("CREEM_API_KEY") || "";
const isTestMode = (Deno.env.get("CREEM_TEST_MODE") || "true").toLowerCase() === "true";
const creemBaseUrl = isTestMode ? "https://test-api.creem.io" : "https://api.creem.io";

const supabase = createClient(supabaseUrl, serviceKey);

const productEnvMap: Record<PaidPlan, Record<BillingInterval, string>> = {
  pro: {
    monthly: "CREEM_PRO_MONTHLY_PRODUCT_ID",
    quarterly: "CREEM_PRO_QUARTERLY_PRODUCT_ID",
    yearly: "CREEM_PRO_YEARLY_PRODUCT_ID",
  },
  trader: {
    monthly: "CREEM_TRADER_MONTHLY_PRODUCT_ID",
    quarterly: "CREEM_TRADER_QUARTERLY_PRODUCT_ID",
    yearly: "CREEM_TRADER_YEARLY_PRODUCT_ID",
  },
};

function isPaidPlan(value: unknown): value is PaidPlan {
  return value === "pro" || value === "trader";
}

function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "monthly" || value === "quarterly" || value === "yearly";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authentication required");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Invalid session");

    const body = await req.json().catch(() => ({}));
    if (!isPaidPlan(body.plan) || !isBillingInterval(body.interval)) {
      return new Response(JSON.stringify({ error: "Invalid plan or interval" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!creemApiKey) throw new Error("CREEM_API_KEY is not configured");

    const productEnv = productEnvMap[body.plan][body.interval];
    const productId = Deno.env.get(productEnv);
    if (!productId) throw new Error(`${productEnv} is not configured`);

    const origin = req.headers.get("origin") || "http://127.0.0.1:4173";
    const requestId = `${user.id}:${body.plan}:${body.interval}:${crypto.randomUUID()}`;

    const response = await fetch(`${creemBaseUrl}/v1/checkouts`, {
      method: "POST",
      headers: {
        "x-api-key": creemApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_id: productId,
        request_id: requestId,
        success_url: `${origin}/payment/success`,
        cancel_url: `${origin}/payment/cancel`,
        customer: {
          email: user.email,
        },
        metadata: {
          user_id: user.id,
          plan: body.plan,
          interval: body.interval,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Creem checkout failed: ${response.status} ${text.slice(0, 180)}`);
    }

    const checkout = await response.json();
    return new Response(JSON.stringify({
      checkout_url: checkout.checkout_url,
      id: checkout.id,
      product_id: productId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
