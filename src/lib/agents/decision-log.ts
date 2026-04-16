import { prisma } from '@/lib/db'
import type {
  AgentKind,
  AgentDecisionStatus,
  Prisma,
} from '@prisma/client'
import { logger } from '@/lib/logger'
import { evaluateGuardrails } from './guardrails'

export interface RecordDecisionInput {
  runId?: string
  agent: AgentKind
  action: string
  rationale: string
  confidence: number
  entityType?: string
  entityId?: string
  inputSnapshot?: Prisma.InputJsonValue
  proposedChange?: Prisma.InputJsonValue
  valueCents?: number
}

export interface DecisionResult {
  id: string
  status: AgentDecisionStatus
  requiresReview: boolean
  reason?: string
}

/**
 * Record an agent decision, applying guardrails.
 *
 * Callers should:
 *   1. Build the proposed change.
 *   2. Call recordDecision(...) → returns status.
 *   3. If status === AUTO_EXECUTED, execute the change, then markDecisionResult().
 *   4. If status === PENDING_APPROVAL, stop and wait for human review.
 */
export async function recordDecision(input: RecordDecisionInput): Promise<DecisionResult> {
  const guard = await evaluateGuardrails({
    agent: input.agent,
    confidence: input.confidence,
    valueCents: input.valueCents,
  })

  let status: AgentDecisionStatus
  let reason: string | undefined
  let requiresReview = false

  if (!guard.allow) {
    status = 'SKIPPED'
    reason = guard.reason
  } else if (guard.requiresReview) {
    status = 'PENDING_APPROVAL'
    requiresReview = true
    reason = guard.reason
  } else {
    status = 'AUTO_EXECUTED'
  }

  const decision = await prisma.agentDecision.create({
    data: {
      runId: input.runId,
      agent: input.agent,
      status,
      action: input.action,
      rationale: input.rationale,
      confidence: input.confidence,
      entityType: input.entityType,
      entityId: input.entityId,
      inputSnapshot: input.inputSnapshot,
      proposedChange: input.proposedChange,
      valueCents: input.valueCents,
      requiresReview,
      reviewNote: reason,
    },
  })

  logger.info('agent.decision', {
    agent: input.agent,
    action: input.action,
    status,
    confidence: input.confidence,
    decisionId: decision.id,
  })

  return { id: decision.id, status, requiresReview, reason }
}

/** Attach execution outcome to a decision (usually success / side-effects). */
export async function markDecisionResult(
  decisionId: string,
  result: Prisma.InputJsonValue,
  opts?: { status?: AgentDecisionStatus },
): Promise<void> {
  await prisma.agentDecision.update({
    where: { id: decisionId },
    data: {
      result,
      ...(opts?.status ? { status: opts.status } : {}),
    },
  })
}

/** Mark a decision as FAILED with an error message. */
export async function markDecisionFailed(decisionId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  await prisma.agentDecision.update({
    where: { id: decisionId },
    data: {
      status: 'FAILED',
      result: { error: message },
    },
  })
}
