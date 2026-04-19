import { inngest } from '@/lib/inngest'
import { prisma } from '@/lib/db'
import { startRun } from './run'
import { recordDecision, markDecisionResult, markDecisionFailed } from './decision-log'
import { notify } from '@/services/lark'
import { logger, getErrorMessage } from '@/lib/logger'

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

/**
 * ONBOARDING AGENT — Agent #8
 *
 * Triggers:  cron hourly  +  'onboarding/lead.won' event
 * Reads:     Clients (no projects, created < 48h), Clients (no assigned CS),
 *            Users (CLIENT_SERVICING role)
 * Writes:    Client.assignedCSId (load-balanced), records onboarding decisions
 *
 * Actions:
 *  1. Acknowledge fresh BRONZE clients (< 48h, no projects yet)
 *  2. Auto-assign Client Servicing rep to clients with no CS — uses
 *     lightest-load round-robin across CLIENT_SERVICING + AI_CS_AGENT users
 *     (mirrors LEAD_ENGINE routing pattern)
 *  3. Lark CS notify whenever a real human CS is assigned a new client
 *
 * Lark wording is policy-safe (no invoice / payment / pricing / RM language).
 */

const ASSIGNABLE_CS_ROLES = ['CLIENT_SERVICING', 'AI_CS_AGENT'] as const

export async function runOnboardingAgent(
  opts: { triggerKind: 'cron' | 'event' | 'manual'; triggerRef?: string } = { triggerKind: 'manual' },
): Promise<{ runId: string; onboarded: number; assigned: number; notified: number }> {
  const run = await startRun({ agent: 'ONBOARDING_AGENT', triggerKind: opts.triggerKind, triggerRef: opts.triggerRef })
  if (run.skipped) return { runId: run.id, onboarded: 0, assigned: 0, notified: 0 }

  try {
    // ── Step 1: Fresh clients with no projects → acknowledge BRONZE tier ────
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
          // Tier already BRONZE by default — record acknowledgement only.
          await markDecisionResult(decision.id, { acknowledged: true })
          onboarded++
        } catch (error: unknown) {
          await markDecisionFailed(decision.id, error)
        }
      }
    }

    // ── Step 2: Auto-assign CS rep to clients with no CS ────────────────────
    // Load-balanced across CLIENT_SERVICING + AI_CS_AGENT users.
    const [unassignedClients, csReps, csCounts] = await Promise.all([
      prisma.client.findMany({
        where: { assignedCSId: null },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }),
      prisma.user.findMany({
        where: { role: { in: [...ASSIGNABLE_CS_ROLES] } },
        select: { id: true, name: true, role: true },
      }),
      prisma.client.groupBy({
        by: ['assignedCSId'],
        where: { assignedCSId: { not: null } },
        _count: true,
      }),
    ])

    let assigned = 0
    let notified = 0

    if (csReps.length === 0) {
      await run.finish(`Onboarded ${onboarded} fresh clients, 0 CS reps available — skipped ${unassignedClients.length}`)
      return { runId: run.id, onboarded, assigned: 0, notified: 0 }
    }

    const csLoad = new Map<string, number>()
    for (const rep of csReps) csLoad.set(rep.id, 0)
    for (const c of csCounts) if (c.assignedCSId) csLoad.set(c.assignedCSId, c._count)

    for (const client of unassignedClients) {
      // Pick CS with lightest load. Prefer human CLIENT_SERVICING over AI when ties tie.
      let bestId = csReps[0].id
      let bestLoad = Infinity
      let bestIsHuman = false
      for (const rep of csReps) {
        const load = csLoad.get(rep.id) ?? 0
        const isHuman = rep.role === 'CLIENT_SERVICING'
        const better = load < bestLoad || (load === bestLoad && isHuman && !bestIsHuman)
        if (better) {
          bestLoad = load
          bestId = rep.id
          bestIsHuman = isHuman
        }
      }

      const repName = csReps.find((r) => r.id === bestId)?.name ?? bestId

      const decision = await recordDecision({
        runId: run.id,
        agent: 'ONBOARDING_AGENT',
        action: 'auto_assign_cs',
        rationale: `Client "${client.companyName}" → ${repName} (load: ${bestLoad}${bestIsHuman ? ', human' : ', ai'})`,
        confidence: bestIsHuman ? 0.88 : 0.78,
        entityType: 'Client',
        entityId: client.id,
        proposedChange: { assignedCSId: bestId, repName },
      })

      if (decision.status === 'AUTO_EXECUTED') {
        try {
          await prisma.client.update({
            where: { id: client.id },
            data: { assignedCSId: bestId },
          })
          csLoad.set(bestId, (csLoad.get(bestId) ?? 0) + 1)
          await markDecisionResult(decision.id, { assigned: true, csId: bestId, csName: repName })
          assigned++

          // Lark CS notify for human assignments only — no need to ping the
          // channel for AI fallbacks. Policy-safe wording.
          if (bestIsHuman) {
            try {
              await notify('CS', {
                title: `New client assigned — ${client.companyName}`,
                body:
                  `**${repName}** has been auto-assigned as the Client Servicing lead for **${client.companyName}**. ` +
                  `Please reach out to introduce yourself and confirm onboarding next steps.`,
                actionLabel: 'Open Client',
                actionUrl: `${APP_BASE_URL}/admin/clients`,
              })
              notified++
            } catch (error: unknown) {
              logger.warn(`[onboarding-agent] Lark notify failed for client ${client.id}: ${getErrorMessage(error)}`)
            }
          }
        } catch (error: unknown) {
          await markDecisionFailed(decision.id, error)
        }
      }
    }

    await run.finish(`Onboarded ${onboarded}, assigned ${assigned} to CS, notified ${notified}`)
    return { runId: run.id, onboarded, assigned, notified }
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
