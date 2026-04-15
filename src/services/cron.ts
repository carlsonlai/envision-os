import cron from 'node-cron'
import { prisma } from '@/lib/db'
import { pollNewInvoices, pollPayments, pollQuotations } from '@/services/bukku'
import { createProjectFromInvoice, createProjectFromQuotation } from '@/services/brief-creator'
import { checkCapacityAlerts, getCompanyTimeline } from '@/services/workload'
import { getSettings } from '@/services/settings'
import { notify } from '@/services/lark'
import { logger, getErrorMessage } from '@/lib/logger'

let isInitialized = false

// ─── Bukku: Invoice polling (every 5 min) ────────────────────────────────────

async function pollBukkuInvoices(): Promise<void> {
  try {
    const settings = await getSettings()
    if (!settings.autoImportInvoices) {
      return // auto-import disabled — only manual imports via admin UI
    }

    const latestSync = await prisma.bukkuSyncLog.findFirst({
      where: { type: 'INVOICE' },
      orderBy: { lastSyncedAt: 'desc' },
    })

    const since = latestSync?.lastSyncedAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000)
    const invoices = await pollNewInvoices(since)

    for (const invoice of invoices) {
      const existing = await prisma.project.findFirst({
        where: { bukkuInvoiceId: invoice.id },
      })

      if (!existing) {
        try {
          await createProjectFromInvoice(invoice)
          logger.info(`[Cron] Auto-created project for Bukku invoice ${invoice.id}`)
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          logger.error(`[Cron] Failed to create project for invoice ${invoice.id}: ${msg}`)
        }
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error(`[Cron] pollBukkuInvoices error: ${msg}`)
  }
}

// ─── Bukku: Quotation polling (every 10 min) ─────────────────────────────────

async function pollBukkuQuotations(): Promise<void> {
  try {
    const settings = await getSettings()
    if (!settings.autoImportQuotes) {
      return // auto-import disabled
    }

    const latestSync = await prisma.bukkuSyncLog.findFirst({
      where: { type: 'QUOTE' },
      orderBy: { lastSyncedAt: 'desc' },
    })

    const since = latestSync?.lastSyncedAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000)
    const quotations = await pollQuotations(since)

    // Only auto-create for accepted/approved quotations
    const accepted = quotations.filter((q) =>
      ['accepted', 'approved', 'won'].includes(q.status.toLowerCase())
    )

    for (const quotation of accepted) {
      const existing = await prisma.project.findFirst({
        where: { bukkuQuoteId: quotation.id },
      })

      if (!existing) {
        try {
          await createProjectFromQuotation(quotation)
          logger.info(`[Cron] Auto-created project for Bukku quotation ${quotation.id}`)
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          logger.error(`[Cron] Failed to create project for quotation ${quotation.id}: ${msg}`)
        }
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error(`[Cron] pollBukkuQuotations error: ${msg}`)
  }
}

// ─── Bukku: Payment polling (every 15 min) ───────────────────────────────────

async function pollBukkuPayments(): Promise<void> {
  try {
    const latestSync = await prisma.bukkuSyncLog.findFirst({
      where: { type: 'PAYMENT' },
      orderBy: { lastSyncedAt: 'desc' },
    })

    const since = latestSync?.lastSyncedAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000)
    const payments = await pollPayments(since)

    for (const payment of payments) {
      const invoice = await prisma.invoice.findFirst({
        where: { bukkuInvoiceId: payment.invoice_id },
        include: { project: true },
      })

      if (invoice) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: 'PAID',
            paidAt: new Date(payment.payment_date),
          },
        })

        await prisma.project.update({
          where: { id: invoice.projectId },
          data: { paidAmount: { increment: payment.amount } },
        })

        await prisma.bukkuSyncLog.create({
          data: {
            type: 'PAYMENT',
            bukkuId: payment.id,
            data: JSON.parse(JSON.stringify(payment)),
          },
        })
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error(`[Cron] pollBukkuPayments error: ${msg}`)
  }
}

// ─── Unbilled project alerts (every hour) ────────────────────────────────────

async function checkUnbilledProjects(): Promise<void> {
  try {
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000)

    const unbilledProjects = await prisma.project.findMany({
      where: {
        status: 'COMPLETED',
        invoices: { none: {} },
        updatedAt: { lt: oneDayAgo },
      },
      include: {
        client: true,
        assignedCS: { select: { name: true } },
      },
    })

    const criticalUnbilled = unbilledProjects.filter((p) => p.updatedAt < threeDaysAgo)
    const warningUnbilled = unbilledProjects.filter(
      (p) => p.updatedAt >= threeDaysAgo && p.updatedAt < oneDayAgo
    )

    if (warningUnbilled.length > 0) {
      const body = warningUnbilled
        .map((p) => `- **${p.code}** — ${p.client?.companyName ?? 'Unknown'} (completed >24h ago)`)
        .join('\n')

      await notify('CS', {
        title: `${warningUnbilled.length} Completed Project(s) Need Follow-up`,
        body: `The following completed projects are pending follow-up:\n\n${body}`,
        actionLabel: 'View Projects',
        actionUrl: `${process.env.NEXTAUTH_URL}/cs`,
      })
    }

    if (criticalUnbilled.length > 0) {
      const body = criticalUnbilled
        .map((p) => `- **${p.code}** — ${p.client?.companyName ?? 'Unknown'} (>72h pending!)`)
        .join('\n')

      await notify('MANAGEMENT', {
        title: `URGENT: ${criticalUnbilled.length} Project(s) Pending >72h`,
        body: `These projects have been completed for over 72 hours and need immediate follow-up:\n\n${body}`,
        actionLabel: 'View Projects',
        actionUrl: `${process.env.NEXTAUTH_URL}/command`,
      })
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error(`[Cron] checkUnbilledProjects error: ${msg}`)
  }
}

