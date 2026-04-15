# Changes Log

## 2026-04-16 — Performance: fix 17.7s FCP on dashboard

### Problem
- Vercel deployment loading extremely slowly.
- Measured: First Contentful Paint at **17.76s** while TTFB was **47ms** (server fine) and JS finished loading at **1.26s**.
- Root cause: `src/app/(dashboard)/layout.tsx` was a client component that showed a full-page spinner while `useSession()` was loading, blocking the entire dashboard render on a client-side auth round-trip. A duplicate `/api/auth/session` call at t=17.7s correlated exactly with the FCP event.
- Secondary issues: sequential API fetches in `command/page.tsx`, no HTTP caching on KPI endpoints.

### Changes

1. **`src/proxy.ts`** — Integrated server-side auth gate into the existing Next 16 proxy (the file that replaced `middleware.ts` in the Next 16 migration). Dashboard page routes are now protected at the edge via `next-auth/jwt` `getToken`. Unauthenticated users are redirected to `/login` **before any HTML is sent**, eliminating the client-side blank-screen wait. `CLIENT` role is redirected to `/portal`.

   Protected prefixes (explicit allow-list, not match-all-minus-exclusions — webhooks and crons must stay public):
   `/command`, `/admin`, `/cd`, `/cs`, `/crm`, `/sales`, `/designer`, `/kpi`, `/hr`, `/social-hub`, `/media`, `/calendar`, `/my`, `/ai-sales`, `/ai-cs`, `/portal`.

2. **`src/app/(dashboard)/layout.tsx`** — Removed the full-page spinner that blocked FCP on `status === 'loading'`. Layout now renders the shell immediately; middleware guarantees the user is authenticated by the time the page renders. Removed the now-redundant client-side `CLIENT` role redirect. Added null-safe access to `session?.user?.name` and `userRole` for the one-frame window before `useSession()` rehydrates.

3. **`src/app/(dashboard)/command/page.tsx`** — Parallelized all three KPI fetches (`/api/kpi/revenue`, `/api/kpi/team`, `/api/targets`) in a single `Promise.all`. Previously `targets` was awaited sequentially after the other two, adding a full round-trip.

4. **`src/app/api/kpi/revenue/route.ts`** — Added `Cache-Control: private, max-age=20`. (Note: the first pass used `private, s-maxage=...` which is contradictory — `private` prevents shared/CDN caching while `s-maxage` targets shared caches. Fixed to browser-only caching.)

5. **`src/app/api/kpi/team/route.ts`** — Same `Cache-Control: private, max-age=20`.

6. **`src/app/api/targets/route.ts`** — `Cache-Control: private, max-age=60` (targets change rarely).

### Expected impact

| Metric | Before | After (expected) |
|---|---|---|
| First Contentful Paint | 17.76s | < 1.5s |
| Time to interactive dashboard | ~18s | ~2s |
| `/api/targets` latency on dashboard | Sequential (adds ~250ms) | Parallel with revenue/team |
| Repeat dashboard loads within 20s | Full DB round-trip | Browser cache hit |

### Verification after deploy

In a logged-in browser, open DevTools console on `/command`:

```js
performance.getEntriesByType('paint')
```

`first-contentful-paint` should be well under 1500 ms.

### Follow-ups (not yet done)

- Profile `getTeamUtilisation()` and `getRevenueOverview()` in `src/services/kpi.ts`. The 1.4s observed on `/api/kpi/team` is likely unindexed Prisma queries. HTTP caching masks but does not fix this.
- Consider converting `(dashboard)/layout.tsx` to a server component so the nav chrome renders in initial HTML (deeper refactor — current client-component layout is fine now that it doesn't block).
- Confirm `authOptions` JWT callback attaches `role` to the token (required for the proxy's `CLIENT` redirect to work).
