# Sentiment Intelligence

## Goal

Sentiment is used to explain why assets are being discussed, not to predict price directly.

The MVP should stay fully free.

## Current Mode

RSS-only.

No Google Custom Search.
No X/Twitter.
No paid news provider.
Reddit disabled by default.

## Sources

General crypto RSS:

- CoinDesk
- Cointelegraph
- Decrypt
- CryptoSlate
- Bitcoin.com
- ChainGPT RSS

Asia Watch RSS:

- CoinPost Japan
- Blockmedia Korea
- Odaily China

## Scoring

The engine scores text using deterministic keyword groups.

Positive examples:

- listing
- partnership
- approval
- ETF
- upgrade
- mainnet
- inflow
- adoption
- burn

Negative examples:

- hack
- exploit
- lawsuit
- SEC
- delist
- scam
- fraud
- rug
- outflow
- investigation

Risk examples:

- whale transfer
- unlock
- liquidation
- bridge exploit
- exchange halt

## Output Fields

```txt
sentiment_score: 0-100
sentiment_label: bad | neutral | good
mention_score: 0-100
source_confidence: 0-100
trend_direction: up | down | flat
reason_short
top_catalyst_terms
```

## Cache

Market trend cache:

```txt
60 minutes when a verified RSS signal exists
15 minutes when the sweep is empty
```

Coin sentiment cache:

```txt
12 hours when signal exists
60 minutes when empty
```

## Free Operation Rules

Keep market scan limit low or moderate:

```json
{
  "mode": "market",
  "limit": 12
}
```

Current production pattern:

```txt
every 15 minutes
```

Implementation note:

- market sweep now fetches RSS feeds once, then classifies matching coins locally
- this replaced the older per-coin-per-feed sweep that timed out
- dashboard should read cache first and show empty state if no verified catalyst exists

## Optional Reddit

Reddit is disabled by default:

```txt
ENABLE_REDDIT_SENTIMENT=false
```

Enable only after creating a Reddit API app:

```bash
supabase secrets set ENABLE_REDDIT_SENTIMENT=true
supabase secrets set REDDIT_CLIENT_ID=...
supabase secrets set REDDIT_CLIENT_SECRET=...
supabase secrets set REDDIT_USER_AGENT="shepard-ai/1.0 by u/<account>"
```

## Optional Paid Providers

Paid providers are disabled by default:

```txt
ENABLE_PAID_SENTIMENT_PROVIDERS=false
```

Future options:

- CryptoPanic
- CoinGecko News
- X/Twitter paid API/provider
- Deep news provider

## Rules

- Do not store full article text.
- Store source metadata, URL/domain, hash, aggregate score, and catalyst terms.
- Do not scrape X/Twitter.
- Do not call AI for raw sentiment scoring.
