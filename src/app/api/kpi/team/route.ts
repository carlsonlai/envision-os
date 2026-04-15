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
          // Browser-only cache. `private` keeps sensitive per-user data out
          // of shared/CDN caches (which means s-maxage is intentionally
          // omitted — combining `private` with `s-maxage` is contradictory
          // and Vercel's edge won't cache it anyway). 20s is short enough
          // that dashboard refreshes feel live.
          'Cache-Control': 'private, max-age=20',
        },
      },
    )
  } catch (error) {
    logger.error('GET /api/kpi/team error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to fetch team utilisation' }, { status: 500 })
  }
}
