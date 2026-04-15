import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, createAuditLog } from '@/lib/db'
import { z } from 'zod'
import { notify } from '@/services/lark'
import { logger, getErrorMessage } from '@/lib/logger'

const HandoverSchema = z.object({
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
  type: z.enum(['CS', 'DESIGNER']),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const body: unknown = await req.json()
    const parsed = HandoverSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { fromUserId, toUserId, type } = parsed.data

    if (fromUserId === toUserId) {
      return NextResponse.json({ error: 'Cannot handover to same user' }, { status: 400 })
    }

    const [fromUser, toUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: fromUserId }, select: { id: true, name: true, role: true } }),
      prisma.user.findUnique({ where: { id: toUserId }, select: { id: true, name: true, role: true } }),
    ])

    if (!fromUser || !toUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let transferCount = 0

    if (type === 'CS') {
      // Find all active projects with deliverable items assigned to fromUser
      const projects = await prisma.project.findMany({
        where: {
          status: { in: ['PROJECTED', 'ONGOING'] },
        },
        select: { id: true, code: true },
      })

      // Create audit log entries for each project
      for (const project of projects) {
        await createAuditLog({
          projectId: project.id,
          action: 'CS_HANDOVER',
          performedById: session.user.id,
          metadata: {
            fromUserId,
            fromUserName: fromUser.name,
            toUserId,
            toUserName: toUser.name,
            type,
          },
        })
        transferCount++
      }
    } else if (type === 'DESIGNER') {
      // Transfer workload slots from designer to another
      const slots = await prisma.workloadSlot.findMany({
        where: {
          userId: fromUserId,
          date: { gte: new Date() },
        },
      })

      // Update slots to new user
      if (slots.length > 0) {
        await prisma.workloadSlot.updateMany({
          where: {
            userId: fromUserId,
            date: { gte: new Date() },
          },
          data: { userId: toUserId },
        })
        transferCount = slots.length
      }

      // Transfer deliverable items
      const deliverableItems = await prisma.deliverableItem.findMany({
        where: {
          assignedDesignerId: fromUserId,
          status: { in: ['PENDING', 'IN_PROGRESS', 'WIP_UPLOADED', 'QC_REVIEW'] },
        },
        select: { id: true, project: { select: { id: true } } },
      })

      if (deliverableItems.length > 0) {
        await prisma.deliverableItem.updateMany({
          where: {
            assignedDesignerId: fromUserId,
            status: { in: ['PENDING', 'IN_PROGRESS', 'WIP_UPLOADED', 'QC_REVIEW'] },
          },
          data: { assignedDesignerId: toUserId },
        })

        for (const item of deliverableItems) {
          await createAuditLog({
            projectId: item.project.id,
            action: 'DESIGNER_REASSIGNED',
            performedById: session.user.id,
            metadata: {
              fromUserId,
              fromUserName: fromUser.name,
              toUserId,
              toUserName: toUser.name,
              type,
            },
          })
        }
        transferCount += deliverableItems.length
      }
    }

    // Send Lark notifications
    try {
      await notify('MANAGEMENT', {
        title: `Handover Complete — ${type}`,
        body: `${fromUser.name ?? fromUserId} → ${toUser.name ?? toUserId}\n${transferCount} items transferred`,
        actionLabel: 'View Dashboard',
        actionUrl: `${process.env.NEXTAUTH_URL}/command`,
      })
    } catch {
      // Non-fatal — notification failure should not block handover
    }

    return NextResponse.json({
      data: {
        transferCount,
        from: fromUser.name,
        to: toUser.name,
        type,
      },
    })
  } catch (error) {
    logger.error('POST /api/crm/handover error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Handover failed' }, { status: 500 })
  }
}
