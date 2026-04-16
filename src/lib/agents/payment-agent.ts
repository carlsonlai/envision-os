import { inngest } from '@/lib/inngest'
import { prisma } from '@/lib/db'
import { startRun } from './run'
import { recordDecision, markDecisionResult, markDecisionFailed } from './decision-log'
import { getErrorMessage } from '@/lib/logger'

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
 */

export async function runPaymentAgent(
  opts: { triggerKind: 'cron' | 'event' | 'manual'; triggerRef?: string } = { triggerKind: 'manual' },
): Promise<{ runId: string; flagged: number; escalated: number }> {
  const run = await startRun({ agent: 'PAYMENT_AGENT', triggerKind: opts.triggerKind, triggerRef: opts.triggerRef })

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
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

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
          await markDecisionResult(decision.id, { notified: true })
          if (isEscalation) escalated++
          else flagged++
        } catch (error: unknown) {
          await markDecisionFailed(decision.id, error)
        }
      }
    }

    await run.finish(`Flagged ${flagged} overdue, escalated ${escalated} (>14d)`)
    return { runId: run.id, flagged, escalated }
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
