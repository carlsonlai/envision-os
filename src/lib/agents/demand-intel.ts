import { inngest, AGENT_EVENTS } from '@/lib/inngest'
import { prisma } from '@/lib/db'
import { startRun } from './run'
import { recordDecision, markDecisionResult, markDecisionFailed } from './decision-log'
import { logger, getErrorMessage } from '@/lib/logger'
import type { Lead, LeadScore } from '@prisma/client'

/**
 * DEMAND INTEL — Agent #1
 *
 * Triggers:   cron every 30 min  OR  'demand-intel/scan.requested' event
 * Reads:      recent Lead rows (last 14 days, NEW status, unscored or COLD)
 * Writes:     Lead.score + Lead.status (when auto-executed)
 * Logs:       AgentRun + AgentDecision
 *
 * Scoring heuristic (deterministic, explainable):
 *   +0.40  corporate email (non-free provider)
 *   +0.20  company ≠ "" and ≠ name
 *   +0.15  phone present
 *   +0.15  source is "referral" or "inbound"
 *   +0.10  notes contain budget/timeline keywords
 *   → confidence = sum (capped at 1.0), score = HOT ≥0.75, WARM ≥0.40, COLD <0.40
 */

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
  'aol.com', 'protonmail.com', 'live.com', 'me.com', 'msn.com',
])

const BUDGET_KEYWORDS = /\b(budget|rm\s*\d|myr\s*\d|\$\s*\d|quote|quotation|proposal|timeline|deadline|urgent)\b/i

interface ScoredLead {
  lead: Lead
  confidence: number
  recommendedScore: LeadScore
  signals: string[]
}

function scoreLead(lead: Lead): ScoredLead {
  const signals: string[] = []
  let conf = 0

  const emailDomain = (lead.email.split('@')[1] ?? '').toLowerCase()
  if (emailDomain && !FREE_EMAIL_DOMAINS.has(emailDomain)) {
    conf += 0.40
    signals.push(`corporate_email:${emailDomain}`)
  }

  if (lead.company.trim() && lead.company.trim().toLowerCase() !== lead.name.trim().toLowerCase()) {
    conf += 0.20
    signals.push('has_company')
  }

  if (lead.phone && lead.phone.trim().length >= 7) {
    conf += 0.15
    signals.push('has_phone')
  }

  const src = (lead.source ?? '').toLowerCase()
  if (src.includes('referral') || src.includes('inbound') || src.includes('whatsapp')) {
    conf += 0.15
    signals.push(`source:${src}`)
  }

  if (lead.notes && BUDGET_KEYWORDS.test(lead.notes)) {
    conf += 0.10
    signals.push('intent_keywords')
  }

  const capped = Math.min(1, conf)
  const recommendedScore: LeadScore = capped >= 0.75 ? 'HOT' : capped >= 0.40 ? 'WARM' : 'COLD'

  return { lead, confidence: capped, recommendedScore, signals }
}

export async function runDemandIntel(
  opts: { triggerKind: 'cron' | 'event' | 'manual'; triggerRef?: string } = { triggerKind: 'manual' },
): Promise<{ runId: string; scanned: number; changed: number }> {
  const run = await startRun({
    agent: 'DEMAND_INTEL',
    triggerKind: opts.triggerKind,
    triggerRef: opts.triggerRef,
  })

  try {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    const candidates = await prisma.lead.findMany({
      where: {
        createdAt: { gte: since },
        status: 'NEW',
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    let changed = 0
    for (const lead of candidates) {
      const scored = scoreLead(lead)
      if (scored.recommendedScore === lead.score) continue   // no change needed

      const decision = await recordDecision({
        runId: run.id,
        agent: 'DEMAND_INTEL',
        action: 'rescore_lead',
        rationale: `Signals: ${scored.signals.join(', ') || 'none'} → ${scored.recommendedScore}`,
        confidence: scored.confidence,
        entityType: 'Lead',
        entityId: lead.id,
        inputSnapshot: { currentScore: lead.score, signals: scored.signals },
        proposedChange: { score: scored.recommendedScore },
      })

      if (decision.status === 'AUTO_EXECUTED') {
        try {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { score: scored.recommendedScore },
          })
          await markDecisionResult(decision.id, { applied: true, newScore: scored.recommendedScore })
          // Chain: notify Lead Engine that a lead was rescored
          await inngest.send({ name: AGENT_EVENTS.demandIntelLeadScored, data: { leadId: lead.id, newScore: scored.recommendedScore } })
          changed++
        } catch (error: unknown) {
          await markDecisionFailed(decision.id, error)
          logger.warn('demand-intel.apply.failed', {
            leadId: lead.id,
            error: getErrorMessage(error),
          })
        }
      }
    }

    await run.finish(`Scanned ${candidates.length} leads, changed ${changed}`)
    return { runId: run.id, scanned: candidates.length, changed }
  } catch (error: unknown) {
    await run.fail(error)
    throw error
  }
}

/** Inngest function — cron every 30 minutes + event-driven. */
export const demandIntelFn = inngest.createFunction(
  {
    id: 'demand-intel-scan',
    name: 'Demand Intel — rescore recent leads',
    triggers: [
      { cron: '*/30 * * * *' },
      { event: 'demand-intel/scan.requested' },
    ],
  },
  async ({ event, step }) => {
    const triggerKind: 'cron' | 'event' =
      event.name === 'demand-intel/scan.requested' ? 'event' : 'cron'
    const result = await step.run('run-demand-intel', () =>
      runDemandIntel({ triggerKind, triggerRef: event.id ?? event.name }),
    )
    return result
  },
)
