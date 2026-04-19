import { inngest } from '@/lib/inngest'
import { prisma } from '@/lib/db'
import { startRun } from './run'
import { recordDecision, markDecisionResult, markDecisionFailed } from './decision-log'
import { notify } from '@/services/lark'
import { logger, getErrorMessage } from '@/lib/logger'

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

/**
 * PAYMENT AGENT — Agent #7
 *
 * Triggers:  cron daily 09:30 MYT  +  'payment/invoice.overdue' event
 * Reads:     Invoices (PENDING, past due), Projects
 * Writes:    Invoice.notifiedAt (marks dunning sent), marks overdue
 *
 * Actions:
 *  1. Flag invoices past due date (PENDING + dueAt < now)
 *  2. Escalate invoices overdue > 14 days
 *
 * IMPORTANT (CLAUDE.md business rule):
 *  Lark notifications MUST NOT mention invoice / quotation / pricing /
 *  payment / billing / RM amounts. Direct staff to Bukku for any financials.
 *  The Lark service silently drops blocked content, so any leak just disappears.
 */

export async function runPaymentAgent(
  opts: { triggerKind: 'cron' | 'event' | 'manual'; triggerRef?: string } = { triggerKind: 'manual' },
): Promise<{ runId: string; flagged: number; escalated: number; notified: number }> {
  const run = await startRun({ agent: 'PAYMENT_AGENT', triggerKind: opts.triggerKind, triggerRef: opts.triggerRef })
  if (run.skipped) return { runId: run.id, flagged: 0, escalated: 0, notified: 0 }

  try {
    const now = new Date()
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: 'PENDING',
        dueAt: { lt: now },
      },
      include: { project: { select: { code: true, clientId: true } } },
      take: 100,
    })

    let flagged = 0
    let escalated = 0
    let notified = 0
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    // Track project codes already notified this run so we don't spam MANAGEMENT
    // when a single project has multiple overdue items.
    const notifiedProjects = new Set<string>()

    for (const inv of overdueInvoices) {
      const daysPastDue = Math.round((now.getTime() - (inv.dueAt?.getTime() ?? now.getTime())) / 86400000)
      const isEscalation = (inv.dueAt?.getTime() ?? now.getTime()) < fourteenDaysAgo.getTime()
      const alreadyNotified = inv.notifiedAt !== null

      const action = isEscalation ? 'escalate_overdue' : 'flag_overdue'
      const confidence = isEscalation ? 0.92 : 0.80

      const decision = await recordDecision({
        runId: run.id,
        agent: 'PAYMENT_AGENT',
        action,
        rationale: `Invoice ${inv.invoiceNumber ?? inv.id.slice(0, 8)} — RM${inv.amount.toFixed(2)} overdue ${daysPastDue}d (project ${inv.project?.code ?? '?'})${alreadyNotified ? ' [already notified]' : ''}`,
        confidence,
        entityType: 'Invoice',
        entityId: inv.id,
        proposedChange: { notifiedAt: now.toISOString(), daysPastDue },
        valueCents: Math.round(inv.amount * 100),
      })

      if (decision.status === 'AUTO_EXECUTED') {
        try {
          await prisma.invoice.update({
            where: { id: inv.id },
            data: { notifiedAt: now },
          })
          await markDecisionResult(decision.id, { notified: true, escalation: isEscalation })
          if (isEscalation) escalated++
          else flagged++

          // Lark MANAGEMENT alert for escalations only — keep it sparse and
          // POLICY-SAFE: no invoice / RM / payment / billing / quotation / price
          // language. Staff are directed to Bukku for the actual financials.
          const projectCode = inv.project?.code
          if (isEscalation && projectCode && !notifiedProjects.has(projectCode)) {
            try {
              await notify('MANAGEMENT', {
                title: `Client account attention required — ${projectCode}`,
                body:
                  `A client account on project **${projectCode}** has been flagged for management review. ` +
                  `Please review the latest status in **Bukku** and coordinate next steps with CS.`,
                projectCode,
                actionLabel: 'Open Project',
                actionUrl: `${APP_BASE_URL}/admin/projects`,
              })
              notifiedProjects.add(projectCode)
              notified++
            } catch (error: unknown) {
              logger.warn(`[payment-agent] Lark notify failed for ${projectCode}: ${getErrorMessage(error)}`)
            }
          }
        } catch (error: unknown) {
          await markDecisionFailed(decision.id, error)
        }
      }
    }

    await run.finish(`Flagged ${flagged}, escalated ${escalated} (>14d), notified ${notified}`)
    return { runId: run.id, flagged, escalated, notified }
  } catch (error: unknown) {
    await run.fail(error)
    throw error
  }
}

export const paymentAgentFn = inngest.createFunction(
  {
    id: 'payment-agent',
    name: 'Payment Agent — dunning & escalation',
    triggers: [
      { cron: '30 9 * * *' },
      { event: 'payment/invoice.overdue' },
    ],
  },
  async ({ event, step }) => {
    const triggerKind: 'cron' | 'event' = event.name === 'payment/invoice.overdue' ? 'event' : 'cron'
    return step.run('run-payment-agent', () =>
      runPaymentAgent({ triggerKind, triggerRef: event.id ?? event.name }),
    )
  },
)
