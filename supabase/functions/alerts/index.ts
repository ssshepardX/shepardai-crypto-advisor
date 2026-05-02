// @ts-expect-error TypeScript cannot find Deno std types but they are available at runtime
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
/// <reference types="https://deno.land/types/index.d.ts" />
// @ts-expect-error TypeScript cannot find module but types are available at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// --- Supabase Client Setup ---
// @ts-expect-error Deno global available at runtime
const supabaseUrl = Deno.env.get('SUPABASE_URL');
// @ts-expect-error Deno global available at runtime
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Supabase environment variables are not set.");
}
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Define subscription plans and their features
enum SubscriptionPlan {
  FREE = 'free',
  PRO = 'pro',
  TRADER = 'trader'
}

interface UserSubscription {
  plan: SubscriptionPlan;
  active: boolean;
}

// Analysis job interface from database
interface AnalysisJob {
  id: string;
  symbol: string;
  price_at_detection: string;
  price_change: string;
  volume_spike: string;
  risk_score: number;
  created_at: string;
  completed_at: string | null;
  status: string;
  summary?: string;
  likely_source?: string;
  actionable_insight?: string;
}

// Alert response interface for different subscription levels
interface BaseAlert {
  id: string;
  symbol: string;
  price_at_detection: number;
  price_change: number;
  volume_spike: number;
  risk_score: number;
  created_at: string;
  completed_at: string | null;
}

interface FreeAlert extends BaseAlert {
  summary: null;
  likely_source: null;
  actionable_insight: null;
}

interface ProAlert extends BaseAlert {
  summary: string | null;
  likely_source: null;
  actionable_insight: null;
}

interface TraderAlert extends BaseAlert {
  summary: string | null;
  likely_source: string | null;
  actionable_insight: string | null;
}

// Helper function to get user's subscription plan
async function getUserSubscription(userId: string): Promise<UserSubscription> {
  try {
    // First, try to get from a subscriptions table (custom implementation)
    const { data: subData, error: subError } = await supabaseAdmin
      .from('user_subscriptions')
      .select('plan, active')
      .eq('user_id', userId)
      .eq('active', true)
      .single();

    if (!subError && subData) {
      return {
        plan: normalizePlan(subData.plan),
        active: subData.active
      };
    }

    // Fallback: Check auth metadata or default roles
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (!authError && authData?.user?.app_metadata?.subscription) {
      return {
        plan: normalizePlan(authData.user.app_metadata.subscription),
        active: true
      };
    }

    // Default to free plan if nothing found
    return {
      plan: SubscriptionPlan.FREE,
      active: true
    };

  } catch (error) {
    console.error('Error fetching user subscription:', error);

    // Default to free plan on error
    return {
      plan: SubscriptionPlan.FREE,
      active: true
    };
  }
}

// Helper function to apply subscription-based filtering and masking
async function filterAlertsBySubscription(
  alerts: AnalysisJob[],
  subscription: UserSubscription
): Promise<(FreeAlert | ProAlert | TraderAlert)[]> {
  const now = new Date();
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();

  return alerts.filter(alert => {
    // Only show COMPLETED jobs
    if (alert.status !== 'COMPLETED') return false;

    // Apply time-based filtering for free users
    if (subscription.plan === SubscriptionPlan.FREE && alert.created_at > fifteenMinutesAgo) {
      return false;
    }

    return true;
  }).map(alert => {
    const baseAlert: BaseAlert = {
      id: alert.id,
      symbol: alert.symbol,
      price_at_detection: parseFloat(alert.price_at_detection),
      price_change: parseFloat(alert.price_change),
      volume_spike: parseFloat(alert.volume_spike),
      risk_score: alert.risk_score,
      created_at: alert.created_at,
      completed_at: alert.completed_at
    };

    // Apply field masking based on subscription
    switch (subscription.plan) {
      case SubscriptionPlan.FREE:
        return {
          ...baseAlert,
          summary: null,
          likely_source: null,
          actionable_insight: null
        } as FreeAlert;

      case SubscriptionPlan.PRO:
        return {
          ...baseAlert,
          summary: alert.summary || null,
          likely_source: null,
          actionable_insight: null
        } as ProAlert;

      case SubscriptionPlan.TRADER:
        return {
          ...baseAlert,
          summary: alert.summary || null,
          likely_source: alert.likely_source || null,
          actionable_insight: alert.actionable_insight || null
        } as TraderAlert;

      default:
        return {
          ...baseAlert,
          summary: null,
          likely_source: null,
          actionable_insight: null
        } as FreeAlert;
    }
  });
}

// Main handler
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Extract JWT token and verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Get user's subscription plan
    const subscription = await getUserSubscription(user.id);
    console.log(`User ${user.id} has ${subscription.active ? subscription.plan : 'inactive'} subscription`);

    // Query alerts with proper filtering
    let query = supabaseAdmin
      .from('analysis_jobs')
      .select('*')
      .eq('status', 'COMPLETED')
      .order('created_at', { ascending: false })
      .limit(100); // Reasonable pagination limit

    // For free users, add time filter server-side as well (extra security)
    if (subscription.plan === SubscriptionPlan.FREE) {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      query = query.lt('created_at', fifteenMinutesAgo);
    }

    const { data: alerts, error: alertsError } = await query;

    if (alertsError) {
      console.error('Error fetching alerts:', alertsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch alerts' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (!alerts) {
      return new Response(JSON.stringify({ alerts: [], subscription: subscription.plan }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Apply subscription-based filtering and field masking
    const filteredAlerts = await filterAlertsBySubscription(alerts, subscription);

    // Include subscription access level info in response
    const subscriptionInfo = {
      plan: subscription.plan,
      active: subscription.active,
      features: getPlanFeatures(subscription.plan)
    };

    return new Response(JSON.stringify({
      alerts: filteredAlerts,
      subscription: subscriptionInfo,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Error in alerts endpoint:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// Helper function to get plan features for client-side UI
function getPlanFeatures(plan: SubscriptionPlan) {
  switch (plan) {
    case SubscriptionPlan.FREE:
      return {
        realTimeAlerts: false,
        aiQualitativeFields: false,
        canRunScanner: false,
        canViewAdvancedRisk: false,
        aiDailyLimit: 3,
        timeDelayMinutes: 15
      };
    case SubscriptionPlan.PRO:
      return {
        realTimeAlerts: true,
        aiQualitativeFields: true,
        canRunScanner: false,
        canViewAdvancedRisk: true,
        aiDailyLimit: 50,
        timeDelayMinutes: 0
      };
    case SubscriptionPlan.TRADER:
      return {
        realTimeAlerts: true,
        aiQualitativeFields: true,
        canRunScanner: true,
        canViewAdvancedRisk: true,
        aiDailyLimit: 250,
        timeDelayMinutes: 0
      };
    default:
      return {
        realTimeAlerts: false,
        aiQualitativeFields: false,
        canRunScanner: false,
        canViewAdvancedRisk: false,
        aiDailyLimit: 3,
        timeDelayMinutes: 15
      };
  }
}

function normalizePlan(plan: string | null | undefined): SubscriptionPlan {
  if (plan === SubscriptionPlan.PRO || plan === SubscriptionPlan.TRADER) return plan;
  return SubscriptionPlan.FREE;
}
