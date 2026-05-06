import { supabase } from '@/integrations/supabase/client';

export type AdminUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  online: boolean;
  last_seen_at: string | null;
  role: 'user' | 'admin';
  satisfaction: 'happy' | 'neutral' | 'unhappy' | null;
  subscription: {
    plan: 'free' | 'pro' | 'trader';
    interval: string;
    status: string;
    current_period_end: string | null;
  } | null;
  days_left: number | null;
  usage_today: {
    ai_analysis_count: number;
    scanner_run_count: number;
  } | null;
};

export type ContactMessage = {
  id: string;
  user_id: string | null;
  name: string | null;
  email: string | null;
  satisfaction: 'happy' | 'neutral' | 'unhappy' | null;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'closed';
  created_at: string;
};

export type BacktestMode = 'historical_kline' | 'snapshot';
export type ManualMovementLabel =
  | 'organic_demand'
  | 'whale_push'
  | 'thin_liquidity_move'
  | 'fomo_trap'
  | 'fraud_pump_risk'
  | 'news_social_catalyst'
  | 'balanced_market';

export type BacktestEvent = {
  id?: string;
  symbol: string;
  timeframe: string;
  event_start: string;
  event_end: string | null;
  move_pct: number;
  volume_zscore: number;
  detected_label: string;
  realized_outcome: string;
  manual_label?: ManualMovementLabel | null;
  confidence_score: number;
};

export type BacktestResult = {
  run: {
    id: string;
    created_at: string;
    config_json: Record<string, unknown>;
    metrics_json: Record<string, number>;
  };
  events: BacktestEvent[];
  metrics: Record<string, number>;
};

async function callAdmin<T>(body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Admin session missing');

  const { data, error } = await supabase.functions.invoke('admin-api', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body,
  });
  if (error) {
    const context = 'context' in error ? error.context : null;
    if (context instanceof Response) {
      const details = await context.json().catch(() => null);
      if (details?.error) throw new Error(details.error);
    }
    throw new Error(error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

async function invokeAdminFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Admin session missing');
  const { data, error } = await supabase.functions.invoke(name, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body,
  });
  if (error) {
    const context = 'context' in error ? error.context : null;
    if (context instanceof Response) {
      const details = await context.json().catch(() => null);
      if (details?.error) throw new Error(details.error);
    }
    throw new Error(error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export const getAdminData = () => callAdmin<{ users: AdminUser[]; messages: ContactMessage[] }>({ action: 'list' });
export const setUserSubscription = (user_id: string, plan: 'free' | 'pro' | 'trader', days: number) =>
  callAdmin<{ ok: true }>({ action: 'set-subscription', user_id, plan, interval: 'monthly', days });
export const setMessageStatus = (id: string, status: 'new' | 'read' | 'closed') =>
  callAdmin<{ ok: true }>({ action: 'set-message-status', id, status });
export const setMovementEventLabel = (id: string, manual_label: ManualMovementLabel | null) =>
  callAdmin<{ ok: true }>({ action: 'set-event-label', id, manual_label });
export const runBacktest = (input: {
  symbols: string[];
  timeframe: string;
  from?: string;
  to?: string;
  mode: BacktestMode;
}) => invokeAdminFunction<BacktestResult>('run-backtest', input);
export const collectMarketSnapshot = (input: { symbols?: string[]; timeframe?: string; limit?: number }) =>
  invokeAdminFunction<{ snapshot_count: number; event_count: number; errors: Array<{ symbol: string; error: string }> }>('market-snapshot', input);

export async function submitContactMessage(input: {
  name?: string;
  email?: string;
  satisfaction?: 'happy' | 'neutral' | 'unhappy';
  subject: string;
  message: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('contact_messages').insert({
    ...input,
    user_id: user?.id || null,
  });
  if (error) throw new Error(error.message);
}
