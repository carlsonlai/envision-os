/**
 * POST /api/admin/sync-centre?module=<module>
 *
 * Master sync endpoint. Triggers a sync for a specific module and returns
 * the result. Admin-only.
 *
 * Modules:
 *  bukku-finance   → invoices + quotations from Bukku
 *  bukku-payments  → payment reconciliation from Bukku
 *  bukku-jobtrack  → job track items from Bukku
 *  lark-staff      → staff members from Lark
 *  lark-projects   → project folders from Lark
 *  social-analytics → live stats from all connected social platforms
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

type SyncResult = {
  success: boolean
  module: string
  summary: string
  details?: Record<string, unknown>
  error?: string
  duration: number
}

async function syncBukkuFinance(): Promise<SyncResult> {
  const t = Date.now()
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/bukku/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  const data = await res.json() as Record<string, unknown>
  const ok = res.ok
  return {
    success: ok,
    module: 'bukku-finance',
    summary: ok
      ? `Imported ${data.invoicesImported ?? 0} invoices, ${data.quotationsImported ?? 0} quotations`
      : String(data.error ?? 'Sync failed'),
    details: data,
    duration: Date.now() - t,
  }
}

async function syncBukkuPayments(): Promise<SyncResult> {
  const t = Date.now()
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/bukku/sync-payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  const data = await res.json() as Record<string, unknown>
  const ok = res.ok
  return {
    success: ok,
    module: 'bukku-payments',
    summary: ok
      ? `Reconciled ${data.matched ?? 0} payments`
      : String(data.error ?? 'Sync failed'),
    details: data,
    duration: Date.now() - t,
  }
}

async function syncBukkuJobTrack(): Promise<SyncResult> {
  const t = Date.now()
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/bukku/sync-job-track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  const data = await res.json() as Record<string, unknown>
  const ok = res.ok
  return {
    success: ok,
    module: 'bukku-jobtrack',
    summary: ok
      ? `Synced ${data.synced ?? data.total ?? 0} job track items`
      : String(data.error ?? 'Sync failed'),
    details: data,
    duration: Date.now() - t,
  }
}

async function syncLarkStaff(): Promise<SyncResult> {
  const t = Date.now()
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/admin/sync-lark`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  const data = await res.json() as Record<string, unknown>
  const ok = res.ok
  const r = data.result as Record<string, number> | undefined
  return {
    success: ok,
    module: 'lark-staff',
    summary: ok
      ? `${r?.created ?? 0} created, ${r?.updated ?? 0} updated, ${r?.skipped ?? 0} unchanged`
      : String(data.error ?? 'Sync failed'),
    details: data,
    duration: Date.now() - t,
  }
}

async function syncLarkProjects(): Promise<SyncResult> {
  const t = Date.now()
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/admin/sync-lark-projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  const data = await res.json() as Record<string, unknown>
  const ok = res.ok
  return {
    success: ok,
    module: 'lark-projects',
    summary: ok
      ? `Linked ${data.linked ?? 0} projects, ${data.unmatched ?? 0} unmatched`
      : String(data.error ?? 'Sync failed'),
    details: data,
    duration: Date.now() - t,
  }
}

async function syncSocialAnalytics(): Promise<SyncResult> {
  const t = Date.now()
  try {
    // 1. Fetch live stats from all platforms
    const analyticsRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/social/analytics`)
    if (!analyticsRes.ok) throw new Error('Analytics fetch failed')
    const analyticsData = await analyticsRes.json() as {
      platforms: Array<{
        id: string; name: string; connected: boolean
        followers: number | null; followerGrowth: number | null
        reach: number | null; engagement: number | null
        leads: number | null; posts: number | null
      }>
      connectedCount: number
    }

    // 2. Save live stats to platform-stats DB table
    const connected = analyticsData.platforms.filter(p => p.connected)
    if (connected.length > 0) {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/social/platform-stats`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platforms: connected.map(p => ({
            id: p.id,
            followers: p.followers ?? 0,
            followerGrowth: p.followerGrowth ?? 0,
            reach: p.reach ?? 0,
            engagement: p.engagement ?? 0,
            leads: p.leads ?? 0,
            posts: p.posts ?? 0,
            likes: 0,
            comments: 0,
            score: 0,
            bestTime: '',
          })),
        }),
      })
    }

    // 3. Save last-synced timestamp to SocialConfig
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SocialConfig" (
        key TEXT PRIMARY KEY, value JSONB NOT NULL, "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await prisma.$executeRawUnsafe(
      `INSERT INTO "SocialConfig" (key, value, "updatedAt") VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = NOW()`,
      'social_last_synced',
      JSON.stringify({ syncedAt: new Date().toISOString(), connectedCount: analyticsData.connectedCount }),
    )

    return {
      success: true,
      module: 'social-analytics',
      summary: `Synced ${analyticsData.connectedCount} connected platform${analyticsData.connectedCount !== 1 ? 's' : ''}`,
      details: { connectedCount: analyticsData.connectedCount },
      duration: Date.now() - t,
    }
  } catch (err) {
    return {
      success: false,
      module: 'social-analytics',
      summary: err instanceof Error ? err.message : 'Sync failed',
      error: err instanceof Error ? err.message : 'Unknown error',
      duration: Date.now() - t,
    }
  }
}

// ─── GET: return last-synced timestamps for all modules ───────────────────────
export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Get last bukku sync times from SyncLog if it exists, otherwise return nulls
    const [socialConfig] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ key: string; value: unknown; updatedAt: Date }>>(
        `SELECT key, value, "updatedAt" FROM "SocialConfig" WHERE key IN ('social_last_synced', 'meta_connected', 'linkedin_connected') ORDER BY key`
      ).catch(() => []),
    ])

    const configMap = Object.fromEntries(
      (socialConfig as Array<{ key: string; value: unknown; updatedAt: Date }>).map(r => [r.key, r])
    )

    return NextResponse.json({
      modules: {
        'bukku-finance':    { lastSynced: null },
        'bukku-payments':   { lastSynced: null },
        'bukku-jobtrack':   { lastSynced: null },
        'lark-staff':       { lastSynced: null },
        'lark-projects':    { lastSynced: null },
        'social-analytics': {
          lastSynced: configMap['social_last_synced']?.updatedAt ?? null,
          details: configMap['social_last_synced']?.value ?? null,
        },
      },
    })
  } catch {
    return NextResponse.json({ modules: {} })
  }
}

// ─── POST: trigger a specific module sync ─────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const module = searchParams.get('module')

  let result: SyncResult

  switch (module) {
    case 'bukku-finance':
      result = await syncBukkuFinance()
      break
    case 'bukku-payments':
      result = await syncBukkuPayments()
      break
    case 'bukku-jobtrack':
      result = await syncBukkuJobTrack()
      break
    case 'lark-staff':
      result = await syncLarkStaff()
      break
    case 'lark-projects':
      result = await syncLarkProjects()
      break
    case 'social-analytics':
      result = await syncSocialAnalytics()
      break
    case 'all': {
      // Run all syncs and return combined results
      const results = await Promise.allSettled([
        syncBukkuFinance(),
        syncBukkuPayments(),
        syncBukkuJobTrack(),
        syncLarkStaff(),
        syncLarkProjects(),
        syncSocialAnalytics(),
      ])
      const all = results.map(r => r.status === 'fulfilled' ? r.value : {
        success: false, module: 'unknown', summary: 'Promise rejected', duration: 0,
      })
      const failed = all.filter(r => !r.success).length
      return NextResponse.json({
        success: failed === 0,
        summary: `${all.length - failed}/${all.length} modules synced successfully`,
        results: all,
      })
    }
    default:
      return NextResponse.json({ error: `Unknown module: ${module ?? '(none)'}. Valid: bukku-finance, bukku-payments, bukku-jobtrack, lark-staff, lark-projects, social-analytics, all` }, { status: 400 })
  }

  return NextResponse.json(result, { status: result.success ? 200 : 500 })
}
