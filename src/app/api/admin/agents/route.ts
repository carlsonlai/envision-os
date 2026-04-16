/**
 * GET  /api/admin/agents            — list all agents, config, and recent activity
 * PATCH /api/admin/agents/[agent]   — update config (enabled, autonomy, threshold, cap)
 *
 * ADMIN only.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import type { AgentKind } from '@prisma/client'
import { getErrorMessage, logger } from '@/lib/logger'

const ALL_AGENTS: AgentKind[] = [
  'DEMAND_INTEL',
  'CONTENT_GENERATOR',
  'DISTRIBUTION_ENGINE',
  'PERFORMANCE_OPTIMIZER',
  'LEAD_ENGINE',
  'SALES_AGENT',
  'PAYMENT_AGENT',
  'ONBOARDING_AGENT',
  'PM_AI',
  'QA_AGENT',
  'DELIVERY_AGENT',
  'REVENUE_EXPANSION',
]

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    // ── Batch-load everything in 4 parallel queries instead of 40 sequential ──
    const [configs, allRuns, pendingCounts, recentDecisions] = await Promise.all([
      prisma.agentConfig.findMany(),
      prisma.agentRun.findMany({
        where: { agent: { in: ALL_AGENTS } },
        orderBy: { startedAt: 'desc' },
        take: 60, // 12 agents × 5 recent runs each
      }),
      prisma.agentDecision.groupBy({
        by: ['agent'],
        where: { status: 'PENDING_APPROVAL', agent: { in: ALL_AGENTS } },
        _count: { _all: true },
      }),
      prisma.agentDecision.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ])

    // Index in-memory
    const configByAgent = new Map(configs.map((c) => [c.agent, c]))
    const pendingByAgent = new Map(pendingCounts.map((c) => [c.agent, c._count._all]))

    // Group runs per agent (already sorted desc by startedAt)
    const runsByAgent = new Map<string, typeof allRuns>()
    for (const run of allRuns) {
      const arr = runsByAgent.get(run.agent) ?? []
      if (arr.length < 5) arr.push(run)
      runsByAgent.set(run.agent, arr)
    }

    const agents = ALL_AGENTS.map((agent) => ({
      agent,
      implemented: true,
      config: configByAgent.get(agent) ?? null,
      lastRun: runsByAgent.get(agent)?.[0] ?? null,
      pendingCount: pendingByAgent.get(agent) ?? 0,
      recentRuns: runsByAgent.get(agent) ?? [],
    }))

    const res = NextResponse.json({ agents, recentDecisions })
    res.headers.set('Cache-Control', 'private, max-age=5')
    return res
  } catch (error: unknown) {
    logger.error('agents.list.failed', { error: getErrorMessage(error) })
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
