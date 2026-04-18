/**
 * Profit Optimization Engine — Envicion OS margin guardian.
 *
 * Role: Continuously scores every active project for margin health, updates
 * the `Project.profitability` field, and emits `AgentDecision` rows when it
 * detects a margin leak (revision burn, scope overrun, overdue unbilled, or
 * below-floor margins).
 *
 * Pairs with brain.ts: Brain sees portfolio-level revenue gaps, this engine
 * sees per-project leaks. Both surface through `/admin/brain`.
 *
 * v1 is rule-based. Costs use a flat hourly rate (80 RM/hr) for designer
 * time — aligned with kpi.ts/getProjectProfitability. When Bukku cost imports
 * land, swap the cost model here without changing the leak rules.
 */

import { prisma } from '@/lib/db'
import { startRun } from './run'
import { logger, getErrorMessage } from '@/lib/logger'

// ----- Types -----

export type ProfitLeakKind =
  | 'REVISION_OVERRUN'
  | 'SCOPE_OVERRUN'
  | 'OVERDUE_UNBILLED'
  | 'BELOW_MARGIN_FLOOR'
  | 'CLIENT_MARGIN_EROSION'

export interface ProfitLeak {
  kind: ProfitLeakKind
  projectId?: string
  projectCode?: string
  clientId?: string
  clientName?: string
  confidence: number
  rationale: string
  proposedAction: ProfitLeakAction
  severityCents: number
  requiresReview: boolean
}

export type ProfitLeakAction =
  | 'ISSUE_CHANGE_ORDER'
  | 'REASSIGN_DESIGNER'
  | 'EXTEND_TIMELINE'
  | 'ALERT_BOSS_MARGIN_LEAK'
  | 'TRIGGER_INVOICE_NOW'
  | 'SUGGEST_PRICING_INCREASE'
  | 'THROTTLE_CLIENT_REQUESTS'

export interface ProjectProfit {
  projectId: string
  projectCode: string
  clientId: string | null
  revenue: number        // RM (paid + billed)
  cost: number           // RM (designer time × hourly)
  profit: number         // revenue - cost
  margin: number         // profit / revenue, 0..1
  actualMinutes: number
  estimatedMinutes: number
  revisionSum: number
  revisionLimitSum: number
  overdueUnbilled: boolean
}

export interface ClientProfit {
  clientId: string
  clientName: string
  projectCount: number
  revenue: number
  cost: number
  profit: number
  margin: number
}

export interface ProfitSweepResult {
  runId: string
  skipped: boolean
  summary: string
  projects: ProjectProfit[]
  clients: ClientProfit[]
  leaks: ProfitLeak[]
}

// ----- Tunables -----

const HOURLY_RATE_RM = 80                 // aligned with kpi.ts
const MARGIN_FLOOR = 0.2                  // 20%
const CLIENT_MARGIN_FLOOR = 0.25          // 25% across a client's portfolio
const SCOPE_OVERRUN_THRESHOLD = 1.3       // actual > 130% of estimated
const MIN_CLIENT_REVENUE_FOR_EROSION = 3000  // only flag erosion once client has RM 3k+ booked

// ----- Pure computation -----

function computeProjectProfitRow(p: {
  id: string
  code: string
  clientId: string | null
  paidAmount: number
  billedAmount: number
  quotedAmount: number
  status: string
  deadline: Date | null
  deliverableItems: ReadonlyArray<{
    actualMinutes: number | null
    estimatedMinutes: number | null
    revisionCount: number
    revisionLimit: number
  }>
}): ProjectProfit {
  const revenue = p.paidAmount + p.billedAmount  // recognized revenue
  const actualMinutes = p.deliverableItems.reduce(
    (s, i) => s + (i.actualMinutes ?? 0),
    0
  )
  const estimatedMinutes = p.deliverableItems.reduce(
    (s, i) => s + (i.estimatedMinutes ?? 0),
    0
  )
  const revisionSum = p.deliverableItems.reduce(
    (s, i) => s + i.revisionCount,
    0
  )
  const revisionLimitSum = p.deliverableItems.reduce(
    (s, i) => s + i.revisionLimit,
    0
  )

  const cost = (actualMinutes / 60) * HOURLY_RATE_RM
  const profit = revenue - cost
  const margin = revenue > 0 ? profit / revenue : 0

  const overdueUnbilled =
    p.status === 'COMPLETED' &&
    p.billedAmount === 0 &&
    p.deadline !== null &&
    p.deadline.getTime() < Date.now()

  return {
    projectId: p.id,
    projectCode: p.code,
    clientId: p.clientId,
    revenue: Math.round(revenue),
    cost: Math.round(cost),
    profit: Math.round(profit),
    margin: Math.round(margin * 100) / 100,
    actualMinutes,
    estimatedMinutes,
    revisionSum,
    revisionLimitSum,
    overdueUnbilled,
  }
}

