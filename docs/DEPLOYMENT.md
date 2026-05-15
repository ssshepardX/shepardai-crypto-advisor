# Deployment

## Production Domain

```txt
https://shepardai.pro
```

Vercel preview and `vercel.app` domains should redirect to the production domain.

Configured in:

```txt
vercel.json
```

## GitHub Actions

Workflow:

```txt
.github/workflows/deploy.yml
```

Expected runtime:

- Node 22
- pnpm 10.14.0
- Vercel CLI

## Vercel Project

Build command:

```bash
pnpm run build
```

Install command:

```bash
pnpm install
```

Output directory:

```txt
dist
```

## Deploy Flow

```txt
push to main
  -> GitHub Actions
  -> install
  -> vercel pull
  -> vercel build --prod
  -> vercel deploy --prebuilt --prod
```

## Required GitHub Secrets

```txt
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

## Required Vercel Env

See:

```txt
docs/ENVIRONMENT.md
```

## Edge Function Deploy

Vercel deploy does not deploy Supabase Edge Functions.

Deploy functions separately:

```bash
supabase functions deploy analyze-coin --project-ref wwdnuxpzsmdbeffhdsoy
supabase functions deploy sentiment-scan --project-ref wwdnuxpzsmdbeffhdsoy
supabase functions deploy admin-api --project-ref wwdnuxpzsmdbeffhdsoy
supabase functions deploy create-checkout --project-ref wwdnuxpzsmdbeffhdsoy
supabase functions deploy creem-webhook --project-ref wwdnuxpzsmdbeffhdsoy
supabase functions deploy market-snapshot --project-ref wwdnuxpzsmdbeffhdsoy
supabase functions deploy run-backtest --project-ref wwdnuxpzsmdbeffhdsoy
```

If a function relies on cron/manual cache generation, deploy the function before testing the dashboard section that reads its cache.

## DNS

Domain provider points root domain to Vercel:

```txt
A @ 216.198.79.1
```

Use Vercel-provided records if Vercel changes its recommendation.

## Email Forwarding

Current domain emails can forward through Porkbun:

- support@shepardai.pro
- privacy@shepardai.pro
- billing@shepardai.pro

Business email should match public website/contact/payment store details.

## Post-Deploy Smoke Test

Check:

- `/`
- `/login`
- `/dashboard`
- `/analysis`
- `/pricing`
- `/contact`
- `/admin`
- payment success/cancel pages
- Supabase Edge Function responses
- custom domain redirects
