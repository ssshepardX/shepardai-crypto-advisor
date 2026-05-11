# Telegram Mini App

## Goal

Use Telegram as a low-friction crypto audience channel.

The Mini App route is:

```txt
https://shepardai.pro/tg
```

## Current MVP

Implemented:

- `/tg` route
- Telegram WebApp detection
- Telegram `initData` verification Edge Function
- quick market lab entry
- recent cached analysis list
- full app CTA

Not implemented yet:

- Telegram user to Supabase user linking
- Telegram Stars billing
- bot webhook commands
- group/channel automation

## BotFather Setup

1. Open BotFather.
2. Create or select bot.
3. Set Mini App / Web App URL:

```txt
https://shepardai.pro/tg
```

4. Keep HTTP API token private.

## Supabase Secret

Set bot token as Edge Function secret:

```bash
supabase secrets set TELEGRAM_BOT_TOKEN=123456:ABC...
```

Deploy:

```bash
supabase functions deploy telegram-auth
```

## Frontend Deploy

Vercel deploy required after adding `/tg`.

## Security

Telegram Mini App authentication uses signed `initData`.

Backend verifies:

- HMAC signature
- `auth_date`
- user payload

Do not trust `initDataUnsafe` directly.

Frontend can display `initDataUnsafe` for UX, but backend verification is required for access decisions.

## Next Steps

Recommended next slice:

1. Add `telegram_users` table.
2. Store verified `telegram_id`.
3. Link Telegram user to Supabase account.
4. Add `/start` bot button that opens Mini App.
5. Add command shortcuts:

```txt
/trending
/analyze BTC
/pricing
```

6. Add Telegram Stars or store billing flow if needed.
