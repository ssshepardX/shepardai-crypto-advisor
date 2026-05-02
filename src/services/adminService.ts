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

async function callAdmin<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-api', { method: 'POST', body });
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
