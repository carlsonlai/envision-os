import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTeamUtilisation } from '@/services/kpi'
import { logger, getErrorMessage } from '@/lib/logger'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowedRoles = ['ADMIN', 'CREATIVE_DIRECTOR', 'SENIOR_ART_DIRECTOR']
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const dateParam = searchParams.get('date')
  const date = dateParam ? new Date(dateParam) : new Date()

  try {
    const utilisation = await getTeamUtilisation(date)
    return NextResponse.json(
      { data: utilisation },
      {
        headers: {
          // Per-user cache at the edge for 30s, serve stale up to 2min while
          // revalidating in the background. Massively reduces DB load and TTFB
          // on dashboard reloads without sacrificing freshness.
          'Cache-Control':
            'private, s-maxage=30, stale-while-revalidate=120',
        },
      },
    )
  } catch (error) {
    logger.error('GET /api/kpi/team error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to fetch team utilisation' }, { status: 500 })
  }
}
