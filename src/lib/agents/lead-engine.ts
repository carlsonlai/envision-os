import { inngest } from '@/lib/inngest'
import { prisma } from '@/lib/db'
import { startRun } from './run'
import { recordDecision, markDecisionResult, markDecisionFailed } from './decision-log'
import { logger, getErrorMessage } from '@/lib/logger'

/**
 * LEAD ENGINE — Agent #2
 *
 * Triggers:  cron every 15 min  +  'lead-engine/lead.created' event
 * Reads:     Leads (HOT/WARM, unassigned), Users (SALES role)
 * Writes:    Lead.assignedSalesId + Lead.status → QUALIFIED
 *
 * Routing heuristic:
 *  - HOT leads → sales rep with fewest open HOT leads (round-robin capacity)
 *  - WARM leads → sales rep with fewest total open leads
 *  - COLD leads with status NEW and age > 7d → move to NURTURE
 */

export async function runLeadEngine(
  opts: { triggerKind: 'cron' | 'event' | 'manual'; triggerRef?: string } = { triggerKind: 'manual' },
): Promise<{ runId: string; routed: number; nurtured: number }> {
  const run = await startRun({ agent: 'LEAD_ENGINE', triggerKind: opts.triggerKind, triggerRef: opts.triggerRef })

  try {
    // ── Step 1: Route unassigned HOT/WARM leads ──────────────────────────────
    const unassigned = await prisma.lead.findMany({
      where: { assignedSalesId: null, score: { in: ['HOT', 'WARM'] }, status: 'NEW' },
      orderBy: { createdAt: 'asc' },
      take: 100,
    })

    const salesReps = await prisma.user.findMany({
      where: { role: 'SALES' },
      select: { id: true, name: true },
    })

    if (salesReps.length === 0) {
      await run.finish(`No SALES users found — skipped ${unassigned.length} unassigned leads`)
      return { runId: run.id, routed: 0, nurtured: 0 }
    }

    // Count current open leads per rep
    const counts = await prisma.lead.groupBy({
      by: ['assignedSalesId'],
      where: { assignedSalesId: { not: null }, status: { in: ['NEW', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATING'] } },
      _count: true,
    })
    const loadMap = new Map<string, number>()
    for (const rep of salesReps) loadMap.set(rep.id, 0)
    for (const c of counts) if (c.assignedSalesId) loadMap.set(c.assignedSalesId, c._count)

    let routed = 0
    for (const lead of unassigned) {
      // Pick rep with lightest load
      let bestId = salesReps[0].id
      let bestLoad = Infinity
      for (const rep of salesReps) {
        const load = loadMap.get(rep.id) ?? 0
        if (load < bestLoad) { bestLoad = load; bestId = rep.id }
      }

      const confidence = lead.score === 'HOT' ? 0.90 : 0.72
      const repName = salesReps.find((r) => r.id === bestId)?.name ?? bestId

      const decision = await recordDecision({
        runId: run.id,
        agent: 'LEAD_ENGINE',
        action: 'route_to_rep',
        rationale: `${lead.score} lead "${lead.name}" → ${repName} (load: ${bestLoad})`,
        confidence,
        entityType: 'Lead',
        entityId: lead.id,
        proposedChange: { assignedSalesId: bestId, status: 'QUALIFIED' },
      })

      if (decision.status === 'AUTO_EXECUTED') {
        try {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { assignedSalesId: bestId, status: 'QUALIFIED' },
          })
          loadMap.set(bestId, (loadMap.get(bestId) ?? 0) + 1)
          await markDecisionResult(decision.id, { routed: true, repId: bestId })
          routed++
        } catch (error: unknown) {
          await markDecisionFailed(decision.id, error)
          logger.warn('lead-engine.route.failed', { leadId: lead.id, error: getErrorMessage(error) })
        }
      }
    }

    // ── Step 2: Move stale COLD leads to NURTURE ─────────────────────────────
    const staleDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const staleLeads = await prisma.lead.findMany({
      where: { score: 'COLD', status: 'NEW', createdAt: { lt: staleDate } },
      take: 200,
    })

    let nurtured = 0
    for (const lead of staleLeads) {
      const decision = await recordDecision({
        runId: run.id,
        agent: 'LEAD_ENGINE',
        action: 'move_to_nurture',
        rationale: `COLD lead "${lead.name}" inactive > 7 days → NURTURE`,
        confidence: 0.85,
        entityType: 'Lead',
        entityId: lead.id,
        proposedChange: { status: 'NURTURE' },
      })

      if (decision.status === 'AUTO_EXECUTED') {
        try {
          await prisma.lead.update({ where: { id: lead.id }, data: { status: 'NURTURE' } })
          await markDecisionResult(decision.id, { applied: true })
          nurtured++
        } catch (error: unknown) {
          await markDecisionFailed(decision.id, error)
        }
      }
    }

    await run.finish(`Routed ${routed} leads, nurtured ${nurtured}`)
    return { runId: run.id, routed, nurtured }
  } catch (error: unknown) {
    await run.fail(error)
    throw error
  }
}

export const leadEngineFn = inngest.createFunction(
  {
    id: 'lead-engine-route',
    name: 'Lead Engine — route & nurture leads',
    triggers: [
      { cron: '*/15 * * * *' },
      { event: 'lead-engine/lead.created' },
    ],
  },
  async ({ event, step }) => {
    const triggerKind: 'cron' | 'event' = event.name === 'lead-engine/lead.created' ? 'event' : 'cron'
    return step.run('run-lead-engine', () =>
      runLeadEngine({ triggerKind, triggerRef: event.id ?? event.name }),
    )
  },
)
