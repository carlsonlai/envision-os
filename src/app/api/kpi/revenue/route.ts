import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRevenueOverview } from '@/services/kpi'
import { logger, getErrorMessage } from '@/lib/logger'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowedRoles = ['ADMIN', 'SALES']
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const period = (searchParams.get('period') ?? 'MONTH') as 'MONTH' | 'QUARTER' | 'YEAR'

  try {
    const overview = await getRevenueOverview(period)
    return NextResponse.json(
      { data: overview },
      {
        headers: {
          // Per-user cache at the edge for 30s, serve stale up to 2min while
          // revalidating. Revenue overview is read-mostly and the staleness
          // window is well within product tolerance.
          'Cache-Control':
            'private, s-maxage=30, stale-while-revalidate=120',
        },
      },
    )
  } catch (error) {
    logger.error('GET /api/kpi/revenue error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to fetch revenue overview' }, { status: 500 })
  }
}
