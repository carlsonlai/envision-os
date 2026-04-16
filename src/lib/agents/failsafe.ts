/**
 * Failsafe primitives for the autonomous agent layer.
 *
 * Three mechanisms:
 *  1. Rate cap — limits actions per agent per rolling window
 *  2. Value cap — prevents single high-value actions without review (in guardrails.ts)
 *  3. Anomaly detection — flags sudden spikes in decision volume
 *
 * Every tripped failsafe writes a FailsafeIncident row and optionally pauses the agent.
 */

import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import type { AgentKind, FailsafeSeverity } from '@prisma/client'

// ─── Defaults ───────────────────────────────────────────────────────────────

/** Max decisions an agent may record per rolling hour before rate-cap fires */
const DEFAULT_RATE_CAP_PER_HOUR = 60

/** If an agent produces >3× its average hourly decisions, flag anomaly */
const ANOMALY_MULTIPLIER = 3

// ─── Types ──────────────────────────────────────────────────────────────────

interface RateCapResult {
  allowed: boolean
  count: number
  cap: number
}

interface FailsafeCheck {
  passed: boolean
  incidents: string[]   // ids of any incidents created
}

// ─── Rate cap ───────────────────────────────────────────────────────────────

/**
 * Count decisions this agent made in the last `windowMinutes` and compare
 * against the configured (or default) rate cap.
 */
export async function checkRateCap(
  agent: AgentKind,
  windowMinutes = 60,
): Promise<RateCapResult> {
  const since = new Date(Date.now() - windowMinutes * 60_000)

  const [count, cfg] = await Promise.all([
    prisma.agentDecision.count({ where: { agent, createdAt: { gte: since } } }),
    prisma.agentConfig.findUnique({ where: { agent } }),
  ])
  const cap = cfg?.rateCapPerHour ?? DEFAULT_RATE_CAP_PER_HOUR

  return { allowed: count < cap, count, cap }
}

// ─── Anomaly detection ──────────────────────────────────────────────────────

/**
 * Compare recent decision rate to the 7-day average.
 * Returns true if the recent rate is anomalously high.
 */
export async function detectAnomaly(agent: AgentKind): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60_000)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000)

  const [recentCount, weekCount] = await Promise.all([
    prisma.agentDecision.count({ where: { agent, createdAt: { gte: oneHourAgo } } }),
    prisma.agentDecision.count({ where: { agent, createdAt: { gte: sevenDaysAgo } } }),
  ])

  // Average hourly rate over the past 7 days
  const avgPerHour = weekCount / (7 * 24)

  // If we have too little history, skip anomaly detection
  if (avgPerHour < 1) return false

  return recentCount > avgPerHour * ANOMALY_MULTIPLIER
}

// ─── Record incident ────────────────────────────────────────────────────────

export async function recordIncident(params: {
  agent: AgentKind
  severity: FailsafeSeverity
  rule: string
  description: string
  triggerValue?: string
  thresholdValue?: string
  agentRunId?: string
  decisionId?: string
  autoPause?: boolean
}): Promise<string> {
  const incident = await prisma.failsafeIncident.create({
    data: {
      agent: params.agent,
      severity: params.severity,
      rule: params.rule,
      description: params.description,
      triggerValue: params.triggerValue ?? null,
      thresholdValue: params.thresholdValue ?? null,
      agentRunId: params.agentRunId ?? null,
      decisionId: params.decisionId ?? null,
    },
  })

  logger.warn('failsafe.incident', {
    id: incident.id,
    agent: params.agent,
    rule: params.rule,
    severity: params.severity,
  })

  // Optionally auto-pause the agent on HIGH/CRITICAL incidents
  if (params.autoPause && (params.severity === 'HIGH' || params.severity === 'CRITICAL')) {
    await prisma.agentConfig.upsert({
      where: { agent: params.agent },
      update: { enabled: false, pausedReason: `Auto-paused: ${params.rule} — ${params.description}` },
      create: {
        agent: params.agent,
        enabled: false,
        autonomyEnabled: true,
        confidenceThreshold: 0.75,
        pausedReason: `Auto-paused: ${params.rule} — ${params.description}`,
      },
    })

    logger.warn('failsafe.agent_paused', { agent: params.agent, incidentId: incident.id })
  }

  return incident.id
}

// ─── Combined pre-run check ─────────────────────────────────────────────────

/**
 * Run all failsafe checks before an agent processes work.
 * Returns `passed: true` if the agent may proceed, `passed: false` if it should skip.
 */
export async function runFailsafeChecks(
  agent: AgentKind,
  runId?: string,
): Promise<FailsafeCheck> {
  const incidents: string[] = []

  // 1. Rate cap
  const rate = await checkRateCap(agent)
  if (!rate.allowed) {
    const id = await recordIncident({
      agent,
      severity: 'HIGH',
      rule: 'rate_cap',
      description: `Agent exceeded ${rate.cap} decisions/hr (current: ${rate.count})`,
      triggerValue: String(rate.count),
      thresholdValue: String(rate.cap),
      agentRunId: runId,
      autoPause: true,
    })
    incidents.push(id)
    return { passed: false, incidents }
  }

  // 2. Anomaly detection
  const anomaly = await detectAnomaly(agent)
  if (anomaly) {
    const id = await recordIncident({
      agent,
      severity: 'MEDIUM',
      rule: 'anomaly',
      description: `Decision volume is ${ANOMALY_MULTIPLIER}× above 7-day average`,
      agentRunId: runId,
      autoPause: false, // flag but don't pause on anomaly — let ops decide
    })
    incidents.push(id)
    // Anomaly is a warning, not a block — agent continues
  }

  return { passed: true, incidents }
}

// ─── Resolve incident ───────────────────────────────────────────────────────

export async function resolveIncident(
  incidentId: string,
  userId: string,
  note?: string,
): Promise<void> {
  await prisma.failsafeIncident.update({
    where: { id: incidentId },
    data: {
      resolvedAt: new Date(),
      resolvedBy: userId,
      resolvedNote: note ?? null,
    },
  })
}
