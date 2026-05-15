# Edge Functions API

All client-facing backend behavior should go through Supabase Edge Functions.

## Auth

Most functions require Supabase user JWT:

```http
Authorization: Bearer <supabase_access_token>
```

Cron-only/admin functions may also accept:

```http
x-cron-secret: <CRON_SECRET>
```

## `analyze-coin`

Core movement analysis endpoint.

### Request

```http
POST /functions/v1/analyze-coin
```

```json
{
  "symbol": "BTCUSDT",
  "timeframe": "15m",
  "language": "en",
  "force": false
}
```

Supported timeframes:

```txt
5m, 15m, 30m, 1h, 4h
```

Supported languages:

```txt
tr, en
```

### Cache

Cache key:

```txt
symbol + timeframe + language
```

TTL:

```txt
15 minutes
```

Cache hit:

- no AI call
- no usage increment
- no market refetch

### Response

```json
{
  "analysis": {
    "symbol": "BTCUSDT",
    "timeframe": "15m",
    "price": 64000,
    "indicator_json": {},
    "risk_json": {},
    "cause_json": {},
    "market_microstructure_json": {},
    "news_json": {},
    "social_json": {},
    "ai_summary_json": {
      "language": "en",
      "likely_cause": "organic_demand",
      "catalyst_summary": "Short explanation.",
      "watch_points": []
    },
    "cache_hit": true,
    "usage_counted": false
  }
}
```

### Common Errors

```txt
AUTH_REQUIRED
AUTH_INVALID
AI_LIMIT_REACHED
SCANNER_REQUIRES_TRADER
```

## `sentiment-scan`

RSS-only sentiment/trend endpoint.
Primary use is cache generation. Dashboard should prefer reading `sentiment_snapshots` cache first.

### Market Mode

```http
POST /functions/v1/sentiment-scan
```

```json
{
  "mode": "market",
  "limit": 3
}
```

### Coin Mode

```json
{
  "mode": "coin",
  "symbol": "ETHUSDT"
}
```

### Access

Pro, Trader, and admin users only.

Free users receive:

```txt
SENTIMENT_REQUIRES_PRO
```

### Runtime Behavior

- market sweep writes into `sentiment_snapshots`
- dashboard refresh may trigger the function
- initial dashboard load should not depend on live function success
- no fake market-volume fallback should be generated

## `create-checkout`

Creates Creem checkout URL.

```json
{
  "plan": "pro",
  "interval": "monthly"
}
```

Plans:

```txt
pro, trader
```

Intervals:

```txt
monthly, quarterly, yearly
```

## `creem-webhook`

Receives Creem webhook events and updates subscription state.

Important requirements:

- validate signature
- keep idempotency through `creem_events`
- never expose webhook secret in frontend

## `admin-api`

Admin-only API.

Actions include:

- list users
- update subscription
- list contact messages
- update message status
- run backtest support actions

Admin trust source:

```txt
ADMIN_EMAIL / ADMIN_EMAILS
```

## `market-snapshot`

Cron/admin-only snapshot collector.

Stores market snapshots for future backtesting.

## `run-backtest`

Admin-only backtest runner.

Modes:

```txt
historical_kline
snapshot
```

## Cache-First Dashboard Pattern

Dashboard sections should behave like this:

- `Trend Intelligence`: read `sentiment_snapshots` cache, then optional manual refresh
- `Movement scanner`: read `coin_analyses` cache, cron keeps it warm
- empty cache should produce clean empty state, not placeholder/fake cards
