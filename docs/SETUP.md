# Local Setup

## Requirements

- Node.js 22 recommended
- pnpm 10.x recommended
- Supabase CLI
- Vercel CLI for production deploy work
- Android Studio for Android builds
- Xcode/macOS for iOS builds

## Install

```bash
pnpm install
```

## Run Web App

```bash
pnpm run dev
```

Default local URL:

```txt
http://127.0.0.1:5173
```

## Build

```bash
pnpm run build
```

## Lint

```bash
pnpm lint
```

For targeted checks:

```bash
npx eslint src supabase --ext .ts,.tsx
```

## Supabase Link

Project ref currently used in docs/examples:

```txt
wwdnuxpzsmdbeffhdsoy
```

Link local CLI:

```bash
supabase link --project-ref wwdnuxpzsmdbeffhdsoy
```

## Push Migrations

```bash
supabase db push
```

If DB push fails on Windows with pooler/network errors, verify:

- database password is correct
- network/firewall is not blocking PostgreSQL
- Supabase project is active
- CLI is logged in

## Deploy Edge Functions

```bash
supabase functions deploy analyze-coin --project-ref wwdnuxpzsmdbeffhdsoy
supabase functions deploy sentiment-scan --project-ref wwdnuxpzsmdbeffhdsoy
supabase functions deploy admin-api --project-ref wwdnuxpzsmdbeffhdsoy
supabase functions deploy create-checkout --project-ref wwdnuxpzsmdbeffhdsoy
supabase functions deploy creem-webhook --project-ref wwdnuxpzsmdbeffhdsoy
supabase functions deploy market-snapshot --project-ref wwdnuxpzsmdbeffhdsoy
supabase functions deploy run-backtest --project-ref wwdnuxpzsmdbeffhdsoy
```

## Vercel Deploy

Push to `main`. GitHub Actions deploys to Vercel.

Workflow:

```txt
.github/workflows/deploy.yml
```

The workflow uses:

- Node 22
- pnpm 10.14.0
- Vercel CLI
