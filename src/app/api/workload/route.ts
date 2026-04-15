import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTeamCapacity } from '@/services/workload'
import { canSeeWorkload } from '@/lib/permissions'
import { logger, getErrorMessage } from '@/lib/logger'

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canSeeWorkload(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(req.url)
    const dateParam = url.searchParams.get('date')
    const date = dateParam ? new Date(dateParam) : new Date()

    const teamCapacity = await getTeamCapacity(date)

    return NextResponse.json({ data: teamCapacity })
  } catch (error) {
    logger.error('GET /api/workload error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to fetch workload' }, { status: 500 })
  }
}
