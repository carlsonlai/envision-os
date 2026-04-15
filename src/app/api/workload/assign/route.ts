import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, createAuditLog } from '@/lib/db'
import { autoAssign } from '@/services/workload'
import { canAssignTasks } from '@/lib/permissions'
import { z } from 'zod'
import { logger, getErrorMessage } from '@/lib/logger'

const assignSchema = z.object({
  deliverableItemId: z.string().min(1),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canAssignTasks(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = assignSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const item = await prisma.deliverableItem.findUnique({
      where: { id: parsed.data.deliverableItemId },
    })

    if (!item) {
      return NextResponse.json({ error: 'Deliverable item not found' }, { status: 404 })
    }

    const assignedUser = await autoAssign(item)

    await createAuditLog({
      projectId: item.projectId,
      deliverableItemId: item.id,
      action: 'AUTO_ASSIGNED',
      performedById: session.user.id,
      metadata: {
        assignedToId: assignedUser.id,
        assignedToName: assignedUser.name,
        itemType: item.itemType,
      },
    })

    return NextResponse.json({
      data: {
        assignedTo: {
          id: assignedUser.id,
          name: assignedUser.name,
          email: assignedUser.email,
        },
      },
    })
  } catch (error) {
    logger.error('POST /api/workload/assign error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to auto-assign task' }, { status: 500 })
  }
}
