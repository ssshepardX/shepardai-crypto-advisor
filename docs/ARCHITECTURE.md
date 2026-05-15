# Architecture

## Purpose

Shepard AI explains crypto market movement causes. The core product answers:

- Is the move organic demand?
- Is there whale pressure?
- Is liquidity thin?
- Is this a possible FOMO trap or fraud/pump pattern?
- Is there a news or social catalyst?

The app is not a direct price prediction or trade signal system.

## High-Level Flow

```txt
React/Vite UI
  -> Supabase Auth
  -> Supabase Postgres cache/tables
  -> Supabase Edge Functions
  -> Binance public APIs
  -> RSS news feeds
  -> AI provider only for short summary
```

## Frontend

Main folders:

- `src/pages`: route screens
- `src/components`: reusable UI
- `src/services`: frontend API wrappers
- `src/contexts`: auth, session, language
- `src/lib`: labels, mobile helpers, utilities

Important routes:

- `/`: public landing
- `/login`: auth
- `/verify-otp`: email verification
- `/dashboard`: user dashboard
- `/analysis`: coin analysis
- `/pricing`: plans and Creem checkout
- `/contact`: support/feedback
- `/admin`: private admin panel

## Backend

Supabase Edge Functions are the backend boundary. Browser clients should not call third-party private APIs directly.
Dashboard trend and scanner sections are cache-first. They read Postgres-backed cache first and only use Edge Functions for manual refresh flows.

Important functions:

- `analyze-coin`: core analysis engine
- `sentiment-scan`: RSS sentiment/trend scan
- `create-checkout`: Creem checkout creation
- `creem-webhook`: Creem subscription webhook
- `admin-api`: admin users/messages/subscriptions/backtests
- `market-snapshot`: scheduled market snapshot collection
- `run-backtest`: historical/snapshot backtest engine

Legacy functions still exist:

- `alerts`
- `scanner`
- `generate-signal`
- `translate-text`

These should not define the new product direction.

## Data Model

Core tables:

- `coin_analyses`
- `user_subscriptions`
- `user_usage_daily`
- `contact_messages`
- `sentiment_snapshots`
- `sentiment_sources`
- `market_snapshots`
- `movement_events`
- `backtest_runs`
- `creem_events`

## Cache Model

`analyze-coin` writes every result into `coin_analyses`.

Cache key:

```txt
symbol + timeframe + language
```

TTL:

```txt
15 minutes
```

Cache hits:

- return existing DB result
- do not call AI
- do not increment usage
- do not refetch Binance/orderbook

Sentiment cache:

- market snapshot cache lives in `sentiment_snapshots`
- market sweep uses RSS-only sources
- dashboard reads cached market sweep results first
- manual refresh can trigger a new sweep, but UI should still fall back to cache

## AI Role

AI does not decide the score.

Deterministic code calculates:

- indicators
- risk scores
- whale/fraud/liquidity signals
- cause scores
- confidence

AI only turns compact JSON into a short user-facing summary in the selected language.

## Language Model

Supported UI languages:

- `tr`
- `en`

Translation order:

1. runtime JSON from `public/locales/{language}.json`
2. static dictionary in `LanguageContext`
3. English fallback
4. original text

AI summaries are generated per selected language and cached separately.