function aggregateClientProfit(
  rows: readonly ProjectProfit[],
  clientIndex: ReadonlyMap<string, string>
): ClientProfit[] {
  const byClient = new Map<string, ProjectProfit[]>()
  for (const row of rows) {
    if (!row.clientId) continue
    const bucket = byClient.get(row.clientId) ?? []
    bucket.push(row)
    byClient.set(row.clientId, bucket)
  }

  const out: ClientProfit[] = []
  for (const [clientId, projects] of byClient.entries()) {
    const revenue = projects.reduce((s, p) => s + p.revenue, 0)
    const cost = projects.reduce((s, p) => s + p.cost, 0)
    const profit = revenue - cost
    out.push({
      clientId,
      clientName: clientIndex.get(clientId) ?? 'Unknown',
      projectCount: projects.length,
      revenue,
      cost,
      profit,
      margin: revenue > 0 ? Math.round((profit / revenue) * 100) / 100 : 0,
    })
  }
  return out.sort((a, b) => a.margin - b.margin)  // worst first
}

function detectLeaks(
  projects: readonly ProjectProfit[],
  clients: readonly ClientProfit[]
): ProfitLeak[] {
  const leaks: ProfitLeak[] = []

  for (const p of projects) {
    // 1. Revision overrun — at or past limit
    if (p.revisionLimitSum > 0 && p.revisionSum >= p.revisionLimitSum) {
      leaks.push({
        kind: 'REVISION_OVERRUN',
        projectId: p.projectId,
        projectCode: p.projectCode,
        clientId: p.clientId ?? undefined,
        confidence: 0.9,
        rationale: `Project ${p.projectCode} has ${p.revisionSum} revisions vs ${p.revisionLimitSum} limit. Further rework should be a paid change order.`,
        proposedAction: 'ISSUE_CHANGE_ORDER',
        severityCents: Math.max(
          10000,
          Math.round(p.revenue * 0.15 * 100)  // assume next round costs ~15%
        ),
        requiresReview: false,
      })
    }

    // 2. Scope overrun — actual minutes significantly past estimate
    if (
      p.estimatedMinutes > 0 &&
      p.actualMinutes > p.estimatedMinutes * SCOPE_OVERRUN_THRESHOLD
    ) {
      leaks.push({
        kind: 'SCOPE_OVERRUN',
        projectId: p.projectId,
        projectCode: p.projectCode,
        clientId: p.clientId ?? undefined,
        confidence: 0.85,
        rationale: `Project ${p.projectCode} burning ${p.actualMinutes}m vs ${p.estimatedMinutes}m estimate (${Math.round((p.actualMinutes / p.estimatedMinutes) * 100)}%). Likely understaffed or scope crept.`,
        proposedAction: 'REASSIGN_DESIGNER',
        severityCents: Math.round(
          ((p.actualMinutes - p.estimatedMinutes) / 60) * HOURLY_RATE_RM * 100
        ),
        requiresReview: false,
      })
    }

    // 3. Overdue + unbilled — cash leak
    if (p.overdueUnbilled) {
      leaks.push({
        kind: 'OVERDUE_UNBILLED',
        projectId: p.projectId,
        projectCode: p.projectCode,
        clientId: p.clientId ?? undefined,
        confidence: 0.95,
        rationale: `Project ${p.projectCode} is COMPLETED past deadline with zero billing. Payment Agent should issue invoice immediately.`,
        proposedAction: 'TRIGGER_INVOICE_NOW',
        severityCents: Math.max(
          5000,
          Math.round((p.revenue > 0 ? p.revenue : 0) * 100)
        ),
        requiresReview: false,
      })
    }

    // 4. Below margin floor
    if (p.revenue > 0 && p.margin < MARGIN_FLOOR) {
      leaks.push({
        kind: 'BELOW_MARGIN_FLOOR',
        projectId: p.projectId,
        projectCode: p.projectCode,
        clientId: p.clientId ?? undefined,
        confidence: 0.8,
        rationale: `Project ${p.projectCode} margin ${Math.round(p.margin * 100)}% < ${Math.round(MARGIN_FLOOR * 100)}% floor. RM ${p.revenue} revenue, RM ${p.cost} cost.`,
        proposedAction:
          p.margin < 0 ? 'ALERT_BOSS_MARGIN_LEAK' : 'EXTEND_TIMELINE',
        severityCents: Math.max(
          0,
          Math.round((p.revenue * MARGIN_FLOOR - p.profit) * 100)
        ),
        requiresReview: p.margin < 0,
      })
    }
  }

  // 5. Client margin erosion — chronic under-priced account
  for (const c of clients) {
    if (
      c.revenue >= MIN_CLIENT_REVENUE_FOR_EROSION &&
      c.margin < CLIENT_MARGIN_FLOOR
    ) {
      leaks.push({
        kind: 'CLIENT_MARGIN_EROSION',
        clientId: c.clientId,
        clientName: c.clientName,
        confidence: 0.85,
        rationale: `${c.clientName} portfolio margin ${Math.round(c.margin * 100)}% < ${Math.round(CLIENT_MARGIN_FLOOR * 100)}% floor across ${c.projectCount} project${c.projectCount === 1 ? '' : 's'}. Consider repricing or throttling.`,
        proposedAction:
          c.margin < 0.1
            ? 'SUGGEST_PRICING_INCREASE'
            : 'THROTTLE_CLIENT_REQUESTS',
        severityCents: Math.max(
          0,
          Math.round((c.revenue * CLIENT_MARGIN_FLOOR - c.profit) * 100)
        ),
        requiresReview: true,
      })
    }
  }

  return leaks
}