// ─── Daily capacity alerts (8am) ─────────────────────────────────────────────

async function runDailyCapacityAlerts(): Promise<void> {
  try {
    await checkCapacityAlerts()
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error(`[Cron] checkCapacityAlerts error: ${msg}`)
  }
}

// ─── Weekly workload digest ───────────────────────────────────────────────────
// Fires every day at 8am and checks if today matches the configured digest day.
// This avoids restarting cron when the setting changes.

async function maybeRunWeeklyDigest(): Promise<void> {
  try {
    const settings = await getSettings()
    const today = new Date().getDay() // 0 = Sunday … 6 = Saturday

    if (today !== settings.weeklyDigestDay) return

    const timeline = await getCompanyTimeline()

    const activeCount = timeline.activeProjects.length
    const pendingCount = timeline.totalPendingTasks
    const estimatedHours = timeline.totalEstimatedHours
    const unassignedCount = timeline.unassignedTasks.length
    const criticalCount = timeline.criticalDeadlines.length

    // Build designer workload table
    const workloadLines = timeline.designerWorkload
      .sort((a, b) => b.utilizationToday - a.utilizationToday)
      .map((d) => {
        const bar = buildBar(d.utilizationToday)
        const overload = d.isOverloaded ? ' ⚠️' : ''
        return `- **${d.name}** (${d.role.replace('_', ' ')})${overload}\n  Tasks: ${d.totalPendingTasks} | Est. ${Math.round(d.totalEstimatedMinutes / 60)}h | Today: ${d.utilizationToday}% ${bar}`
      })
      .join('\n')

    // Critical deadlines section
    const criticalLines = timeline.criticalDeadlines
      .slice(0, 5)
      .map(
        (d) =>
          `- **${d.projectCode}** — ${d.description ?? d.itemType} (due ${
            d.deadline
              ? new Date(d.deadline).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })
              : 'TBD'
          })`
      )
      .join('\n')

    const body = [
      `**Active Projects:** ${activeCount}   |   **Pending Tasks:** ${pendingCount}   |   **Estimated Hours:** ${estimatedHours}h`,
      `**Unassigned Tasks:** ${unassignedCount}   |   **Critical Deadlines (≤3 days):** ${criticalCount}`,
      '',
      '**Team Workload This Week:**',
      workloadLines || '_No designers with active tasks._',
      ...(criticalCount > 0
        ? ['', '**⚠️ Critical Deadlines:**', criticalLines]
        : []),
    ].join('\n')

    await notify('MANAGEMENT', {
      title: `📊 Weekly Team Workload Digest`,
      body,
      actionLabel: 'View Full Dashboard',
      actionUrl: `${process.env.NEXTAUTH_URL}/admin/workload`,
    })

    logger.info('[Cron] Weekly workload digest sent.')
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error(`[Cron] maybeRunWeeklyDigest error: ${msg}`)
  }
}

function buildBar(percent: number): string {
  const filled = Math.round(percent / 10)
  return '█'.repeat(filled) + '░'.repeat(10 - filled)
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initCronJobs(): void {
  if (isInitialized) return
  isInitialized = true

  // Poll Bukku invoices every 5 minutes (gated by autoImportInvoices setting)
  cron.schedule('*/5 * * * *', () => {
    logger.info('[Cron] Polling Bukku invoices...')
    void pollBukkuInvoices()
  })

  // Poll Bukku quotations every 10 minutes (gated by autoImportQuotes setting)
  cron.schedule('*/10 * * * *', () => {
    logger.info('[Cron] Polling Bukku quotations...')
    void pollBukkuQuotations()
  })

  // Poll Bukku payments every 15 minutes (always on)
  cron.schedule('*/15 * * * *', () => {
    logger.info('[Cron] Polling Bukku payments...')
    void pollBukkuPayments()
  })

  // Check unbilled projects every hour
  cron.schedule('0 * * * *', () => {
    logger.info('[Cron] Checking unbilled projects...')
    void checkUnbilledProjects()
  })

  // Daily capacity alerts at 8am
  cron.schedule('0 8 * * *', () => {
    logger.info('[Cron] Running daily capacity alerts...')
    void runDailyCapacityAlerts()
  })

  // Weekly digest check — runs every morning at 8:05am, self-gates by weeklyDigestDay setting
  cron.schedule('5 8 * * *', () => {
    logger.info('[Cron] Checking weekly digest day...')
    void maybeRunWeeklyDigest()
  })

  logger.info('[Cron] All scheduled jobs initialised.')
}
