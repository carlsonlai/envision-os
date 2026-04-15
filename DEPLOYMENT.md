# Deployment Guide — Envision OS

## Quick Deploy to Railway (Recommended)

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
3. Add a PostgreSQL plugin in Railway
4. Set environment variables in Railway dashboard (copy from `.env.example`)
5. Railway auto-detects `railway.json` and builds via Dockerfile
6. Your app will be live at a `*.railway.app` URL

## Required Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Set automatically by Railway Postgres plugin |
| `NEXTAUTH_SECRET` | Generate with: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your Railway app URL, e.g. `https://envision-os.railway.app` |
| `ANTHROPIC_API_KEY` | From console.anthropic.com |
| `PUSHER_APP_ID` | From pusher.com dashboard |
| `PUSHER_KEY` | From pusher.com dashboard |
| `PUSHER_SECRET` | From pusher.com dashboard |
| `NEXT_PUBLIC_PUSHER_KEY` | Same as PUSHER_KEY |
| `LARK_APP_ID` | From Lark Developer Console |
| `LARK_APP_SECRET` | From Lark Developer Console |
| `RESEND_API_KEY` | From resend.com |
| `BUKKU_API_KEY` | From Bukku account settings |
| `WHATSAPP_TOKEN` | From Meta Business → WhatsApp API |
| `WHATSAPP_PHONE_ID` | From Meta Business → WhatsApp API |

## After First Deploy

Run database migrations:
```
railway run npx prisma db push
railway run npm run db:seed
```

## Health Check

`GET /api/health` — returns `{ status: "ok", db: "connected", latencyMs: N }`

## Local Development

```bash
cp .env.example .env.local   # fill in your values
npm install
npm run db:push
npm run db:seed
npm run dev
```
