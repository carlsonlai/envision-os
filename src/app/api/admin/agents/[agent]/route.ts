/**
 * PATCH /api/admin/agents/[agent] — update AgentConfig
 * POST  /api/admin/agents/[agent]/run — manual trigger (DEMAND_INTEL only for now)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import type { AgentKind } from '@prisma/client'
import { getErrorMessage, logger } from '@/lib/logger'

const VALID_AGENTS = new Set<AgentKind>([
  'DEMAND_INTEL', 'CONTENT_GENERATOR', 'DISTRIBUTION_ENGINE', 'PERFORMANCE_OPTIMIZER',
  'LEAD_ENGINE', 'SALES_AGENT', 'PAYMENT_AGENT', 'ONBOARDING_AGENT',
  'PM_AI', 'QA_AGENT', 'DELIVERY_AGENT', 'REVENUE_EXPANSION',
])

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  autonomyEnabled: z.boolean().optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  valueCapCents: z.number().int().min(0).nullable().optional(),
  pausedReason: z.string().max(500).nullable().optional(),
})

interface RouteContext {
  params: Promise<{ agent: string }>
}

export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { agent: agentParam } = await ctx.params
  if (!VALID_AGENTS.has(agentParam as AgentKind)) {
    return NextResponse.json({ error: 'unknown agent' }, { status: 400 })
  }
  const agent = agentParam as AgentKind

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid payload', issues: parsed.error.issues }, { status: 400 })
  }

  try {
    const cfg = await prisma.agentConfig.upsert({
      where: { agent },
      create: {
        agent,
        ...parsed.data,
        pausedAt: parsed.data.enabled === false ? new Date() : null,
        pausedByUserId: parsed.data.enabled === false ? session.user.id : null,
      },
      update: {
        ...parsed.data,
        pausedAt: parsed.data.enabled === false ? new Date() : (parsed.data.enabled === true ? null : undefined),
        pausedByUserId: parsed.data.enabled === false ? session.user.id : (parsed.data.enabled === true ? null : undefined),
      },
    })

    logger.info('agent.config.updated', { agent, by: session.user.id, changes: parsed.data })
    return NextResponse.json({ config: cfg })
  } catch (error: unknown) {
    logger.error('agent.config.update.failed', { agent, error: getErrorMessage(error) })
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
