/**
 * POST /api/admin/agents/[agent]/run — manually trigger an agent run.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getErrorMessage, logger } from '@/lib/logger'

import { runDemandIntel }          from '@/lib/agents/demand-intel'
import { runLeadEngine }           from '@/lib/agents/lead-engine'
import { runContentGenerator }     from '@/lib/agents/content-generator'
import { runDistributionEngine }   from '@/lib/agents/distribution-engine'
import { runPerformanceOptimizer } from '@/lib/agents/performance-optimizer'
import { runSalesAgent }           from '@/lib/agents/sales-agent'
import { runPaymentAgent }         from '@/lib/agents/payment-agent'
import { runOnboardingAgent }      from '@/lib/agents/onboarding-agent'
import { runPmAi }                 from '@/lib/agents/pm-ai'
import { runQaAgent }              from '@/lib/agents/qa-agent'
import { runDeliveryAgent }        from '@/lib/agents/delivery-agent'
import { runRevenueExpansion }     from '@/lib/agents/revenue-expansion'

type RunFn = (opts: { triggerKind: 'manual'; triggerRef: string }) => Promise<unknown>

const RUNNERS: Record<string, RunFn> = {
  DEMAND_INTEL:          (o) => runDemandIntel(o),
  LEAD_ENGINE:           (o) => runLeadEngine(o),
  CONTENT_GENERATOR:     (o) => runContentGenerator(o),
  DISTRIBUTION_ENGINE:   (o) => runDistributionEngine(o),
  PERFORMANCE_OPTIMIZER: (o) => runPerformanceOptimizer(o),
  SALES_AGENT:           (o) => runSalesAgent(o),
  PAYMENT_AGENT:         (o) => runPaymentAgent(o),
  ONBOARDING_AGENT:      (o) => runOnboardingAgent(o),
  PM_AI:                 (o) => runPmAi(o),
  QA_AGENT:              (o) => runQaAgent(o),
  DELIVERY_AGENT:        (o) => runDeliveryAgent(o),
  REVENUE_EXPANSION:     (o) => runRevenueExpansion(o),
}

interface RouteContext {
  params: Promise<{ agent: string }>
}

export async function POST(_req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { agent } = await ctx.params
  const runner = RUNNERS[agent]

  if (!runner) {
    return NextResponse.json({ error: 'unknown agent' }, { status: 400 })
  }

  try {
    const result = await runner({ triggerKind: 'manual', triggerRef: session.user.id })
    logger.info('agent.run.manual', { agent, by: session.user.id })
    return NextResponse.json(result)
  } catch (error: unknown) {
    logger.error('agent.run.manual.failed', { agent, error: getErrorMessage(error) })
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
