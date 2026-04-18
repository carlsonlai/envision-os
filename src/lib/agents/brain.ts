/**
 * AI Brain — Envicion OS central intelligence.
 *
 * Role: CEO + COO. Converts `Target` rows into prioritized `AgentDecision`
 * rows that downstream execution agents (Sales, Traffic, Delivery, etc.)
 * and the Boss act on.
 *
 * v1 is rule-based — deterministic, cheap, auditable. It reads:
 *   - active Targets (metric = REVENUE | LEADS | MARGIN)
 *   - current pipeline state (projects, leads)
 *   - recent activity (AgentRun history, delivery throughput)
 *
 * And emits AgentDecision rows under AgentKind = PM_AI. An LLM layer can
 * wrap this later; the contract (inputs → decisions) stays the same.
 *
 * Not persisted here: raw metrics (those live in KPIRecord). The Brain only
 * writes decisions + audit trail via AgentRun.
 */

import { prisma } from '@/lib/db'
import { startRun } from './run'
import { logger, getErrorMessage } from '@/lib/logger'

// ----- Types -----

export type BrainDecisionKind =
  | 'ACCELERATE_SALES'
  | 'ACCELERATE_LEAD_GEN'
  | 'REVIEW_STALLED_PROJECTS'
  | 'INCREASE_CAPACITY'
  | 'ALERT_BOSS_REVENUE_GAP_CRITICAL'
  | 'ALERT_BOSS_MARGIN_EROSION'
  | 'REDUCE_REVISION_BURN'
  | 'RETENTION_OUTREACH'

export interface BrainDecision {
  kind: BrainDecisionKind
  confidence: number
  rationale: string
  entityType?: 'Target' | 'Project' | 'Client' | 'Lead' | 'User'
  entityId?: string
  valueCents?: number
  proposedChange: Record<string, unknown>
  requiresReview: boolean
}

export interface BrainRunResult {
  runId: string
  decisions: BrainDecision[]
  skipped: boolean
  summary: string
}

interface PipelineSnapshot {
  // Revenue context
  targetRevenue: number
  currentRevenue: number
  targetPeriod: string | null
  daysElapsed: number
  daysRemaining: number
  // Pipeline health
  activeProjects: number
  stalledProjects: number
  overdueUnbilled: number
  // Lead gen
  leadsThisWeek: number
  leadsLastWeek: number
  // Delivery capacity
  designersAtCapacity: number
  totalDesigners: number
  // Revisions
  projectsOverRevisionLimit: number
}

// ----- Snapshot collector -----

