import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateWeeklyStrategyBrief } from '@/services/ai'
import { getRevenueOverview, getSeasonalForecast } from '@/services/kpi'
import { getTeamCapacity } from '@/services/workload'
import { prisma } from '@/lib/db'
import { logger, getErrorMessage } from '@/lib/logger'

// In-memory cache — resets on server restart; fine for weekly cadence
let cachedBrief: { content: string; generatedAt: number } | null = null
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  if (cachedBrief && Date.now() - cachedBrief.generatedAt < CACHE_TTL_MS) {
    return NextResponse.json({
      data: { brief: cachedBrief.content, cached: true, generatedAt: cachedBrief.generatedAt },
    })
  }

  try {
    const [revenue, seasonal, teamCapacity] = await Promise.all([
      getRevenueOverview('MONTH'),
      getSeasonalForecast(),
      getTeamCapacity(new Date()),
    ])

    const revenueVsTarget =
      revenue.target > 0 ? Math.round((revenue.paid / revenue.target) * 100) : 0

    // Get churn risk clients
    const clients = await prisma.client.findMany({
      select: { id: true, companyName: true },
      take: 20,
    })

    const churnRiskNames: string[] = []
    for (const client of clients.slice(0, 5)) {
      try {
        const churnRes = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/crm/clients/${client.id}/churn`,
          { headers: { Cookie: '' } }
        )
        if (churnRes.ok) {
          const { data } = (await churnRes.json()) as { data: { risk: string } }
          if (data.risk === 'HIGH') {
            churnRiskNames.push(client.companyName)
          }
        }
      } catch {
        // skip individual failures
      }
    }

    // Get competitor losses this month
    const lostLeads = await prisma.lead.count({
      where: {
        status: 'LOST',
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    })

    // Compute average utilisation across all designers today
    const teamUtilisation =
      teamCapacity.length > 0
        ? Math.round(
            teamCapacity.reduce((sum, m) => sum + m.averageUtilization, 0) / teamCapacity.length
          )
        : 0

    const brief = await generateWeeklyStrategyBrief({
      revenueVsTarget,
      topUnbilledValue: revenue.unbilled,
      teamUtilisation,
      topChurnRiskClients: churnRiskNames,
      upcomingSeasonal: seasonal.slice(0, 3).map((s) => `${s.event} (${s.daysAway}d)`),
      competitorLosses: lostLeads,
    })

    cachedBrief = { content: brief, generatedAt: Date.now() }

    return NextResponse.json({
      data: { brief, cached: false, generatedAt: cachedBrief.generatedAt },
    })
  } catch (error) {
    logger.error('GET /api/ai/weekly-brief error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to generate weekly brief' }, { status: 500 })
  }
}
