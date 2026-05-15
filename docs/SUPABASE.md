# Supabase

## Responsibilities

Supabase provides:

- Auth
- Postgres
- Row Level Security
- Edge Functions
- Cron
- Storage-ready backend boundary

## Auth

Supported auth flows:

- email/password
- email OTP verification
- Google OAuth

Admin access is based on email allowlist:

- frontend: `VITE_ADMIN_EMAIL`
- backend: `ADMIN_EMAIL` or `ADMIN_EMAILS`

Database profile role is not the source of admin trust.

## Tables

### `coin_analyses`

Stores cached analysis results.

Important columns:

- `symbol`
- `timeframe`
- `price`
- `indicator_json`
- `risk_json`
- `cause_json`
- `market_microstructure_json`
- `news_json`
- `social_json`
- `confidence_json`
- `ai_summary_json`
- `created_at`
- `expires_at`

### `user_subscriptions`

Stores Creem subscription state.

### `user_usage_daily`

Stores daily usage counters.

### `sentiment_snapshots`

Stores cached RSS sentiment results.

### `market_snapshots`

Stores snapshot data for future backtests.

### `movement_events`

Stores detected historical or live movement events.

### `backtest_runs`

Stores backtest configuration and metrics.

### `contact_messages`

Stores user feedback/support messages.

## RLS

General policy:

- authenticated users can read only safe/user-facing data
- users read their own subscriptions and usage
- service role writes backend-owned tables
- admin operations go through `admin-api`

## Edge Functions

Deploy:

```bash
supabase functions deploy analyze-coin
supabase functions deploy sentiment-scan
supabase functions deploy admin-api
supabase functions deploy create-checkout
supabase functions deploy creem-webhook
supabase functions deploy market-snapshot
supabase functions deploy run-backtest
```

## Cron

Supabase Cron invokes Edge Functions using `pg_cron` and `pg_net`.

Recommended jobs:

- market snapshots: every 5 minutes
- market scanner cache: every 15 minutes
- sentiment scan cache: every 15 minutes

Current cache jobs:

```sql
select cron.schedule(
  'sentiment-scan-cache-15m',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://wwdnuxpzsmdbeffhdsoy.supabase.co/functions/v1/sentiment-scan',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'apikey', 'SUPABASE_ANON_KEY',
      'authorization', 'Bearer SUPABASE_ANON_KEY',
      'x-cron-secret', 'CRON_SECRET_VALUE'
    ),
    body := jsonb_build_object('mode', 'market', 'limit', 12),
    timeout_milliseconds := 30000
  );
  $$
);
```

Scanner cache follows the same pattern against `analyze-coin` with:

```json
{ "mode": "scan-market" }
```

Inspect cron jobs:

```sql
select * from cron.job;
```

Inspect cron run details:

```sql
select * from cron.job_run_details order by start_time desc limit 50;
```
