import { inngest } from '@/lib/inngest'
import { prisma } from '@/lib/db'
import { startRun } from './run'
import { recordDecision, markDecisionResult, markDecisionFailed } from './decision-log'

/**
 * PERFORMANCE OPTIMIZER — Agent #5
 *
 * Triggers:  cron daily 10:00 MYT  +  'perf-optimizer/review.requested' event
 * Reads:     AdCampaigns (ACTIVE with spend data)
 * Writes:    AdCampaign.status → PAUSED  (underperformers)
 *
 * Heuristic:
 *  - CPC = spend / clicks (if clicks > 10)
 *  - CTR = clicks / impressions (if impressions > 100)
 *  - If CPC > RM10 or CTR < 0.5% → suggest pause
 *  - If conversions / clicks < 1% AND spend > RM500 → suggest pause
 */

interface CampaignMetrics {
  cpc: number | null
  ctr: number | null
  convRate: number | null
}

function computeMetrics(c: { spend: number; clicks: number; impressions: number; conversions: number }): CampaignMetrics {
  return {
    cpc: c.clicks > 10 ? c.spend / c.clicks : null,
    ctr: c.impressions > 100 ? c.clicks / c.impressions : null,
    convRate: c.clicks > 20 ? c.conversions / c.clicks : null,
  }
}

export async function runPerformanceOptimizer(
  opts: { triggerKind: 'cron' | 'event' | 'manual'; triggerRef?: string } = { triggerKind: 'manual' },
): Promise<{ runId: string; reviewed: number; paused: number }> {
  const run = await startRun({ agent: 'PERFORMANCE_OPTIMIZER', triggerKind: opts.triggerKind, triggerRef: opts.triggerRef })
  if (run.skipped) return { runId: run.id, reviewed: 0, paused: 0 }

  try {
    const campaigns = await prisma.adCampaign.findMany({
      where: { status: 'ACTIVE' },
      take: 100,
    })

    let paused = 0
    for (const c of campaigns) {
      const m = computeMetrics(c)
      const issues: string[] = []

      if (m.cpc !== null && m.cpc > 10)     issues.push(`CPC RM${m.cpc.toFixed(2)} > RM10`)
      if (m.ctr !== null && m.ctr < 0.005)   issues.push(`CTR ${(m.ctr * 100).toFixed(2)}% < 0.5%`)
      if (m.convRate !== null && m.convRate < 0.01 && c.spend > 500)
        issues.push(`Conv rate ${(m.convRate * 100).toFixed(2)}% < 1% with spend RM${c.spend.toFixed(0)}`)

      if (issues.length === 0) continue  // performing OK

      const confidence = Math.min(0.92, 0.70 + issues.length * 0.08)

      const decision = await recordDecision({
        runId: run.id,
        agent: 'PERFORMANCE_OPTIMIZER',
        action: 'pause_underperformer',
        rationale: issues.join('; '),
        confidence,
        entityType: 'AdCampaign',
        entityId: c.id,
        proposedChange: { status: 'PAUSED' },
        valueCents: Math.round(c.spend * 100),
      })

      if (decision.status === 'AUTO_EXECUTED') {
        try {
          await prisma.adCampaign.update({ where: { id: c.id }, data: { status: 'PAUSED' } })
          await markDecisionResult(decision.id, { paused: true, cpc: m.cpc, ctr: m.ctr, convRate: m.convRate })
          paused++
        } catch (error: unknown) {
          await markDecisionFailed(decision.id, error)
        }
      }
    }

    await run.finish(`Reviewed ${campaigns.length}, paused ${paused} underperformers`)
    return { runId: run.id, reviewed: campaigns.length, paused }
  } catch (error: unknown) {
    await run.fail(error)
    throw error
  }
}

export const performanceOptimizerFn = inngest.createFunction(
  {
    id: 'performance-optimizer',
    name: 'Performance Optimizer — pause underperforming ads',
    triggers: [
      { cron: '0 10 * * *' },
      { event: 'perf-optimizer/review.requested' },
    ],
  },
  async ({ event, step }) => {
    const triggerKind: 'cron' | 'event' = event.name === 'perf-optimizer/review.requested' ? 'event' : 'cron'
    return step.run('run-perf-optimizer', () =>
      runPerformanceOptimizer({ triggerKind, triggerRef: event.id ?? event.name }),
    )
  },
)
