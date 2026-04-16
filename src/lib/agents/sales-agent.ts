import { inngest } from '@/lib/inngest'
import { prisma } from '@/lib/db'
import { startRun } from './run'
import { recordDecision, markDecisionResult, markDecisionFailed } from './decision-log'
import Anthropic from '@anthropic-ai/sdk'

/**
 * SALES AGENT — Agent #6
 *
 * Triggers:  cron daily 08:30 MYT  +  'sales-agent/proposal.needed' event
 * Reads:     Leads (QUALIFIED, no proposals), Proposals (SENT, unopened > 3d)
 * Writes:    Creates Proposal rows, updates ProspectConversation
 *
 * Actions:
 *  1. Auto-draft proposals for qualified leads with no proposal
 *  2. Flag stale proposals (SENT > 3 days, not opened) for follow-up
 */

async function draftProposalTitle(leadName: string, company: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return `Proposal for ${company || leadName} — Envision Studios`

  try {
    const anthropic = new Anthropic({ apiKey: key })
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 80,
      system: 'Generate a short, professional proposal title for a Malaysian creative agency. One line only.',
      messages: [{ role: 'user', content: `Lead: ${leadName}, Company: ${company}. Write a proposal title.` }],
    })
    return (msg.content[0].type === 'text' ? msg.content[0].text : '').trim() || `Proposal for ${company}`
  } catch {
    return `Proposal for ${company || leadName} — Envision Studios`
  }
}

export async function runSalesAgent(
  opts: { triggerKind: 'cron' | 'event' | 'manual'; triggerRef?: string } = { triggerKind: 'manual' },
): Promise<{ runId: string; drafted: number; flagged: number }> {
  const run = await startRun({ agent: 'SALES_AGENT', triggerKind: opts.triggerKind, triggerRef: opts.triggerRef })

  try {
    // ── Step 1: Draft proposals for qualified leads with none ─────────────
    const leadsNeedingProposal = await prisma.lead.findMany({
      where: { status: 'QUALIFIED', proposals: { none: {} } },
      take: 30,
    })

    let drafted = 0
    for (const lead of leadsNeedingProposal) {
      const title = await draftProposalTitle(lead.name, lead.company)

      const decision = await recordDecision({
        runId: run.id,
        agent: 'SALES_AGENT',
        action: 'draft_proposal',
        rationale: `QUALIFIED lead "${lead.name}" (${lead.company}) has no proposals — drafting`,
        confidence: 0.72,
        entityType: 'Lead',
        entityId: lead.id,
        proposedChange: { title, amount: 0, status: 'DRAFT' },
      })

      if (decision.status === 'AUTO_EXECUTED') {
        try {
          await prisma.proposal.create({ data: { leadId: lead.id, title, amount: 0, status: 'DRAFT' } })
          await prisma.lead.update({ where: { id: lead.id }, data: { status: 'PROPOSAL_SENT' } })
          await markDecisionResult(decision.id, { created: true })
          drafted++
        } catch (error: unknown) {
          await markDecisionFailed(decision.id, error)
        }
      }
    }

    // ── Step 2: Flag stale sent proposals ──────────────────────────────────
    const staleDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    const stale = await prisma.proposal.findMany({
      where: { status: 'SENT', sentAt: { lt: staleDate }, openedAt: null },
      include: { lead: { select: { name: true, company: true } } },
      take: 50,
    })

    let flagged = 0
    for (const p of stale) {
      const decision = await recordDecision({
        runId: run.id,
        agent: 'SALES_AGENT',
        action: 'flag_stale_proposal',
        rationale: `Proposal "${p.title}" sent ${Math.round((Date.now() - (p.sentAt?.getTime() ?? 0)) / 86400000)}d ago, unopened`,
        confidence: 0.85,
        entityType: 'Proposal',
        entityId: p.id,
        proposedChange: { needsFollowUp: true },
      })
      if (decision.status === 'AUTO_EXECUTED') {
        await markDecisionResult(decision.id, { flagged: true })
        flagged++
      }
    }

    await run.finish(`Drafted ${drafted} proposals, flagged ${flagged} stale`)
    return { runId: run.id, drafted, flagged }
  } catch (error: unknown) {
    await run.fail(error)
    throw error
  }
}

export const salesAgentFn = inngest.createFunction(
  {
    id: 'sales-agent',
    name: 'Sales Agent — draft proposals & flag stale',
    triggers: [
      { cron: '30 8 * * *' },
      { event: 'sales-agent/proposal.needed' },
    ],
  },
  async ({ event, step }) => {
    const triggerKind: 'cron' | 'event' = event.name === 'sales-agent/proposal.needed' ? 'event' : 'cron'
    return step.run('run-sales-agent', () =>
      runSalesAgent({ triggerKind, triggerRef: event.id ?? event.name }),
    )
  },
)
