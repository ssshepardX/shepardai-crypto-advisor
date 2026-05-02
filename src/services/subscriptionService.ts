import { supabase } from '@/integrations/supabase/client';

export type PlanId = 'free' | 'pro' | 'trader';
export type BillingInterval = 'monthly' | 'quarterly' | 'yearly';

export interface PlanEntitlements {
  aiDailyLimit: number;
  scannerDelayMinutes: number;
  canRunScanner: boolean;
  canViewAdvancedRisk: boolean;
  canViewAiSummary: boolean;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan: PlanId;
  interval: BillingInterval;
  status: string;
  active: boolean;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface UserUsageDaily {
  ai_analysis_count: number;
  scanner_run_count: number;
  usage_date: string;
}

export const PLAN_ENTITLEMENTS: Record<PlanId, PlanEntitlements> = {
  free: {
    aiDailyLimit: 3,
    scannerDelayMinutes: 15,
    canRunScanner: false,
    canViewAdvancedRisk: false,
    canViewAiSummary: true,
  },
  pro: {
    aiDailyLimit: 50,
    scannerDelayMinutes: 0,
    canRunScanner: false,
    canViewAdvancedRisk: true,
    canViewAiSummary: true,
  },
  trader: {
    aiDailyLimit: 250,
    scannerDelayMinutes: 0,
    canRunScanner: true,
    canViewAdvancedRisk: true,
    canViewAiSummary: true,
  },
};

export async function getCurrentSubscription(): Promise<UserSubscription> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return (data || {
    id: 'free',
    user_id: user.id,
    plan: 'free',
    interval: 'monthly',
    status: 'active',
    active: true,
    current_period_end: null,
    cancel_at_period_end: false,
  }) as UserSubscription;
}

export async function getTodayUsage(): Promise<UserUsageDaily> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('User not authenticated');

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('user_usage_daily')
    .select('ai_analysis_count, scanner_run_count, usage_date')
    .eq('user_id', user.id)
    .eq('usage_date', today)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data || { ai_analysis_count: 0, scanner_run_count: 0, usage_date: today };
}

export async function createCheckout(plan: Exclude<PlanId, 'free'>, interval: BillingInterval) {
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    method: 'POST',
    body: { plan, interval },
  });

  if (error) {
    const context = 'context' in error ? error.context : null;
    if (context instanceof Response) {
      const details = await context.json().catch(() => null);
      if (details?.detail) throw new Error(`${details.error || 'Checkout could not be created'}: ${details.detail}`);
      if (details?.error) throw new Error(details.error);
    }
    throw new Error(error.message || 'Checkout could not be created');
  }
  if (data?.detail) throw new Error(`${data.error || 'Checkout could not be created'}: ${data.detail}`);
  if (data?.error) throw new Error(data.error);
  return data as { checkout_url: string; id: string; product_id: string };
}
