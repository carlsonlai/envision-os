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
    const configs = await prisma.agentConfig.findMany()
    const configByAgent = new Map(configs.map((c) => [c.agent, c]))

    const agents = await Promise.all(
      ALL_AGENTS.map(async (agent) => {
        const cfg = configByAgent.get(agent) ?? null
        const [lastRun, pendingCount, recentRuns] = await Promise.all([
          prisma.agentRun.findFirst({ where: { agent }, orderBy: { startedAt: 'desc' } }),
          prisma.agentDecision.count({ where: { agent, status: 'PENDING_APPROVAL' } }),
          prisma.agentRun.findMany({ where: { agent }, orderBy: { startedAt: 'desc' }, take: 5 }),
        ])
        return {
          agent,
          implemented: true,
          config: cfg,
          lastRun,
          pendingCount,
          recentRuns,
        }
      }),
    )

    const recentDecisions = await prisma.agentDecision.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({ agents, recentDecisions })
  } catch (error: unknown) {
    logger.error('agents.list.failed', { error: getErrorMessage(error) })
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
