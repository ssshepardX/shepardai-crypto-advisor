# Shepard AI

Crypto movement intelligence app.

Shepard AI does not sell buy/sell signals. It explains why a crypto asset may be moving by combining market data, technical signals, order book pressure, large trade traces, RSS news signals, and short AI summaries.

Production domain: https://shepardai.pro

## Current Product Scope

- Market movement cause analysis
- Whale, liquidity, manipulation, and fraud/pump risk scoring
- TradingView-style chart using live Binance market data
- 15-minute shared analysis cache per symbol, timeframe, and language
- RSS-only sentiment intelligence with DB cache
- AI summary in selected language
- Supabase Auth with email OTP and Google login
- Creem subscription integration
- Admin panel
- Backtest and market snapshot tooling
- Capacitor Android/iOS shell
- Telegram Mini App support

## Tech Stack

- React 18
- Vite
- TypeScript
- Tailwind CSS
- shadcn/Radix UI primitives
- Supabase Auth, Postgres, RLS, Edge Functions, Cron
- Binance public market data
- Lightweight Charts
- Capacitor 7
- Vercel

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Local Setup](docs/SETUP.md)
- [Environment Variables](docs/ENVIRONMENT.md)
- [Supabase](docs/SUPABASE.md)
- [Edge Functions API](docs/API.md)
- [Sentiment Intelligence](docs/SENTIMENT.md)
- [Payments](docs/PAYMENTS.md)
- [Admin Panel](docs/ADMIN.md)
- [Backtesting](docs/BACKTESTING.md)
- [Mobile](docs/MOBILE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Security](docs/SECURITY.md)
- [Operations](docs/OPERATIONS.md)

## Local Development

```bash
pnpm install
pnpm run dev
```

Build:

```bash
pnpm run build
```

Lint:

```bash
pnpm lint
```

Deploy note:

- frontend deploy: push to `main`
- Supabase Edge Functions deploy separately
- dashboard trend/scanner cards read DB cache first

## Important Positioning

Use this wording consistently:

- Market movement intelligence
- Movement cause analysis
- Manipulation risk
- Whale trace
- Liquidity risk
- News/social catalyst

Avoid this wording:

- Guaranteed prediction
- Buy/sell signal
- Entry/exit advice
- Profit promise
- Financial advice

## License

Private project.
