import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCompanyTimeline, getDesignerWorkload } from '@/services/workload'
import { Role } from '@prisma/client'

const ALLOWED_ROLES: Role[] = [
  Role.ADMIN,
  Role.CREATIVE_DIRECTOR,
  Role.SENIOR_ART_DIRECTOR,
  Role.CLIENT_SERVICING,
]

/**
 * GET /api/admin/workload
 * Returns the full company workload snapshot — used by:
 * - Workload dashboard UI
 * - AI agent context window (company timeline awareness)
 * - Auto-assignment pre-check
 *
 * Optional query: ?userId=<id> — returns single designer workload
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')

  if (userId) {
    const workload = await getDesignerWorkload(userId)
    if (!workload) {
      return NextResponse.json({ error: 'Designer not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: workload })
  }

  const timeline = await getCompanyTimeline()
  return NextResponse.json({ success: true, data: timeline })
}
