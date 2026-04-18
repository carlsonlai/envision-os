/**
 * GET /api/ai/brain/state
 *
 * Read-only cockpit view for /admin/brain. Aggregates:
 *   - Active revenue target + current paid this month
 *   - Latest Brain run + its decisions
 *   - Latest Profit sweep results (computed live — cheap)
 *   - Recent AgentDecision rows across all agents (feed)
 *   - Open FailsafeIncident count
 *
 * Admin-only. Does NOT trigger runs — use /api/ai/brain/run and
 * /api/cron/profit-sweep for that.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  computeProjectProfitabilities,
  computeClientProfitabilities,
} from '@/lib/agents/profit-engine'
import { logger, getErrorMessage } from '@/lib/logger'

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  try {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    ).getDate()

    // Revenue target — accept either casing
    const revenueTarget = await prisma.target.findFirst({
      where: {
        metric: { in: ['revenue', 'REVENUE'] },
        period: { in: ['month', 'MONTH', now.toISOString().slice(0, 7)] },
      },
      orderBy: { createdAt: 'desc' },
    })

    const paidAgg = await prisma.project.aggregate({
      _sum: { paidAmount: true },
      where: { updatedAt: { gte: monthStart } },
    })
    const paidThisMonth = paidAgg._sum.paidAmount ?? 0

    // Latest Brain run (PM_AI is the brain's agent kind)
    const latestBrainRun = await prisma.agentRun.findFirst({
      where: { agent: 'PM_AI' },
      orderBy: { startedAt: 'desc' },
      include: {
        decisions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    // Recent decisions across all agents (for activity feed)
    const recentDecisions = await prisma.agentDecision.findMany({
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true,
        agent: true,
        status: true,
        action: true,
        rationale: true,
        confidence: true,
        valueCents: true,
        entityType: true,
        entityId: true,
        requiresReview: true,
        createdAt: true,
      },
    })

    // Live profitability (no persistence — read-only)
    const projects = await computeProjectProfitabilities()
    const clients = await computeClientProfitabilities(projects)

    // Open failsafe incidents
    const openIncidents = await prisma.failsafeIncident.count({
      where: { resolvedAt: null },
    })

    // Recent agent runs for ops visibility
    const recentRuns = await prisma.agentRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        agent: true,
        status: true,
        triggerKind: true,
        summary: true,
        startedAt: true,
        finishedAt: true,
        durationMs: true,
      },
    })

    return NextResponse.json({
      ok: true,
      data: {
        generatedAt: now.toISOString(),
        revenue: {
          target: revenueTarget?.targetValue ?? 0,
          paidThisMonth,
          gap: Math.max(0, (revenueTarget?.targetValue ?? 0) - paidThisMonth),
          daysElapsed: now.getDate(),
          daysInMonth,
        },
        latestBrainRun: latestBrainRun
          ? {
              id: latestBrainRun.id,
              status: latestBrainRun.status,
              summary: latestBrainRun.summary,
              startedAt: latestBrainRun.startedAt,
              finishedAt: latestBrainRun.finishedAt,
              decisions: latestBrainRun.decisions,
            }
          : null,
        profitability: {
          projects: projects.sort((a, b) => a.margin - b.margin), // worst first
          clients, // already sorted worst-first by aggregateClientProfit
        },
        recentDecisions,
        recentRuns,
        openIncidents,
      },
    })
  } catch (err) {
    logger.error('GET /api/ai/brain/state failed', {
      error: getErrorMessage(err),
    })
    return NextResponse.json(
      { error: 'Failed to load brain state', detail: getErrorMessage(err) },
      { status: 500 }
    )
  }
}
