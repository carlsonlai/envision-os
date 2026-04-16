import { prisma } from '@/lib/db'
import type { AgentKind } from '@prisma/client'

export interface GuardrailDecisionInput {
  agent: AgentKind
  confidence: number       // 0..1
  valueCents?: number      // monetary impact (null = non-financial)
}

export type GuardrailOutcome =
  | { allow: true; requiresReview: false }
  | { allow: true; requiresReview: true; reason: string }
  | { allow: false; reason: string }

/**
 * Evaluate whether an autonomous decision may be auto-executed.
 *
 *  - agent disabled         → allow: false
 *  - autonomy off           → allow: true, requiresReview: true
 *  - confidence too low     → allow: true, requiresReview: true
 *  - value cap exceeded     → allow: true, requiresReview: true
 *  - else                   → allow: true, requiresReview: false  (AUTO_EXECUTED)
 */
export async function evaluateGuardrails(
  input: GuardrailDecisionInput
): Promise<GuardrailOutcome> {
  const cfg = await prisma.agentConfig.findUnique({ where: { agent: input.agent } })

  // Missing config ⇒ treat as enabled + default threshold. This lets new agents
  // ship without a manual seeding step; ops can tune later.
  const enabled             = cfg?.enabled ?? true
  const autonomyEnabled     = cfg?.autonomyEnabled ?? true
  const confidenceThreshold = cfg?.confidenceThreshold ?? 0.75
  const valueCapCents       = cfg?.valueCapCents ?? null

  if (!enabled) {
    return { allow: false, reason: cfg?.pausedReason ?? 'Agent is disabled' }
  }

  if (!autonomyEnabled) {
    return { allow: true, requiresReview: true, reason: 'Autonomy disabled — manual approval required' }
  }

  if (input.confidence < confidenceThreshold) {
    return {
      allow: true,
      requiresReview: true,
      reason: `Confidence ${input.confidence.toFixed(2)} below threshold ${confidenceThreshold.toFixed(2)}`,
    }
  }

  if (valueCapCents !== null && input.valueCents !== undefined && input.valueCents > valueCapCents) {
    return {
      allow: true,
      requiresReview: true,
      reason: `Value ${input.valueCents}¢ exceeds cap ${valueCapCents}¢`,
    }
  }

  return { allow: true, requiresReview: false }
}

/**
 * Fetch (or create) the AgentConfig row for a given agent kind.
 * Defaults mirror the guardrail defaults above.
 */
export async function getAgentConfig(agent: AgentKind) {
  const existing = await prisma.agentConfig.findUnique({ where: { agent } })
  if (existing) return existing

  return prisma.agentConfig.create({
    data: {
      agent,
      enabled: true,
      autonomyEnabled: true,
      confidenceThreshold: 0.75,
      valueCapCents: null,
    },
  })
}
