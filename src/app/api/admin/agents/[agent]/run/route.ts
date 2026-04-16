/**
 * POST /api/admin/agents/[agent]/run — manually trigger an agent run.
 * Currently only DEMAND_INTEL is implemented; others return 501.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runDemandIntel } from '@/lib/agents/demand-intel'
import { getErrorMessage, logger } from '@/lib/logger'
import type { AgentKind } from '@prisma/client'

interface RouteContext {
  params: Promise<{ agent: string }>
}

export async function POST(_req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { agent } = await ctx.params

  try {
    if (agent === ('DEMAND_INTEL' satisfies AgentKind)) {
      const result = await runDemandIntel({ triggerKind: 'manual', triggerRef: session.user.id })
      logger.info('agent.run.manual', { agent, by: session.user.id, ...result })
      return NextResponse.json(result)
    }
    return NextResponse.json({ error: 'agent not implemented yet' }, { status: 501 })
  } catch (error: unknown) {
    logger.error('agent.run.manual.failed', { agent, error: getErrorMessage(error) })
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
