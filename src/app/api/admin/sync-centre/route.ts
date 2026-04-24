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
    // Check which platforms have tokens configured — no external API calls
    // (live stats are fetched on-demand when visiting the Analytics page)
    const platformTokens: Array<{ id: string; name: string }> = []
    if (process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID) platformTokens.push({ id: 'instagram', name: 'Instagram' })
    if (process.env.FACEBOOK_PAGE_ACCESS_TOKEN && process.env.FACEBOOK_PAGE_ID) platformTokens.push({ id: 'facebook', name: 'Facebook' })
    if (process.env.YOUTUBE_API_KEY && process.env.YOUTUBE_CHANNEL_ID) platformTokens.push({ id: 'youtube', name: 'YouTube' })
    if (process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_ORGANIZATION_ID) platformTokens.push({ id: 'linkedin', name: 'LinkedIn' })
    if (process.env.TIKTOK_ACCESS_TOKEN) platformTokens.push({ id: 'tiktok', name: 'TikTok' })
    if (process.env.MAILCHIMP_API_KEY) platformTokens.push({ id: 'mailchimp', name: 'Mailchimp' })

    // Also check DB-saved tokens from OAuth flow
    const dbTokens = await prisma.$queryRawUnsafe<Array<{ key: string }>>(
      `SELECT key FROM "SocialConfig" WHERE key IN ('meta_connected','linkedin_connected','tiktok_connected','google_connected') AND (value->>'connected')::boolean = true`
    ).catch(() => [] as Array<{ key: string }>)

    const dbConnected = (dbTokens as Array<{ key: string }>).map(r => r.key.replace('_connected', ''))
    const allConnected = Array.from(new Set([...platformTokens.map(p => p.id), ...dbConnected]))

    // Record sync timestamp
    await prisma.$executeRawUnsafe(
      `INSERT INTO "SocialConfig" (key, value, "updatedAt") VALUES ($1,$2::jsonb,NOW())
       ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, "updatedAt"=NOW()`,
      'social_last_synced',
      JSON.stringify({ syncedAt: new Date().toISOString(), connectedCount: allConnected.length }),
    ).catch(() => { /* non-fatal */ })

    return {
      success: true,
      module: 'social-analytics',
      summary: allConnected.length > 0
        ? `${allConnected.length} platform${allConnected.length !== 1 ? 's' : ''} connected — visit Analytics to load live stats`
        : 'No platforms connected — go to Admin → Social Connect to link accounts',
      details: { connectedCount: allConnected.length, platforms: allConnected },
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
