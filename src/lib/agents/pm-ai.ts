import { inngest } from '@/lib/inngest'
import { prisma } from '@/lib/db'
import { startRun } from './run'
import { recordDecision, markDecisionResult, markDecisionFailed } from './decision-log'
import { getErrorMessage } from '@/lib/logger'

/**
 * PM AI — Agent #9
 *
 * Triggers:  cron daily 08:00 MYT  +  'pm-ai/rebalance.requested' event
 * Reads:     DeliverableItems (in-progress), WorkloadSlots, Users (designers)
 * Writes:    DeliverableItem.assignedDesignerId (rebalance)
 *
 * Actions:
 *  1. Detect overloaded designers (> 5 active items)
 *  2. Find underloaded designers (< 2 active items)
 *  3. Propose rebalancing from overloaded → underloaded
 *  4. Flag items past deadline with IN_PROGRESS status
 */

interface DesignerLoad {
  userId: string
  name: string
  activeCount: number
}

export async function runPmAi(
  opts: { triggerKind: 'cron' | 'event' | 'manual'; triggerRef?: string } = { triggerKind: 'manual' },
): Promise<{ runId: string; rebalanced: number; deadlineFlagged: number }> {
  const run = await startRun({ agent: 'PM_AI', triggerKind: opts.triggerKind, triggerRef: opts.triggerRef })
  if (run.skipped) return { runId: run.id, rebalanced: 0, deadlineFlagged: 0 }

  try {
    // Load all designers
    const designers = await prisma.user.findMany({
      where: { role: { in: ['GRAPHIC_DESIGNER', 'JUNIOR_DESIGNER', 'JUNIOR_ART_DIRECTOR', 'DESIGNER_3D'] } },
      select: { id: true, name: true },
    })

    // Count active items per designer
    const activeCounts = await prisma.deliverableItem.groupBy({
      by: ['assignedDesignerId'],
      where: { status: { in: ['IN_PROGRESS', 'QC_REVIEW'] }, assignedDesignerId: { not: null } },
      _count: { _all: true },
    })

    const loadMap = new Map<string, DesignerLoad>()
    for (const d of designers) loadMap.set(d.id, { userId: d.id, name: d.name ?? d.id, activeCount: 0 })
    for (const c of activeCounts) {
      if (c.assignedDesignerId) {
        const entry = loadMap.get(c.assignedDesignerId)
        if (entry) entry.activeCount = c._count._all
      }
    }

    const overloaded = Array.from(loadMap.values()).filter((d) => d.activeCount > 5)
    const underloaded = Array.from(loadMap.values()).filter((d) => d.activeCount < 2)

    let rebalanced = 0
    for (const over of overloaded) {
      if (underloaded.length === 0) break

      const items = await prisma.deliverableItem.findMany({
        where: { assignedDesignerId: over.userId, status: 'IN_PROGRESS' },
        orderBy: { deadline: 'desc' },
        take: 2, // move at most 2 items off overloaded
      })

      for (const item of items) {
        if (underloaded.length === 0) break
        const target = underloaded[0]

        const decision = await recordDecision({
          runId: run.id,
          agent: 'PM_AI',
          action: 'rebalance_workload',
          rationale: `Move item "${item.description ?? item.id.slice(0, 8)}" from ${over.name} (${over.activeCount} items) → ${target.name} (${target.activeCount} items)`,
          confidence: 0.70,
          entityType: 'DeliverableItem',
          entityId: item.id,
          proposedChange: { assignedDesignerId: target.userId, previousDesignerId: over.userId },
        })

        if (decision.status === 'AUTO_EXECUTED') {
          try {
            await prisma.deliverableItem.update({ where: { id: item.id }, data: { assignedDesignerId: target.userId } })
            await markDecisionResult(decision.id, { moved: true })
            over.activeCount--
            target.activeCount++
            if (target.activeCount >= 2) underloaded.shift()
            rebalanced++
          } catch (error: unknown) {
            await markDecisionFailed(decision.id, error)
          }
        }
      }
    }

    // ── Flag items past deadline ──────────────────────────────────────────
    const now = new Date()
    const pastDeadlineItems = await prisma.deliverableItem.findMany({
      where: {
        status: { in: ['IN_PROGRESS', 'QC_REVIEW'] },
        deadline: { lt: now },
      },
      select: { id: true, description: true, deadline: true, projectId: true },
      take: 100,
    })

    // Batch-fetch project codes
    const projectIds = [...new Set(pastDeadlineItems.map((i) => i.projectId))]
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, code: true },
    })
    const codeMap = new Map(projects.map((p) => [p.id, p.code]))

    let deadlineFlagged = 0
    for (const item of pastDeadlineItems) {
      const daysLate = Math.round((now.getTime() - (item.deadline?.getTime() ?? now.getTime())) / 86400000)

      const decision = await recordDecision({
        runId: run.id,
        agent: 'PM_AI',
        action: 'flag_past_deadline',
        rationale: `"${item.description ?? item.id.slice(0, 8)}" (${codeMap.get(item.projectId) ?? '?'}) is ${daysLate}d past deadline`,
        confidence: 0.95,
        entityType: 'DeliverableItem',
        entityId: item.id,
        proposedChange: { pastDeadline: true, daysLate },
      })

      if (decision.status === 'AUTO_EXECUTED') {
        await markDecisionResult(decision.id, { flagged: true })
        deadlineFlagged++
      }
    }

    await run.finish(`Rebalanced ${rebalanced} items, flagged ${deadlineFlagged} past deadline`)
    return { runId: run.id, rebalanced, deadlineFlagged }
  } catch (error: unknown) {
    await run.fail(error)
    throw error
  }
}

export const pmAiFn = inngest.createFunction(
  {
    id: 'pm-ai-rebalance',
    name: 'PM AI — schedule & rebalance work',
    triggers: [
      { cron: '0 8 * * *' },
      { event: 'pm-ai/rebalance.requested' },
    ],
  },
  async ({ event, step }) => {
    const triggerKind: 'cron' | 'event' = event.name === 'pm-ai/rebalance.requested' ? 'event' : 'cron'
    return step.run('run-pm-ai', () =>
      runPmAi({ triggerKind, triggerRef: event.id ?? event.name }),
    )
  },
)
