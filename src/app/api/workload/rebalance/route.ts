import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { rebalanceOnAbsence } from '@/services/workload'
import { Role } from '@prisma/client'
import { logger, getErrorMessage } from '@/lib/logger'

const ALLOWED_ROLES: Role[] = [Role.ADMIN, Role.CREATIVE_DIRECTOR, Role.SENIOR_ART_DIRECTOR]

/**
 * POST /api/workload/rebalance
 * Triggers automatic task redistribution for an absent designer.
 *
 * Body: { userId: string; absenceDate: string (YYYY-MM-DD) }
 *
 * Internally calls rebalanceOnAbsence() which:
 * - Finds all pending tasks for the designer on/after absenceDate
 * - Auto-assigns each to the next available designer by capacity
 * - Clears the absent designer's workload slot
 * - Sends a Lark notification to management
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json()) as { userId?: string; absenceDate?: string }

  if (!body.userId || !body.absenceDate) {
    return NextResponse.json(
      { error: 'userId and absenceDate (YYYY-MM-DD) are required' },
      { status: 400 }
    )
  }

  const absenceDate = new Date(body.absenceDate)
  if (isNaN(absenceDate.getTime())) {
    return NextResponse.json({ error: 'Invalid absenceDate' }, { status: 400 })
  }

  try {
    await rebalanceOnAbsence(body.userId, absenceDate)
    return NextResponse.json({ ok: true, message: 'Tasks redistributed successfully' })
  } catch (err) {
    logger.error('POST /api/workload/rebalance error:', { error: getErrorMessage(err) })
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to rebalance workload' },
      { status: 500 }
    )
  }
}
