import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAssignTasks } from '@/lib/permissions'
import { logger, getErrorMessage } from '@/lib/logger'

const DESIGNER_ROLES = [
  'JUNIOR_ART_DIRECTOR',
  'GRAPHIC_DESIGNER',
  'JUNIOR_DESIGNER',
  'DESIGNER_3D',
  'DIGITAL_MARKETING',
  'SENIOR_ART_DIRECTOR',
  'CREATIVE_DIRECTOR',
]

/**
 * GET /api/team
 * Returns team members for assignment dropdowns.
 * Accessible to: Admin, CS, CD, SAD
 * Query params:
 *   ?group=designers — filter to designer roles only (default)
 *   ?group=all       — all internal users
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canAssignTasks(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const group = searchParams.get('group') ?? 'designers'

    const where =
      group === 'all'
        ? { role: { not: 'CLIENT' as const } }
        : { role: { in: DESIGNER_ROLES as never[] } }

    const users = await prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ data: users })
  } catch (error) {
    logger.error('GET /api/team error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 })
  }
}
