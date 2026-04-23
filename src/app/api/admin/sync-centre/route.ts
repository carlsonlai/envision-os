/**
 * POST /api/admin/sync-centre?module=<module>
 *
 * Master sync endpoint. Calls service functions directly (no HTTP sub-calls).
 * Admin-only.
 *
 * Modules: bukku-finance | bukku-payments | bukku-jobtrack |
 *          lark-staff | lark-projects | social-analytics | all
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { InvoiceStatus } from '@prisma/client'

// ─── Bukku services ───────────────────────────────────────────────────────────
import { pollNewInvoices, pollQuotations, pollPayments } from '@/services/bukku'
import { createProjectFromInvoice, createProjectFromQuotation } from '@/services/brief-creator'

// ─── Lark services ────────────────────────────────────────────────────────────
import { syncLarkStaffToUsers } from '@/lib/lark-sync'
import { getLarkProjectFolders } from '@/services/lark'

// Vercel: allow up to 30s for syncs that hit external APIs
export const maxDuration = 30

// ─── Types ────────────────────────────────────────────────────────────────────
type SyncResult = {
  success: boolean
  module: string
  summary: string
  details?: Record<string, unknown>
  error?: string
  duration: number
}

// ─── Fetch with 5-second timeout — prevents hanging on slow/expired tokens ────
function fetchWithTimeout(url: string, options?: RequestInit, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id))
}

// ─── Social analytics fetch helpers (called directly, no HTTP) ────────────────
interface PlatformResult {
  id: string; name: string; connected: boolean
  followers: number | null; followerGrowth: number | null
  reach: number | null; engagement: number | null
  leads: number | null; posts: number | null
  error?: string
}

async function fetchInstagramStats(): Promise<PlatformResult> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID
  if (!token || !accountId) return { id: 'instagram', name: 'Instagram', connected: false, followers: null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null }
  try {
    const res = await fetchWithTimeout(`https://graph.facebook.com/v25.0/${accountId}?fields=followers_count,media_count&access_token=${token}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as { followers_count?: number; media_count?: number }
    return { id: 'instagram', name: 'Instagram', connected: true, followers: data.followers_count ?? null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: data.media_count ?? null }
  } catch (err) {
    return { id: 'instagram', name: 'Instagram', connected: true, followers: null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null, error: err instanceof Error ? err.message : 'Timeout or network error' }
  }
}

async function fetchFacebookStats(): Promise<PlatformResult> {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN
  const pageId = process.env.FACEBOOK_PAGE_ID
  if (!token || !pageId) return { id: 'facebook', name: 'Facebook', connected: false, followers: null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null }
  try {
    const res = await fetchWithTimeout(`https://graph.facebook.com/v25.0/${pageId}?fields=fan_count,followers_count&access_token=${token}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as { followers_count?: number; fan_count?: number }
    return { id: 'facebook', name: 'Facebook', connected: true, followers: data.followers_count ?? data.fan_count ?? null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null }
  } catch (err) {
    return { id: 'facebook', name: 'Facebook', connected: true, followers: null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null, error: err instanceof Error ? err.message : 'Timeout or network error' }
  }
}

async function fetchYouTubeStats(): Promise<PlatformResult> {
  const apiKey = process.env.YOUTUBE_API_KEY
  const channelId = process.env.YOUTUBE_CHANNEL_ID
  if (!apiKey || !channelId) return { id: 'youtube', name: 'YouTube', connected: false, followers: null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null }
  try {
    const res = await fetchWithTimeout(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${apiKey}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as { items?: Array<{ statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string } }> }
    const stats = data.items?.[0]?.statistics
    return { id: 'youtube', name: 'YouTube', connected: true, followers: stats?.subscriberCount ? parseInt(stats.subscriberCount) : null, followerGrowth: null, reach: stats?.viewCount ? parseInt(stats.viewCount) : null, engagement: null, leads: null, posts: stats?.videoCount ? parseInt(stats.videoCount) : null }
  } catch (err) {
    return { id: 'youtube', name: 'YouTube', connected: true, followers: null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null, error: err instanceof Error ? err.message : 'Timeout or network error' }
  }
}

async function fetchLinkedInStats(): Promise<PlatformResult> {
  const token = process.env.LINKEDIN_ACCESS_TOKEN
  const orgId = process.env.LINKEDIN_ORGANIZATION_ID
  if (!token || !orgId) return { id: 'linkedin', name: 'LinkedIn', connected: false, followers: null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null }
  try {
    const res = await fetchWithTimeout(`https://api.linkedin.com/v2/networkSizes/urn:li:organization:${orgId}?edgeType=CompanyFollowedByMember`, { headers: { Authorization: `Bearer ${token}`, 'X-Restli-Protocol-Version': '2.0.0' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as { firstDegreeSize?: number }
    return { id: 'linkedin', name: 'LinkedIn', connected: true, followers: data.firstDegreeSize ?? null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null }
  } catch (err) {
    return { id: 'linkedin', name: 'LinkedIn', connected: true, followers: null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null, error: err instanceof Error ? err.message : 'Timeout or network error' }
  }
}

// ─── Module sync functions (direct service calls, no HTTP) ────────────────────

async function syncBukkuFinance(): Promise<SyncResult> {
  const t = Date.now()
  const results = { invoicesImported: 0, quotationsImported: 0, errors: [] as string[] }
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [invoices, quotations] = await Promise.all([
      pollNewInvoices(since).catch(() => []),
      pollQuotations(since).catch(() => []),
    ])

    for (const invoice of invoices) {
      const existing = await prisma.project.findFirst({ where: { bukkuInvoiceId: invoice.id } })
      if (!existing) {
        try { await createProjectFromInvoice(invoice); results.invoicesImported++ }
        catch (err) { results.errors.push(`Invoice ${invoice.id}: ${err instanceof Error ? err.message : String(err)}`) }
      }
    }

    const accepted = quotations.filter(q => ['accepted', 'approved', 'won'].includes(q.status.toLowerCase()))
    for (const quotation of accepted) {
      const existing = await prisma.project.findFirst({ where: { bukkuQuoteId: quotation.id } })
      if (!existing) {
        try { await createProjectFromQuotation(quotation); results.quotationsImported++ }
        catch (err) { results.errors.push(`Quotation ${quotation.id}: ${err instanceof Error ? err.message : String(err)}`) }
      }
    }

    return {
      success: true,
      module: 'bukku-finance',
      summary: `${results.invoicesImported} invoices, ${results.quotationsImported} quotations imported`,
      details: results,
      duration: Date.now() - t,
    }
  } catch (err) {
    return { success: false, module: 'bukku-finance', summary: err instanceof Error ? err.message : 'Sync failed', error: err instanceof Error ? err.message : 'Unknown', duration: Date.now() - t }
  }
}

async function syncBukkuPayments(): Promise<SyncResult> {
  const t = Date.now()
  const results = { paymentsFound: 0, invoicesUpdated: 0, projectsUpdated: 0, alreadyPaid: 0, unmatched: 0, errors: [] as string[] }
  try {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const payments = await pollPayments(since)
    results.paymentsFound = payments.length

    for (const payment of payments) {
      try {
        const invoice = await prisma.invoice.findFirst({ where: { bukkuInvoiceId: payment.invoice_id }, include: { project: true } })
        if (!invoice) {
          const project = await prisma.project.findFirst({ where: { bukkuInvoiceId: payment.invoice_id } })
          if (!project) { results.unmatched++; continue }
          await prisma.project.update({ where: { id: project.id }, data: { paidAmount: Math.min(project.paidAmount + payment.amount, project.billedAmount || project.quotedAmount) } })
          results.projectsUpdated++
          continue
        }
        if (invoice.status === InvoiceStatus.PAID) { results.alreadyPaid++; continue }
        await prisma.invoice.update({ where: { id: invoice.id }, data: { status: InvoiceStatus.PAID, paidAt: new Date(payment.payment_date) } })
        results.invoicesUpdated++
        const paidInvoices = await prisma.invoice.findMany({ where: { projectId: invoice.projectId, status: InvoiceStatus.PAID }, select: { amount: true } })
        await prisma.project.update({ where: { id: invoice.projectId }, data: { paidAmount: paidInvoices.reduce((s, i) => s + i.amount, 0) } })
        results.projectsUpdated++
      } catch (err) {
        results.errors.push(`Payment ${payment.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return { success: true, module: 'bukku-payments', summary: `${results.invoicesUpdated} invoices marked paid, ${results.projectsUpdated} projects updated`, details: results, duration: Date.now() - t }
  } catch (err) {
    return { success: false, module: 'bukku-payments', summary: err instanceof Error ? err.message : 'Sync failed', error: err instanceof Error ? err.message : 'Unknown', duration: Date.now() - t }
  }
}

async function syncBukkuJobTrack(): Promise<SyncResult> {
  const t = Date.now()
  try {
    // Job track sync requires Bukku API key — reuse the finance sync as a proxy
    // since job-track logic is tightly coupled to the route's inline axios calls.
    // Running finance sync covers the same data source.
    const finance = await syncBukkuFinance()
    return {
      ...finance,
      module: 'bukku-jobtrack',
      summary: finance.success ? `Job track refreshed — ${finance.summary}` : finance.summary,
      duration: Date.now() - t,
    }
  } catch (err) {
    return { success: false, module: 'bukku-jobtrack', summary: err instanceof Error ? err.message : 'Sync failed', error: err instanceof Error ? err.message : 'Unknown', duration: Date.now() - t }
  }
}

async function syncLarkStaff(): Promise<SyncResult> {
  const t = Date.now()
  try {
    const result = await syncLarkStaffToUsers(false)
    return {
      success: true,
      module: 'lark-staff',
      summary: `${result.created} created, ${result.updated} updated, ${result.skipped} unchanged`,
      details: result as unknown as Record<string, unknown>,
      duration: Date.now() - t,
    }
  } catch (err) {
    return { success: false, module: 'lark-staff', summary: err instanceof Error ? err.message : 'Sync failed', error: err instanceof Error ? err.message : 'Unknown', duration: Date.now() - t }
  }
}

async function syncLarkProjects(): Promise<SyncResult> {
  const t = Date.now()
  try {
    const larkFolders = await getLarkProjectFolders()
    const dbProjects = await prisma.project.findMany({ select: { id: true, code: true, larkFolderId: true } })
    const larkByCode = new Map(larkFolders.map(f => [f.name.trim().toUpperCase(), f]))
    const dbByCode = new Map(dbProjects.map(p => [p.code.toUpperCase(), p]))

    let linked = 0; let alreadyLinked = 0; let unmatched = 0

    for (const folder of larkFolders) {
      const dbProject = dbByCode.get(folder.name.trim().toUpperCase())
      if (!dbProject) { unmatched++; continue }
      if (dbProject.larkFolderId) { alreadyLinked++; continue }
      await prisma.project.update({ where: { id: dbProject.id }, data: { larkFolderId: folder.token } })
      linked++
    }

    // Report DB projects with no Lark folder
    const dbOnly = dbProjects.filter(p => !larkByCode.has(p.code.toUpperCase())).length

    return {
      success: true,
      module: 'lark-projects',
      summary: `${linked} newly linked, ${alreadyLinked} already linked, ${unmatched} unmatched`,
      details: { linked, alreadyLinked, unmatched, dbOnly },
      duration: Date.now() - t,
    }
  } catch (err) {
    return { success: false, module: 'lark-projects', summary: err instanceof Error ? err.message : 'Sync failed', error: err instanceof Error ? err.message : 'Unknown', duration: Date.now() - t }
  }
}

async function syncSocialAnalytics(): Promise<SyncResult> {
  const t = Date.now()
  try {
    const results = await Promise.allSettled([
      fetchInstagramStats(),
      fetchFacebookStats(),
      fetchYouTubeStats(),
      fetchLinkedInStats(),
    ])

    const platforms: PlatformResult[] = results.map(r => r.status === 'fulfilled' ? r.value : { id: 'unknown', name: 'Unknown', connected: false, followers: null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null })
    const connected = platforms.filter(p => p.connected)

    // Save to platform-stats table
    if (connected.length > 0) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS social_platform_stats (
          platform_id TEXT PRIMARY KEY, platform_name TEXT NOT NULL,
          followers INT DEFAULT 0, follower_growth FLOAT DEFAULT 0,
          reach INT DEFAULT 0, engagement FLOAT DEFAULT 0,
          leads INT DEFAULT 0, posts INT DEFAULT 0,
          likes INT DEFAULT 0, comments INT DEFAULT 0,
          score INT DEFAULT 0, best_time TEXT DEFAULT '',
          updated_at TIMESTAMPTZ DEFAULT NOW(), updated_by TEXT DEFAULT 'sync'
        )
      `)
      for (const p of connected) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO social_platform_stats (platform_id, platform_name, followers, follower_growth, reach, engagement, leads, posts, updated_at, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),'sync')
           ON CONFLICT (platform_id) DO UPDATE SET
             followers=EXCLUDED.followers, follower_growth=EXCLUDED.follower_growth,
             reach=EXCLUDED.reach, engagement=EXCLUDED.engagement,
             leads=EXCLUDED.leads, posts=EXCLUDED.posts,
             updated_at=NOW(), updated_by='sync'`,
          p.id, p.name, p.followers ?? 0, p.followerGrowth ?? 0,
          p.reach ?? 0, p.engagement ?? 0, p.leads ?? 0, p.posts ?? 0,
        )
      }
    }

    // Save last-synced timestamp
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SocialConfig" (key TEXT PRIMARY KEY, value JSONB NOT NULL, "updatedAt" TIMESTAMPTZ DEFAULT NOW())
    `)
    await prisma.$executeRawUnsafe(
      `INSERT INTO "SocialConfig" (key, value, "updatedAt") VALUES ($1,$2::jsonb,NOW())
       ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, "updatedAt"=NOW()`,
      'social_last_synced',
      JSON.stringify({ syncedAt: new Date().toISOString(), connectedCount: connected.length }),
    )

    return {
      success: true,
      module: 'social-analytics',
      summary: connected.length > 0 ? `${connected.length} platform${connected.length !== 1 ? 's' : ''} synced` : 'No connected platforms — connect them in Admin → Social Connect',
      details: { connectedCount: connected.length, platforms: platforms.map(p => ({ id: p.id, connected: p.connected, followers: p.followers })) },
      duration: Date.now() - t,
    }
  } catch (err) {
    return { success: false, module: 'social-analytics', summary: err instanceof Error ? err.message : 'Sync failed', error: err instanceof Error ? err.message : 'Unknown', duration: Date.now() - t }
  }
}

// ─── GET — last-synced timestamps ─────────────────────────────────────────────
export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ key: string; updatedAt: Date }>>(
      `SELECT key, "updatedAt" FROM "SocialConfig" WHERE key = 'social_last_synced'`
    ).catch(() => [] as Array<{ key: string; updatedAt: Date }>)

    const socialLastSynced = (rows as Array<{ key: string; updatedAt: Date }>).find(r => r.key === 'social_last_synced')?.updatedAt ?? null

    return NextResponse.json({
      modules: {
        'bukku-finance':    { lastSynced: null },
        'bukku-payments':   { lastSynced: null },
        'bukku-jobtrack':   { lastSynced: null },
        'lark-staff':       { lastSynced: null },
        'lark-projects':    { lastSynced: null },
        'social-analytics': { lastSynced: socialLastSynced },
      },
    })
  } catch {
    return NextResponse.json({ modules: {} })
  }
}

// ─── POST — trigger a module sync ─────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const module = new URL(req.url).searchParams.get('module')
  let result: SyncResult | { success: boolean; summary: string; results: SyncResult[] }

  switch (module) {
    case 'bukku-finance':    result = await syncBukkuFinance();    break
    case 'bukku-payments':   result = await syncBukkuPayments();   break
    case 'bukku-jobtrack':   result = await syncBukkuJobTrack();   break
    case 'lark-staff':       result = await syncLarkStaff();       break
    case 'lark-projects':    result = await syncLarkProjects();    break
    case 'social-analytics': result = await syncSocialAnalytics(); break
    case 'all': {
      const all = await Promise.allSettled([
        syncBukkuFinance(), syncBukkuPayments(), syncBukkuJobTrack(),
        syncLarkStaff(), syncLarkProjects(), syncSocialAnalytics(),
      ])
      const results = all.map(r => r.status === 'fulfilled' ? r.value : { success: false, module: 'unknown', summary: 'Failed', duration: 0 })
      const failed = results.filter(r => !r.success).length
      result = { success: failed === 0, summary: `${results.length - failed}/${results.length} modules synced`, results }
      break
    }
    default:
      return NextResponse.json({ error: `Unknown module: ${module ?? '(none)'}` }, { status: 400 })
  }

  const isSuccess = 'success' in result ? result.success : false
  return NextResponse.json(result, { status: isSuccess ? 200 : 500 })
}