// ----- Persistence -----

async function persistProjectMargins(rows: readonly ProjectProfit[]): Promise<void> {
  // Prisma doesn't support bulk updateMany-with-different-values, so batch serially.
  // Volume is O(active projects) — tens, not thousands.
  for (const row of rows) {
    await prisma.project.update({
      where: { id: row.projectId },
      data: { profitability: row.margin },
    })
  }
}

async function persistLeakDecisions(
  runId: string,
  leaks: readonly ProfitLeak[]
): Promise<void> {
  if (leaks.length === 0) return
  await prisma.agentDecision.createMany({
    data: leaks.map((l) => ({
      runId,
      agent: 'PM_AI' as const,
      status: l.requiresReview ? 'PENDING_APPROVAL' : 'AUTO_EXECUTED',
      confidence: l.confidence,
      action: l.proposedAction,
      rationale: l.rationale,
      entityType: l.projectId ? 'Project' : l.clientId ? 'Client' : null,
      entityId: l.projectId ?? l.clientId ?? null,
      valueCents: l.severityCents,
      proposedChange: {
        leakKind: l.kind,
        projectCode: l.projectCode ?? null,
        clientName: l.clientName ?? null,
      } as never,
      requiresReview: l.requiresReview,
    })),
  })
}

// ----- Public entrypoints -----

export async function computeProjectProfitabilities(): Promise<ProjectProfit[]> {
  const projects = await prisma.project.findMany({
    where: {
      status: { in: ['ONGOING', 'COMPLETED', 'BILLED', 'PAID'] },
    },
    select: {
      id: true,
      code: true,
      clientId: true,
      paidAmount: true,
      billedAmount: true,
      quotedAmount: true,
      status: true,
      deadline: true,
      deliverableItems: {
        select: {
          actualMinutes: true,
          estimatedMinutes: true,
          revisionCount: true,
          revisionLimit: true,
        },
      },
    },
  })

  return projects.map(computeProjectProfitRow)
}

export async function computeClientProfitabilities(
  projectRows: readonly ProjectProfit[]
): Promise<ClientProfit[]> {
  const clientIds = Array.from(
    new Set(projectRows.map((r) => r.clientId).filter((id): id is string => !!id))
  )
  if (clientIds.length === 0) return []

  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds } },
    select: { id: true, companyName: true },
  })
  const index = new Map(clients.map((c) => [c.id, c.companyName]))
  return aggregateClientProfit(projectRows, index)
}

/**
 * End-to-end profit sweep. Runs under AgentRun for audit.
 */
export async function runProfitSweep(options?: {
  triggerKind?: 'cron' | 'event' | 'manual'
  triggerRef?: string
}): Promise<ProfitSweepResult> {
  const handle = await startRun({
    agent: 'PM_AI',
    triggerKind: options?.triggerKind ?? 'manual',
    triggerRef: options?.triggerRef,
  })

  if (handle.skipped) {
    return {
      runId: handle.id,
      skipped: true,
      summary: 'Profit sweep skipped by failsafe',
      projects: [],
      clients: [],
      leaks: [],
    }
  }

  try {
    const projects = await computeProjectProfitabilities()
    const clients = await computeClientProfitabilities(projects)
    const leaks = detectLeaks(projects, clients)

    await persistProjectMargins(projects)
    await persistLeakDecisions(handle.id, leaks)

    const summary =
      leaks.length === 0
        ? `${projects.length} projects scanned, no leaks.`
        : `${projects.length} projects, ${leaks.length} leak${leaks.length === 1 ? '' : 's'}: ${leaks
            .slice(0, 4)
            .map((l) => l.kind)
            .join(', ')}${leaks.length > 4 ? '…' : ''}`

    await handle.finish(summary)
    logger.info('profit.sweep.ok', {
      runId: handle.id,
      projectCount: projects.length,
      leakCount: leaks.length,
    })

    return {
      runId: handle.id,
      skipped: false,
      summary,
      projects,
      clients,
      leaks,
    }
  } catch (err) {
    await handle.fail(err)
    logger.error('profit.sweep.failed', { error: getErrorMessage(err) })
    throw err
  }
}
