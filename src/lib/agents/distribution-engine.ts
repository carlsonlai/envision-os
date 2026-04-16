import { inngest } from '@/lib/inngest'
import { prisma } from '@/lib/db'
import { startRun } from './run'
import { recordDecision, markDecisionResult, markDecisionFailed } from './decision-log'
import { logger, getErrorMessage } from '@/lib/logger'

/**
 * DISTRIBUTION ENGINE — Agent #4
 *
 * Triggers:  cron every 30 min  +  'distribution/campaign.ready' event
 * Reads:     AdCampaigns (READY status — copy reviewed)
 * Writes:    AdCampaign.status → ACTIVE
 *
 * Activation heuristic:
 *  - Campaign has adCopy + hookAngle + visualConcept (all non-null)
 *  - Budget ≥ RM50 (5000 cents)
 *  - Marks campaign ACTIVE so external integrations (FB API, TikTok, etc.) pick it up
 */

export async function runDistributionEngine(
  opts: { triggerKind: 'cron' | 'event' | 'manual'; triggerRef?: string } = { triggerKind: 'manual' },
): Promise<{ runId: string; activated: number; skipped: number }> {
  const run = await startRun({ agent: 'DISTRIBUTION_ENGINE', triggerKind: opts.triggerKind, triggerRef: opts.triggerRef })

  try {
    const campaigns = await prisma.adCampaign.findMany({
      where: { status: 'READY' },
      take: 50,
    })

    let activated = 0
    let skipped = 0

    for (const c of campaigns) {
      const missing: string[] = []
      if (!c.adCopy)        missing.push('adCopy')
      if (!c.hookAngle)     missing.push('hookAngle')
      if (!c.visualConcept) missing.push('visualConcept')
      if ((c.budget ?? 0) < 50) missing.push('budget<RM50')

      const isReady = missing.length === 0
      const confidence = isReady ? 0.88 : 0.40

      const decision = await recordDecision({
        runId: run.id,
        agent: 'DISTRIBUTION_ENGINE',
        action: isReady ? 'activate_campaign' : 'skip_campaign',
        rationale: isReady
          ? `Campaign ${c.id.slice(0, 8)} fully ready — activating on ${c.platform}`
          : `Campaign ${c.id.slice(0, 8)} missing: ${missing.join(', ')}`,
        confidence,
        entityType: 'AdCampaign',
        entityId: c.id,
        proposedChange: isReady ? { status: 'ACTIVE' } : { skipped: true, missing },
        valueCents: c.budget ? Math.round(c.budget * 100) : undefined,
      })

      if (isReady && decision.status === 'AUTO_EXECUTED') {
        try {
          await prisma.adCampaign.update({ where: { id: c.id }, data: { status: 'ACTIVE' } })
          await markDecisionResult(decision.id, { activated: true })
          activated++
        } catch (error: unknown) {
          await markDecisionFailed(decision.id, error)
        }
      } else {
        skipped++
      }
    }

    await run.finish(`Activated ${activated}, skipped ${skipped}`)
    return { runId: run.id, activated, skipped }
  } catch (error: unknown) {
    await run.fail(error)
    throw error
  }
}

export const distributionEngineFn = inngest.createFunction(
  {
    id: 'distribution-engine',
    name: 'Distribution Engine — activate ready campaigns',
    triggers: [
      { cron: '*/30 * * * *' },
      { event: 'distribution/campaign.ready' },
    ],
  },
  async ({ event, step }) => {
    const triggerKind: 'cron' | 'event' = event.name === 'distribution/campaign.ready' ? 'event' : 'cron'
    return step.run('run-distribution-engine', () =>
      runDistributionEngine({ triggerKind, triggerRef: event.id ?? event.name }),
    )
  },
)
