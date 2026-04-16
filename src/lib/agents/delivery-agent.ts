import { inngest } from '@/lib/inngest'
import { prisma } from '@/lib/db'
import { startRun } from './run'
import { recordDecision, markDecisionResult, markDecisionFailed } from './decision-log'

/**
 * DELIVERY AGENT — Agent #11
 *
 * Triggers:  cron every 4 hours  +  'delivery/item.approved' event
 * Reads:     DeliverableItems (COMPLETED), Projects
 * Writes:    Project.status → DELIVERED (when all items done)
 *
 * Actions:
 *  1. Check projects where ALL deliverable items are COMPLETED → mark DELIVERED
 *  2. Flag projects with mixed statuses (some COMPLETED, some stale)
 */

export async function runDeliveryAgent(
  opts: { triggerKind: 'cron' | 'event' | 'manual'; triggerRef?: string } = { triggerKind: 'manual' },
): Promise<{ runId: string; delivered: number; flagged: number }> {
  const run = await startRun({ agent: 'DELIVERY_AGENT', triggerKind: opts.triggerKind, triggerRef: opts.triggerRef })
  if (run.skipped) return { runId: run.id, delivered: 0, flagged: 0 }

  try {
    // Use _count aggregation to avoid fetching all deliverable item rows
    const projects = await prisma.project.findMany({
      where: { status: 'ONGOING' },
      select: {
        id: true,
        code: true,
        client: { select: { companyName: true } },
        _count: {
          select: {
            deliverableItems: true,
          },
        },
      },
      take: 100,
    })

    // Batch-count completed items per project in one query
    const projectIds = projects.filter((p) => p._count.deliverableItems > 0).map((p) => p.id)
    const completedCounts = projectIds.length > 0
      ? await prisma.deliverableItem.groupBy({
          by: ['projectId'],
          where: { projectId: { in: projectIds }, status: { in: ['DELIVERED', 'FA_SIGNED'] } },
          _count: { _all: true },
        })
      : []
    const completedMap = new Map(completedCounts.map((c) => [c.projectId, c._count._all]))

    let delivered = 0
    let flagged = 0

    for (const proj of projects) {
      const total = proj._count.deliverableItems
      if (total === 0) continue

      const completed = completedMap.get(proj.id) ?? 0
      const allDone = completed === total

      if (allDone) {
        const decision = await recordDecision({
          runId: run.id,
          agent: 'DELIVERY_AGENT',
          action: 'mark_project_delivered',
          rationale: `All ${total} deliverables done for ${proj.code} (${proj.client?.companyName ?? 'no client'})`,
          confidence: 0.95,
          entityType: 'Project',
          entityId: proj.id,
          proposedChange: { status: 'COMPLETED' },
        })

        if (decision.status === 'AUTO_EXECUTED') {
          try {
            await prisma.project.update({ where: { id: proj.id }, data: { status: 'COMPLETED' } })
            await markDecisionResult(decision.id, { delivered: true })
            delivered++
          } catch (error: unknown) {
            await markDecisionFailed(decision.id, error)
          }
        }
      } else if (completed > 0 && completed >= total * 0.5) {
        const remaining = total - completed
        const decision = await recordDecision({
          runId: run.id,
          agent: 'DELIVERY_AGENT',
          action: 'flag_partial_delivery',
          rationale: `${proj.code}: ${completed}/${total} done, ${remaining} remaining — check for blockers`,
          confidence: 0.75,
          entityType: 'Project',
          entityId: proj.id,
          proposedChange: { partialDelivery: true, completedCount: completed, remainingCount: remaining },
        })

        if (decision.status === 'AUTO_EXECUTED') {
          await markDecisionResult(decision.id, { flagged: true })
          flagged++
        }
      }
    }

    await run.finish(`Delivered ${delivered} projects, flagged ${flagged} partial`)
    return { runId: run.id, delivered, flagged }
  } catch (error: unknown) {
    await run.fail(error)
    throw error
  }
}

export const deliveryAgentFn = inngest.createFunction(
  {
    id: 'delivery-agent',
    name: 'Delivery Agent — hand off completed projects',
    triggers: [
      { cron: '0 */4 * * *' },
      { event: 'delivery/item.approved' },
    ],
  },
  async ({ event, step }) => {
    const triggerKind: 'cron' | 'event' = event.name === 'delivery/item.approved' ? 'event' : 'cron'
    return step.run('run-delivery-agent', () =>
      runDeliveryAgent({ triggerKind, triggerRef: event.id ?? event.name }),
    )
  },
)
