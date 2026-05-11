import { supabase } from '@/integrations/supabase/client';

export type TelegramAuthResult = {
  ok: boolean;
  telegram_user?: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };
  start_param?: string;
  auth_date?: number;
};

export async function verifyTelegramInitData(initData: string) {
  const { data, error } = await supabase.functions.invoke('telegram-auth', {
    method: 'POST',
    body: { initData },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as TelegramAuthResult;
}
