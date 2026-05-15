# Operations

## Regular Checks

Daily:

- Vercel deployment status
- Supabase Edge Function errors
- Creem webhook delivery
- Auth email delivery
- AI provider errors

Weekly:

- DB growth
- snapshot table size
- cron job run status
- cache hit rate
- failed payment/webhook events

## Logs

Important Edge Function log events:

- `analysis_cache_hit`
- `ai_summary_cache_hit`
- `ai_summary_prompt`
- `ai_summary_success`
- `ai_summary_fallback`

## Cost Controls

Core controls:

- analysis cache: 15 minutes
- sentiment market cache: 60 minutes when signal exists, 15 minutes when empty
- sentiment coin cache: 12 hours when signal exists, 60 minutes when empty
- free plan AI limit: 3/day
- pro AI limit: 50/day
- trader AI limit: 250/day

## Deploy Checklist

1. Run lint.
2. Run build.
3. Deploy Supabase functions if backend changed.
4. Push frontend changes to GitHub.
5. Confirm GitHub Actions passed.
6. Smoke test production domain.
7. If cron SQL changed, verify `cron.job` entries match current docs.

## Smoke Test

Public:

- open home
- open pricing
- open contact
- change language

Auth:

- login
- reload page
- verify session persists
- logout

Analysis:

- run BTCUSDT 15m analysis
- run same analysis again
- verify saved result/cache hit behavior
- switch language
- verify summary language changes

Payments:

- click Pro checkout
- verify redirect opens
- cancel flow returns cleanly

Admin:

- login with admin email
- open `/admin`
- list users/messages
- run backtest if needed

## Common Incidents

### GitHub Actions deploy fails with pnpm regex error

Cause:

```txt
Node 18 + pnpm 11
```

Fix:

```txt
Node 22
pnpm 10.14.0
```

Configured in `.github/workflows/deploy.yml`.

### Edge Function non-2xx on analysis

Check:

- Supabase function logs
- user plan/usage limit
- missing env secrets
- DB migration state
- AI provider key validity

### AI summary always same language

Check:

- frontend sends `language`
- `ai_summary_json.language` is correct
- cache is language-specific
- prompt schema uses `catalyst_summary`, not `catalyst_summary_tr`

### Sentiment has no data

Check:

- RSS source availability
- `sentiment_snapshots`
- function logs
- Pro/Trader/admin entitlement
- cron timeout/auth headers
- market sweep runtime cost if feed count increased

### Cron not running

Check:

```sql
select * from cron.job;
select * from cron.job_run_details order by start_time desc limit 50;
```

Current important jobs:

- `market-snapshot-5m`
- `market-scanner-cache-15m`
- `sentiment-scan-cache-15m`

## Backup Notes

Supabase backups should be enabled before production marketing spend.

Minimum export targets:

- users/profiles
- subscriptions
- contact messages
- analyses
- backtest runs
- movement events
