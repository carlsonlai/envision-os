import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCompanyTimeline } from '@/services/workload'
import { Role } from '@prisma/client'

const ALLOWED_ROLES: Role[] = [
  Role.ADMIN,
  Role.CREATIVE_DIRECTOR,
  Role.SENIOR_ART_DIRECTOR,
  Role.CLIENT_SERVICING,
  Role.SALES,
  Role.GRAPHIC_DESIGNER,
  Role.JUNIOR_ART_DIRECTOR,
  Role.JUNIOR_DESIGNER,
  Role.DESIGNER_3D,
  Role.DIGITAL_MARKETING,
]

/**
 * GET /api/admin/timeline
 *
 * Returns the full company project + workload timeline.
 * This is the primary data source for:
 * - The AI to understand the company's current state
 * - Creative directors to view team workload
 * - The workload balancing dashboard
 *
 * Designers only see their own tasks (filtered server-side).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const timeline = await getCompanyTimeline()

  // Designers only see their own workload detail (not everyone's tasks)
  const designerOnlyRoles: Role[] = [
    Role.GRAPHIC_DESIGNER,
    Role.JUNIOR_ART_DIRECTOR,
    Role.JUNIOR_DESIGNER,
    Role.DESIGNER_3D,
    Role.DIGITAL_MARKETING,
  ]

  if (designerOnlyRoles.includes(session.user.role)) {
    const filtered = {
      ...timeline,
      designerWorkload: timeline.designerWorkload.filter(
        (d) => d.userId === session.user.id
      ),
    }
    return NextResponse.json({ success: true, data: filtered })
  }

  return NextResponse.json({ success: true, data: timeline })
}
