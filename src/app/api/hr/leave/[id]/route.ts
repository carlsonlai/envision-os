import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Role } from '@prisma/client'

const ADMIN_ROLES: Role[] = [Role.ADMIN]

/**
 * PATCH /api/hr/leave/[id]
 * Approve or reject a leave request. Admin only.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = (await req.json()) as { status?: string }

  if (!body.status || !['approved', 'rejected'].includes(body.status)) {
    return NextResponse.json({ error: 'status must be "approved" or "rejected"' }, { status: 400 })
  }

  // Resolve reviewer name
  const reviewer = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true },
  })

  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; status: string }>>(
    `UPDATE leave_requests
     SET status = $1, reviewed_by = $2, reviewed_at = NOW()
     WHERE id = $3
     RETURNING id, status`,
    body.status,
    reviewer?.name ?? session.user.id,
    id
  )

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Leave request not found' }, { status: 404 })
  }

  return NextResponse.json({ data: rows[0] })
}
