import { inngest } from '@/lib/inngest'
import { prisma } from '@/lib/db'
import { startRun } from './run'
import { recordDecision, markDecisionResult, markDecisionFailed } from './decision-log'
/**
 * REVENUE EXPANSION — Agent #12
 *
 * Triggers:  cron weekly Monday 09:00 MYT  +  'revenue/expansion.check' event
 * Reads:     Clients (with projects, invoices), Projects
 * Writes:    flags only (no direct DB mutation — all expansion ideas are PENDING_APPROVAL)
 *
 * Actions:
 *  1. Upsell: clients with ≥ 3 DELIVERED projects & GOLD/PLATINUM tier → suggest upsell
 *  2. Renewal: projects DELIVERED > 90 days ago, no follow-up project → suggest renewal
 *  3. Tier upgrade: clients whose total paid ≥ tier threshold → suggest tier bump
 */

const TIER_THRESHOLDS: Record<string, number> = {
  BRONZE: 0,
  SILVER: 10000,
  GOLD:   50000,
  PLATINUM: 150000,
}

function suggestedTier(totalPaid: number): string {
  if (totalPaid >= TIER_THRESHOLDS.PLATINUM) return 'PLATINUM'
  if (totalPaid >= TIER_THRESHOLDS.GOLD) return 'GOLD'
  if (totalPaid >= TIER_THRESHOLDS.SILVER) return 'SILVER'
  return 'BRONZE'
}

export async function runRevenueExpansion(
  opts: { triggerKind: 'cron' | 'event' | 'manual'; triggerRef?: string } = { triggerKind: 'manual' },
): Promise<{ runId: string; upsells: number; renewals: number; tierBumps: number }> {
  const run = await startRun({ agent: 'REVENUE_EXPANSION', triggerKind: opts.triggerKind, triggerRef: opts.triggerRef })
  if (run.skipped) return { runId: run.id, upsells: 0, renewals: 0, tierBumps: 0 }

  try {
    // Parallel-load clients and project stats (avoids fetching ALL project rows)
    const [clients, deliveredByClient, paidByClient, staleProjects] = await Promise.all([
      prisma.client.findMany({ take: 200 }),
      prisma.project.groupBy({
        by: ['clientId'],
        where: { status: 'COMPLETED' },
        _count: { _all: true },
      }),
      prisma.project.groupBy({
        by: ['clientId'],
        _sum: { paidAmount: true },
      }),
      prisma.project.findMany({
        where: { status: 'COMPLETED', updatedAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
        select: { id: true, clientId: true, updatedAt: true },
      }),
    ])

    const deliveredMap = new Map(deliveredByClient.map((c) => [c.clientId, c._count._all]))
    const paidMap = new Map(paidByClient.map((c) => [c.clientId, c._sum.paidAmount ?? 0]))
    const staleByClient = new Map<string | null, typeof staleProjects>()
    for (const p of staleProjects) {
      const arr = staleByClient.get(p.clientId) ?? []
      arr.push(p)
      staleByClient.set(p.clientId, arr)
    }

    let upsells = 0
    let renewals = 0
    let tierBumps = 0

    for (const client of clients) {
      const deliveredCount = deliveredMap.get(client.id) ?? 0
      const totalPaid = paidMap.get(client.id) ?? 0

      // ── Upsell: high-activity clients ──────────────────────────────────
      if (deliveredCount >= 3 && (client.tier === 'GOLD' || client.tier === 'PLATINUM')) {
        await recordDecision({
          runId: run.id,
          agent: 'REVENUE_EXPANSION',
          action: 'suggest_upsell',
          rationale: `"${client.companyName}" — ${deliveredCount} delivered projects, ${client.tier} tier → upsell candidate`,
          confidence: 0.55, // intentionally below threshold → PENDING_APPROVAL
          entityType: 'Client',
          entityId: client.id,
          proposedChange: { suggestUpsell: true, deliveredCount },
          valueCents: Math.round(totalPaid * 100 * 0.2), // ~20% additional potential
        })
        upsells++
      }

      // ── Renewal: stale delivered projects ───────────────────────────────
      const clientStaleProjects = staleByClient.get(client.id) ?? []
      for (const proj of clientStaleProjects) {
        await recordDecision({
          runId: run.id,
          agent: 'REVENUE_EXPANSION',
          action: 'suggest_renewal',
          rationale: `Project ${proj.id.slice(0, 8)} delivered > 90 days ago for "${client.companyName}" — renewal opportunity`,
          confidence: 0.60, // below threshold → review
          entityType: 'Project',
          entityId: proj.id,
          proposedChange: { suggestRenewal: true },
        })
        renewals++
      }

      // ── Tier upgrade ────────────────────────────────────────────────────
      const recommended = suggestedTier(totalPaid)
      const tierOrder = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']
      if (tierOrder.indexOf(recommended) > tierOrder.indexOf(client.tier)) {
        const decision = await recordDecision({
          runId: run.id,
          agent: 'REVENUE_EXPANSION',
          action: 'suggest_tier_upgrade',
          rationale: `"${client.companyName}" total paid RM${totalPaid.toFixed(0)} qualifies for ${recommended} (current: ${client.tier})`,
          confidence: 0.82,
          entityType: 'Client',
          entityId: client.id,
          proposedChange: { tier: recommended, previousTier: client.tier },
        })

        if (decision.status === 'AUTO_EXECUTED') {
          try {
            await prisma.client.update({
              where: { id: client.id },
              data: { tier: recommended as 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' },
            })
            await markDecisionResult(decision.id, { upgraded: true })
            tierBumps++
          } catch (error: unknown) {
            await markDecisionFailed(decision.id, error)
          }
        }
      }
    }

    await run.finish(`Upsells ${upsells}, renewals ${renewals}, tier bumps ${tierBumps}`)
    return { runId: run.id, upsells, renewals, tierBumps }
  } catch (error: unknown) {
    await run.fail(error)
    throw error
  }
}

export const revenueExpansionFn = inngest.createFunction(
  {
    id: 'revenue-expansion',
    name: 'Revenue Expansion — upsells, renewals & tier upgrades',
    triggers: [
      { cron: '0 9 * * 1' }, // weekly Monday 09:00
      { event: 'revenue/expansion.check' },
    ],
  },
  async ({ event, step }) => {
    const triggerKind: 'cron' | 'event' = event.name === 'revenue/expansion.check' ? 'event' : 'cron'
    return step.run('run-revenue-expansion', () =>
      runRevenueExpansion({ triggerKind, triggerRef: event.id ?? event.name }),
    )
  },
)
