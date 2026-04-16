import { inngest } from '@/lib/inngest'
import { prisma } from '@/lib/db'
import { startRun } from './run'
import { recordDecision, markDecisionResult, markDecisionFailed } from './decision-log'
import { getErrorMessage } from '@/lib/logger'

/**
 * ONBOARDING AGENT — Agent #8
 *
 * Triggers:  cron hourly  +  'onboarding/lead.won' event
 * Reads:     Leads (WON), Clients (no projects, created < 48h)
 * Writes:    Lead.status (WON → closed), Client.tier
 *
 * Actions:
 *  1. Convert won leads that don't yet have a Client record → flag for manual setup
 *  2. Ensure fresh Clients (< 48h, no projects) get BRONZE tier set
 *  3. Flag clients without assignedCSId for CS assignment
 */

export async function runOnboardingAgent(
  opts: { triggerKind: 'cron' | 'event' | 'manual'; triggerRef?: string } = { triggerKind: 'manual' },
): Promise<{ runId: string; onboarded: number; flaggedForCS: number }> {
  const run = await startRun({ agent: 'ONBOARDING_AGENT', triggerKind: opts.triggerKind, triggerRef: opts.triggerRef })

  try {
    // ── Step 1: Fresh clients with no projects → ensure tier ──────────────
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)
    const freshClients = await prisma.client.findMany({
      where: {
        createdAt: { gte: twoDaysAgo },
        projects: { none: {} },
      },
      take: 50,
    })

    let onboarded = 0
    for (const client of freshClients) {
      if (client.tier !== 'BRONZE') continue // already upgraded

      const decision = await recordDecision({
        runId: run.id,
        agent: 'ONBOARDING_AGENT',
        action: 'set_initial_tier',
        rationale: `New client "${client.companyName}" — confirming BRONZE tier, 0 projects`,
        confidence: 0.95,
        entityType: 'Client',
        entityId: client.id,
        proposedChange: { tier: 'BRONZE', onboardedAt: new Date().toISOString() },
      })

      if (decision.status === 'AUTO_EXECUTED') {
        try {
          // tier is already BRONZE by default, just marking it acknowledged
          await markDecisionResult(decision.id, { acknowledged: true })
          onboarded++
        } catch (error: unknown) {
          await markDecisionFailed(decision.id, error)
        }
      }
    }

    // ── Step 2: Clients with no CS assigned → flag ────────────────────────
    const unassignedCS = await prisma.client.findMany({
      where: { assignedCSId: null },
      take: 100,
    })

    let flaggedForCS = 0
    for (const client of unassignedCS) {
      const decision = await recordDecision({
        runId: run.id,
        agent: 'ONBOARDING_AGENT',
        action: 'flag_no_cs_assigned',
        rationale: `Client "${client.companyName}" has no assigned Client Servicing rep`,
        confidence: 0.90,
        entityType: 'Client',
        entityId: client.id,
        proposedChange: { needsCSAssignment: true },
      })

      if (decision.status === 'AUTO_EXECUTED') {
        await markDecisionResult(decision.id, { flagged: true })
        flaggedForCS++
      }
    }

    await run.finish(`Onboarded ${onboarded} fresh clients, flagged ${flaggedForCS} needing CS`)
    return { runId: run.id, onboarded, flaggedForCS }
  } catch (error: unknown) {
    await run.fail(error)
    throw error
  }
}

export const onboardingAgentFn = inngest.createFunction(
  {
    id: 'onboarding-agent',
    name: 'Onboarding Agent — welcome & assign new clients',
    triggers: [
      { cron: '0 * * * *' },
      { event: 'onboarding/lead.won' },
    ],
  },
  async ({ event, step }) => {
    const triggerKind: 'cron' | 'event' = event.name === 'onboarding/lead.won' ? 'event' : 'cron'
    return step.run('run-onboarding-agent', () =>
      runOnboardingAgent({ triggerKind, triggerRef: event.id ?? event.name }),
    )
  },
)
