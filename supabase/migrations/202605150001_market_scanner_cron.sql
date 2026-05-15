create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'market-scanner-cache-15m') then
    perform cron.unschedule('market-scanner-cache-15m');
  end if;
  if exists (select 1 from cron.job where jobname = 'sentiment-scan-cache-15m') then
    perform cron.unschedule('sentiment-scan-cache-15m');
  end if;
end $$;

select cron.schedule(
  'market-scanner-cache-15m',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://wwdnuxpzsmdbeffhdsoy.supabase.co/functions/v1/analyze-coin',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3ZG51eHB6c21kYmVmZmhkc295Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjQzNTEsImV4cCI6MjA5MzA0MDM1MX0.1lhsZsyvSKRK40CDmpXrp5EOOiMTCu235LOIQ5-_ReM',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3ZG51eHB6c21kYmVmZmhkc295Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjQzNTEsImV4cCI6MjA5MzA0MDM1MX0.1lhsZsyvSKRK40CDmpXrp5EOOiMTCu235LOIQ5-_ReM',
      'x-cron-secret', current_setting('app.cron_secret', true)
    ),
    body := jsonb_build_object('mode', 'scan-market')
  );
  $$
);

select cron.schedule(
  'sentiment-scan-cache-15m',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://wwdnuxpzsmdbeffhdsoy.supabase.co/functions/v1/sentiment-scan',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3ZG51eHB6c21kYmVmZmhkc295Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjQzNTEsImV4cCI6MjA5MzA0MDM1MX0.1lhsZsyvSKRK40CDmpXrp5EOOiMTCu235LOIQ5-_ReM',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3ZG51eHB6c21kYmVmZmhkc295Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjQzNTEsImV4cCI6MjA5MzA0MDM1MX0.1lhsZsyvSKRK40CDmpXrp5EOOiMTCu235LOIQ5-_ReM',
      'x-cron-secret', current_setting('app.cron_secret', true)
    ),
    body := jsonb_build_object('mode', 'market', 'limit', 12)
  );
  $$
);