async function collectPipelineSnapshot(): Promise<PipelineSnapshot> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  const daysInMonth = monthEnd.getDate()
  const daysElapsed = Math.max(1, now.getDate())
  const daysRemaining = Math.max(0, daysInMonth - daysElapsed)

  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

  // Revenue target — convention is lowercase ('revenue' / 'month') per /api/targets + kpi.ts.
  // We accept either case to be defensive against legacy rows.
  const revenueTarget = await prisma.target.findFirst({
    where: {
      metric: { in: ['revenue', 'REVENUE'] },
      period: { in: ['month', 'MONTH', new Date().toISOString().slice(0, 7)] },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Current revenue = sum of paidAmount this month
  const paidThisMonth = await prisma.project.aggregate({
    _sum: { paidAmount: true },
    where: { updatedAt: { gte: monthStart } },
  })

  const [activeProjects, stalledProjects, overdueUnbilled] = await Promise.all([
    prisma.project.count({ where: { status: 'ONGOING' } }),
    prisma.project.count({
      where: {
        status: 'ONGOING',
        updatedAt: { lt: threeDaysAgo },
      },
    }),
    prisma.project.count({
      where: {
        status: 'COMPLETED',
        billedAmount: 0,
        deadline: { lt: now },
      },
    }),
  ])

  const [leadsThisWeek, leadsLastWeek] = await Promise.all([
    prisma.lead.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.lead.count({
      where: { createdAt: { gte: twoWeeksAgo, lt: weekAgo } },
    }),
  ])

  // Designer utilisation — count active designers with any in-progress item
  const designerRoles = [
    'CREATIVE_DIRECTOR',
    'SENIOR_ART_DIRECTOR',
    'JUNIOR_ART_DIRECTOR',
    'GRAPHIC_DESIGNER',
    'JUNIOR_DESIGNER',
    'DESIGNER_3D',
    'MULTIMEDIA_DESIGNER',
  ] as const

  const totalDesigners = await prisma.user.count({
    where: { role: { in: designerRoles as unknown as string[] } as never },
  })

  // "At capacity" = has >=3 in-progress items OR >=1 WIP_UPLOADED awaiting
  const busyDesigners = await prisma.user.findMany({
    where: { role: { in: designerRoles as unknown as string[] } as never },
    select: {
      id: true,
      _count: {
        select: {
          assignedDeliverables: {
            where: { status: { in: ['IN_PROGRESS', 'WIP_UPLOADED'] } },
          },
        },
      },
    },
  })
  const designersAtCapacity = busyDesigners.filter(
    (d) => d._count.assignedDeliverables >= 3
  ).length

  // Revision burn — projects with any deliverable at/over revision limit
  const overRevision = await prisma.project.count({
    where: {
      deliverableItems: {
        some: {
          revisionCount: { gte: prisma.deliverableItem.fields.revisionLimit },
        },
      },
    },
  })

  return {
    targetRevenue: revenueTarget?.targetValue ?? 0,
    currentRevenue: paidThisMonth._sum.paidAmount ?? 0,
    targetPeriod: revenueTarget?.period ?? null,
    daysElapsed,
    daysRemaining,
    activeProjects,
    stalledProjects,
    overdueUnbilled,
    leadsThisWeek,
    leadsLastWeek,
    designersAtCapacity,
    totalDesigners,
    projectsOverRevisionLimit: overRevision,
  }
}

// ----- Decision rules -----

function deriveDecisions(snap: PipelineSnapshot): BrainDecision[] {
  const decisions: BrainDecision[] = []

  // 1. REVENUE GAP
  if (snap.targetRevenue > 0) {
    const gap = snap.targetRevenue - snap.currentRevenue
    const pctClosed =
      snap.targetRevenue > 0 ? snap.currentRevenue / snap.targetRevenue : 0
    const pctElapsed = snap.daysElapsed / (snap.daysElapsed + snap.daysRemaining)

    if (pctClosed < pctElapsed - 0.15 && gap > 0) {
      const severity = pctClosed < pctElapsed - 0.3 ? 'CRITICAL' : 'WARNING'
      decisions.push({
        kind:
          severity === 'CRITICAL'
            ? 'ALERT_BOSS_REVENUE_GAP_CRITICAL'
            : 'ACCELERATE_SALES',
        confidence: severity === 'CRITICAL' ? 0.95 : 0.8,
        rationale: `Revenue pace ${(pctClosed * 100).toFixed(0)}% vs month elapsed ${(pctElapsed * 100).toFixed(0)}%. Gap RM ${gap.toLocaleString('en-MY')} across ${snap.daysRemaining} days remaining.`,
        entityType: 'Target',
        valueCents: Math.round(gap * 100),
        proposedChange: {
          recommendation:
            severity === 'CRITICAL'
              ? 'Boss review required — target unlikely to hit. Options: reduce target, increase ad spend, enable pricing floor raise.'
              : 'Trigger Sales Agent to increase outbound cadence by 30% and Traffic Agent to raise daily ad spend by 20%.',
          gapAmount: gap,
          daysRemaining: snap.daysRemaining,
        },
        requiresReview: severity === 'CRITICAL',
      })
    }
  }

  // 2. LEAD GEN DROP
  if (snap.leadsLastWeek >= 5) {
    const drop = (snap.leadsLastWeek - snap.leadsThisWeek) / snap.leadsLastWeek
    if (drop > 0.3) {
      decisions.push({
        kind: 'ACCELERATE_LEAD_GEN',
        confidence: 0.85,
        rationale: `Lead gen dropped ${(drop * 100).toFixed(0)}% week-over-week (${snap.leadsThisWeek} vs ${snap.leadsLastWeek}). Traffic Agent should investigate creative fatigue + reallocate budget.`,
        proposedChange: {
          recommendation:
            'Rotate ad creatives, test new audiences, raise budget on best-performing campaign by 25%.',
          leadsThisWeek: snap.leadsThisWeek,
          leadsLastWeek: snap.leadsLastWeek,
        },
        requiresReview: false,
      })
    }
  }

  // 3. STALLED PROJECTS
  if (snap.stalledProjects >= 3) {
    decisions.push({
      kind: 'REVIEW_STALLED_PROJECTS',
      confidence: 0.9,
      rationale: `${snap.stalledProjects} active projects have had no updates in 3+ days. Delivery Agent should reassign or escalate.`,
      proposedChange: {
        recommendation:
          'Run stalled-project sweep. Reassign items where designer is at capacity, escalate to CS where brief is unclear.',
        stalledCount: snap.stalledProjects,
      },
      requiresReview: false,
    })
  }

  // 4. OVERDUE + UNBILLED (margin leak)
  if (snap.overdueUnbilled > 0) {
    decisions.push({
      kind: 'ALERT_BOSS_MARGIN_EROSION',
      confidence: 0.9,
      rationale: `${snap.overdueUnbilled} completed projects are past deadline with zero billing. Payment Agent should issue invoices now.`,
      proposedChange: {
        recommendation:
          'Trigger Payment Agent to auto-generate invoices for all overdue + unbilled projects.',
        overdueUnbilled: snap.overdueUnbilled,
      },
      requiresReview: false,
    })
  }

  // 5. CAPACITY CRUNCH
  if (
    snap.totalDesigners > 0 &&
    snap.designersAtCapacity / snap.totalDesigners >= 0.7
  ) {
    decisions.push({
      kind: 'INCREASE_CAPACITY',
      confidence: 0.8,
      rationale: `${snap.designersAtCapacity}/${snap.totalDesigners} designers at capacity (≥70%). Freelancer overflow recommended.`,
      proposedChange: {
        recommendation:
          'Activate Freelancer pool for next 2 weeks. Pause new sales outreach until utilisation <60%.',
        atCapacity: snap.designersAtCapacity,
        total: snap.totalDesigners,
      },
      requiresReview: true,
    })
  }

  // 6. REVISION BURN
  if (snap.projectsOverRevisionLimit >= 2) {
    decisions.push({
      kind: 'REDUCE_REVISION_BURN',
      confidence: 0.85,
      rationale: `${snap.projectsOverRevisionLimit} projects have deliverables at or past revision limit — unpaid rework eroding margin.`,
      proposedChange: {
        recommendation:
          'CS to issue change-order quotes for projects over revision limit. Limit further revisions until approved.',
        offendingProjects: snap.projectsOverRevisionLimit,
      },
      requiresReview: false,
    })
  }

  return decisions
}

// ----- Persist decisions -----

async function persistDecisions(
  runId: string,
  decisions: readonly BrainDecision[]
): Promise<void> {
  if (decisions.length === 0) return
  await prisma.agentDecision.createMany({
    data: decisions.map((d) => ({
      runId,
      agent: 'PM_AI' as const,
      status: d.requiresReview ? 'PENDING_APPROVAL' : 'AUTO_EXECUTED',
      confidence: d.confidence,
      action: d.kind,
      rationale: d.rationale,
      entityType: d.entityType ?? null,
      entityId: d.entityId ?? null,
      valueCents: d.valueCents ?? null,
      proposedChange: d.proposedChange as never,
      requiresReview: d.requiresReview,
    })),
  })
}

// ----- Public entrypoint -----

export async function runBrain(options?: {
  triggerKind?: 'cron' | 'event' | 'manual'
  triggerRef?: string
}): Promise<BrainRunResult> {
  const handle = await startRun({
    agent: 'PM_AI',
    triggerKind: options?.triggerKind ?? 'manual',
    triggerRef: options?.triggerRef,
  })

  if (handle.skipped) {
    return {
      runId: handle.id,
      decisions: [],
      skipped: true,
      summary: 'Brain run skipped by failsafe',
    }
  }

  try {
    const snap = await collectPipelineSnapshot()
    const decisions = deriveDecisions(snap)
    await persistDecisions(handle.id, decisions)

    const summary =
      decisions.length === 0
        ? 'No decisions — all targets on pace.'
        : `${decisions.length} decision${decisions.length === 1 ? '' : 's'}: ${decisions.map((d) => d.kind).join(', ')}`

    await handle.finish(summary)
    logger.info('brain.run.ok', {
      runId: handle.id,
      decisionCount: decisions.length,
    })

    return { runId: handle.id, decisions, skipped: false, summary }
  } catch (err) {
    await handle.fail(err)
    logger.error('brain.run.failed', { error: getErrorMessage(err) })
    throw err
  }
}
