import { inngest } from '@/lib/inngest'
import { prisma } from '@/lib/db'
import { startRun } from './run'
import { recordDecision, markDecisionResult, markDecisionFailed } from './decision-log'
import { logger, getErrorMessage } from '@/lib/logger'
import Anthropic from '@anthropic-ai/sdk'

/**
 * CONTENT GENERATOR — Agent #3
 *
 * Triggers:  cron daily 09:00 MYT  +  'content-generator/brief.ready' event
 * Reads:     AdCampaigns (DRAFT with no adCopy), Clients
 * Writes:    AdCampaign.adCopy, AdCampaign.hookAngle, AdCampaign.visualConcept
 *
 * Uses Claude to draft ad copy when Anthropic API key is present;
 * falls back to a deterministic template when absent.
 */

const TEMPLATE_HOOKS: Record<string, string[]> = {
  AWARENESS:   ['Did you know?', 'The truth about', 'Why top brands choose'],
  ENGAGEMENT:  ['Join the conversation:', 'Your thoughts?', 'Tag someone who'],
  LEADS:       ['Free consultation:', 'Limited slots:', 'Book your strategy call'],
  CONVERSION:  ['Last chance:', 'Exclusive offer:', 'Ready to transform?'],
  RETARGETING: ['Still thinking?', 'Here\'s what you missed:', 'Come back for'],
}

function templateCopy(campaign: { objective: string; targetAudience: string | null; platform: string }): { hook: string; copy: string; visual: string } {
  const hooks = TEMPLATE_HOOKS[campaign.objective] ?? TEMPLATE_HOOKS.AWARENESS
  const hook = hooks[Math.floor(Math.random() * hooks.length)]
  const audience = campaign.targetAudience ?? 'businesses in Malaysia'
  return {
    hook,
    copy: `${hook} ${audience} — discover how Envision Studios can elevate your brand. [CTA: Learn More]`,
    visual: `Clean ${campaign.platform.toLowerCase()} layout — bold headline, brand gradient, lifestyle photography`,
  }
}

async function aiCopy(campaign: { objective: string; targetAudience: string | null; platform: string; clientName?: string }): Promise<{ hook: string; copy: string; visual: string } | null> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return null

  try {
    const anthropic = new Anthropic({ apiKey: key })
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: 'You are an expert ad copywriter for a Malaysian creative agency called Envision Studios. Output JSON only with keys: hook, copy, visual.',
      messages: [{
        role: 'user',
        content: `Write a ${campaign.platform} ad for objective=${campaign.objective}. Target audience: ${campaign.targetAudience ?? 'Malaysian businesses'}. Client: ${campaign.clientName ?? 'general'}. Keep copy under 100 words. Return ONLY valid JSON.`,
      }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const json = JSON.parse(text)
    return { hook: json.hook, copy: json.copy, visual: json.visual }
  } catch (error: unknown) {
    logger.warn('content-generator.ai.failed', { error: getErrorMessage(error) })
    return null
  }
}

export async function runContentGenerator(
  opts: { triggerKind: 'cron' | 'event' | 'manual'; triggerRef?: string } = { triggerKind: 'manual' },
): Promise<{ runId: string; generated: number }> {
  const run = await startRun({ agent: 'CONTENT_GENERATOR', triggerKind: opts.triggerKind, triggerRef: opts.triggerRef })
  if (run.skipped) return { runId: run.id, generated: 0 }

  try {
    const drafts = await prisma.adCampaign.findMany({
      where: { status: 'DRAFT', adCopy: null },
      take: 20,
    })

    // Batch-load all clients upfront (eliminates N+1 per-campaign lookup)
    const clientIds = [...new Set(drafts.map((d) => d.clientId).filter(Boolean))] as string[]
    const clients = clientIds.length > 0
      ? await prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, companyName: true } })
      : []
    const clientMap = new Map(clients.map((c) => [c.id, c.companyName]))

    let generated = 0
    for (const campaign of drafts) {
      const clientName = campaign.clientId ? clientMap.get(campaign.clientId) : undefined

      const ai = await aiCopy({ ...campaign, clientName: clientName ?? undefined })
      const content = ai ?? templateCopy(campaign)

      const decision = await recordDecision({
        runId: run.id,
        agent: 'CONTENT_GENERATOR',
        action: 'draft_ad_copy',
        rationale: `${ai ? 'AI' : 'Template'}-generated ${campaign.platform} ${campaign.objective} copy`,
        confidence: ai ? 0.78 : 0.65,
        entityType: 'AdCampaign',
        entityId: campaign.id,
        proposedChange: content,
      })

      if (decision.status === 'AUTO_EXECUTED') {
        try {
          await prisma.adCampaign.update({
            where: { id: campaign.id },
            data: { hookAngle: content.hook, adCopy: content.copy, visualConcept: content.visual },
          })
          await markDecisionResult(decision.id, { applied: true, method: ai ? 'ai' : 'template' })
          generated++
        } catch (error: unknown) {
          await markDecisionFailed(decision.id, error)
        }
      }
    }

    await run.finish(`Generated copy for ${generated}/${drafts.length} campaigns`)
    return { runId: run.id, generated }
  } catch (error: unknown) {
    await run.fail(error)
    throw error
  }
}

export const contentGeneratorFn = inngest.createFunction(
  {
    id: 'content-generator',
    name: 'Content Generator — draft ad copy',
    triggers: [
      { cron: '0 9 * * *' },
      { event: 'content-generator/brief.ready' },
    ],
  },
  async ({ event, step }) => {
    const triggerKind: 'cron' | 'event' = event.name === 'content-generator/brief.ready' ? 'event' : 'cron'
    return step.run('run-content-generator', () =>
      runContentGenerator({ triggerKind, triggerRef: event.id ?? event.name }),
    )
  },
)
