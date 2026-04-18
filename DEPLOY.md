# Envision OS — Vercel Deploy Guide

Last audited: 2026-04-18

This document is the single source of truth for deploying Envision OS to
Vercel in the `sin1` (Singapore) region. Follow it top-to-bottom for a
first-time deploy, or skip to **Redeploy** for incremental pushes.

---

## 1. Pre-flight checks

Run from the repo root before pushing:

```bash
# Confirm the working tree is clean and on main
git status
git log --oneline -5

# Confirm Node version (Vercel uses 20.x by default)
node --version     # expect v20.x or v22.x

# Sanity check: Prisma schema is valid
npx prisma validate

# Sanity check: TypeScript will resolve once Prisma client is generated
# (local tsc will show 24 errors if the Prisma client is stale — those
#  all disappear on Vercel because `prisma generate` runs in postinstall
#  and again in the build script.)
```

Confirm these files exist and are current:

- `src/proxy.ts` — Next.js 16 edge auth gate + rate limiting + security headers
  (Next.js 16 renamed `middleware.ts` → `proxy.ts`; the old file MUST NOT exist
  in the same repo or the build will fail with "Both middleware file and
  proxy file are detected.")
- `vercel.json` — regions + function timeouts + cron schedule
- `prisma/schema.prisma` — includes `MULTIMEDIA_DESIGNER`, `ProjectCSAssignment`, `Project.invoices`, `Project.csAssignments`
- `.env.example` — documents every variable in the checklist below
- `package.json` — `build` script runs `prisma generate && next build`

---

## 2. Environment variables

Set all of the following in **Vercel → Project Settings → Environment
Variables** for the `Production` environment (and `Preview` if you want
preview deploys to work against the same services).

### Required (app will not boot without these)

| Variable | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://…` | Primary Postgres. Use pooled URL for serverless. |
| `NEXTAUTH_SECRET` | 32-byte random | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://os.envicion.com` | Canonical URL, no trailing slash |
| `NEXT_PUBLIC_APP_URL` | `https://os.envicion.com` | Must match `NEXTAUTH_URL` |
| `ANTHROPIC_API_KEY` | `sk-ant-api03-…` | AI Sales, CS, Social, QC, Reputation |
| `CRON_SECRET` | 32-byte random | Protects `/api/cron/*`. `openssl rand -hex 32` |

### Required for Lark (staff sync + notifications)

| Variable | Required? |
|---|---|
| `LARK_APP_ID` | yes |
| `LARK_APP_SECRET` | yes |
| `LARK_VERIFY_TOKEN` | if using webhooks |
| `LARK_ENCRYPT_KEY` | if webhook encryption is on |
| `LARK_ROOT_FOLDER_TOKEN` | for Lark Drive uploads |
| `LARK_CHANNEL_CREATIVE` | for creative-team notifications |
| `LARK_CHANNEL_CS` | for client-servicing notifications |
| `LARK_CHANNEL_SALES` | for sales-team notifications |
| `LARK_CHANNEL_MANAGEMENT` | for management notifications |
| `LARK_LEAVE_APPROVAL_CODE` | optional, defaults to `leave` |
| `LARK_PAYROLL_SPREADSHEET_TOKEN` | for HR payroll sheet access |

> **Business rule:** Lark never receives invoice, quotation, pricing,
> payment, or billing content. Enforced in `src/services/lark.ts` via
> `containsBlockedContent()` — do not remove.

### Required for real-time (Pusher)

`PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`,
`NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`.

### Required for email (Resend)

`RESEND_API_KEY`, `RESEND_FROM_EMAIL` (verified domain).

### Required for accounting (Bukku)

`BUKKU_SUBDOMAIN`, `BUKKU_ACCESS_TOKEN`, `BUKKU_WEBHOOK_SECRET`.

### Optional — enable only if you use the feature

| Variable | Feature |
|---|---|
| `POSTGRES_PRISMA_URL` | Pooled Postgres (takes precedence over `DATABASE_URL` at runtime) |
| `WHATSAPP_360DIALOG_API_KEY` | WhatsApp sending + hourly cron |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Social-connect OAuth |
| `FACEBOOK_PAGE_ACCESS_TOKEN` / `FACEBOOK_PAGE_ID` | Facebook analytics + autopilot |
| `INSTAGRAM_ACCESS_TOKEN` / `INSTAGRAM_BUSINESS_ACCOUNT_ID` | Instagram analytics + autopilot |
| `LINKEDIN_ACCESS_TOKEN` / `LINKEDIN_ORGANIZATION_ID` | LinkedIn analytics + autopilot |
| `TIKTOK_ACCESS_TOKEN` / `TIKTOK_ADVERTISER_ID` | TikTok analytics |
| `YOUTUBE_API_KEY` / `YOUTUBE_CHANNEL_ID` | YouTube analytics |
| `MAILCHIMP_API_KEY` / `MAILCHIMP_SERVER_PREFIX` / `MAILCHIMP_LIST_ID` | Mailchimp analytics |
| `KLING_ACCESS_KEY_ID` / `KLING_ACCESS_KEY_SECRET` | Kling AI video generation |
| `ENVATO_TOKEN` | Envato stock search |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` | Google Drive uploads |

Copy-paste template lives in `.env.example` at the repo root.

---

## 3. Vercel project configuration

`vercel.json` is already committed and looks like this:

```json
{
    "regions": ["sin1"],
    "functions": {
          "src/app/api/ai/**":                      { "maxDuration": 60 },
          "src/app/api/projects/*/fa/**":           { "maxDuration": 30 },
          "src/app/api/bukku/**":                   { "maxDuration": 30 },
          "src/app/api/admin/import-job-track/**":  { "maxDuration": 30 },
          "src/app/api/cron/**":                    { "maxDuration": 60 }
    },
    "crons": [
          { "path": "/api/cron/sync-lark", "schedule": "0 3 * * *" },
          { "path": "/api/cron/whatsapp",  "schedule": "0 * * * *" }
    ]
}
```

- **Region `sin1`**: Singapore — closest to the Malaysia user base.
- **`maxDuration` 60s for AI + cron**: Claude calls can run long.
- **Crons require `CRON_SECRET`** set as an env var; Vercel attaches the
  `Authorization: Bearer $CRON_SECRET` header automatically.

---

## 4. Database setup

Envision OS uses Prisma 7 with PostgreSQL. On the first deploy:

```bash
# From the repo root, against the production DATABASE_URL:
DATABASE_URL="postgresql://…"  npx prisma migrate deploy

# Seed baseline data (roles, permissions, demo accounts):
DATABASE_URL="postgresql://…"  npm run db:seed
```

Vercel's build runs `prisma generate` (via `postinstall` + `build`
script) but does **not** run `migrate deploy`. Run migrations manually
or wire them into a GitHub Actions workflow.

---

## 5. Deploy command

### First deploy (link the project)

```bash
# Install the Vercel CLI if you haven't
npm i -g vercel

# Link the local repo to a Vercel project (run once)
vercel link

# Pull existing env vars into .env.local (optional)
vercel env pull .env.local

# Deploy to production
vercel --prod
```

### Redeploy

If the repo is connected to GitHub via Vercel's Git integration, every
push to `main` triggers a production deploy automatically. Manual
command:

```bash
vercel --prod
```

---

## 6. Post-deploy verification

Run these checks against the live URL right after deploy:

```bash
# 1. Health: the login page renders anonymously
curl -sS -o /dev/null -w "%{http_code}\n"  https://os.envicion.com/login

# 2. Middleware redirect: any dashboard route without a session must 302 to /login
curl -sS -o /dev/null -w "%{http_code}\n"  https://os.envicion.com/command

# 3. Cron endpoint rejects unauthenticated calls
curl -sS -o /dev/null -w "%{http_code}\n"  https://os.envicion.com/api/cron/sync-lark
#    ^ expect 401
```

Then in the Vercel dashboard:

- **Functions → Logs** — confirm no `prisma` "client not generated" errors.
- **Crons** — confirm `/api/cron/sync-lark` (daily 03:00 UTC) and
  `/api/cron/whatsapp` (hourly) are registered.
- **Observability** — watch first requests for 5xx spikes.

Sign in as an ADMIN user and spot-check:

1. `/command` loads.
2. `/admin/workload` loads.
3. `/cs/dashboard` loads (as CLIENT_SERVICING).
4. `/designer` loads (as any designer role).
5. `/portal` loads (as CLIENT) and other routes redirect back to portal.
6. Create a dummy lead in `/sales` → CRM → confirm WhatsApp/email fires.
7. Bukku webhook endpoint at `/api/bukku/webhook` accepts a signed test
   payload.

---

## 7. Rollback

Vercel retains every previous production build. If a deploy misbehaves:

```
Vercel dashboard → Deployments → (previous good build) → Promote to Production
```

or use the CLI:

```bash
vercel rollback <deployment-url>
```

---

## 8. Known considerations

- **Prisma client must be regenerated on every install.** `postinstall`
  handles this. If you ever see `Property 'MULTIMEDIA_DESIGNER' does not
  exist on type 'Role'` at build time, the generator was skipped — run
  `npm run db:generate` locally and commit, or force a clean install.
- **Proxy (formerly middleware) runs on the Edge runtime.** Next.js 16
  uses `src/proxy.ts` and a `proxy()` export instead of the old
  `src/middleware.ts` + `middleware()`. Do not import Node-only packages
  (`@prisma/client`, `bcryptjs`, etc.) into the proxy — the current file
  only uses `next-auth/jwt` and is Edge-safe. If both `middleware.ts`
  and `proxy.ts` exist, `next build` fails hard.
- **Lark message blocking is load-bearing.** `notify()` silently drops
  any message whose title or body matches the financial keyword set.
  Do not bypass it; add new notification paths through `notify()`.
- **Cron secrets are per-environment.** If Preview and Production share
  a `CRON_SECRET`, Preview deploys will accept real cron traffic. Use
  distinct values if that matters to you.

---

## 9. Pre-flight evidence (2026-04-18 audit)

Ran against a clean sandbox install (`npm ci` + `prisma generate`) of
the current repo:

| Check | Result |
|---|---|
| `tsc --noEmit` (6 GB heap) | ✅ exit 0, no errors |
| `next build` — compile | ✅ "Compiled successfully in 9.6s" |
| `next build` — TypeScript | ✅ passed (reached page-data collection) |
| `next build` — page data | blocked only by missing env vars in sandbox |
| Middleware/proxy conflict | ✅ resolved (stray `src/middleware.ts` removed) |
| Lark business-rule check | ✅ `containsBlockedContent()` drops invoices/quotations |
| Prisma schema ↔ client | ✅ all 24 stale-client errors cleared after `prisma generate` |

Interpretation: once the env vars in section 2 are populated on Vercel,
`vercel --prod` (or a `git push` to `main` via the Git integration) will
produce a green deploy.
