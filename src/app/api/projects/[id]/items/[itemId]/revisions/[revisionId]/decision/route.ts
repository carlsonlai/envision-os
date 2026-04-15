import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, createAuditLog } from '@/lib/db'
import { triggerEvent, CHANNELS, EVENTS } from '@/services/pusher'
import { notify } from '@/services/lark'
import { canWaiveRevision } from '@/lib/permissions'
import { z } from 'zod'
import { logger, getErrorMessage } from '@/lib/logger'

const decisionSchema = z.object({
  decision: z.enum(['CHARGE', 'WAIVE', 'REJECT']),
  reason: z.string().optional(),
  chargeAmount: z.number().min(0).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string; revisionId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canWaiveRevision(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden — CS or Admin only' }, { status: 403 })
    }

    const { id: projectId, itemId, revisionId } = await params
    const { id: userId } = session.user

    const body = await req.json()
    const parsed = decisionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { decision, reason, chargeAmount } = parsed.data

    const [revision, item] = await Promise.all([
      prisma.revision.findUnique({
        where: { id: revisionId },
        include: { deliverableItem: { include: { project: { select: { code: true } } } } },
      }),
      prisma.deliverableItem.findUnique({
        where: { id: itemId },
        include: { assignedDesigner: { select: { id: true, name: true } } },
      }),
    ])

    if (!revision) {
      return NextResponse.json({ error: 'Revision not found' }, { status: 404 })
    }

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const projectCode = revision.deliverableItem.project.code

    if (decision === 'CHARGE') {
      // Create invoice record for extra revision charge
      const invoiceRecord = await prisma.invoice.create({
        data: {
          projectId,
          type: 'EXTRA_REVISION',
          amount: chargeAmount ?? 0,
          status: 'PENDING',
        },
      })

      // Update revision — mark it as unlocked with charge info
      await prisma.revision.update({
        where: { id: revisionId },
        data: {
          status: 'IN_PROGRESS',
          chargedAmount: chargeAmount ?? 0,
          waivedById: userId,
          waivedReason: reason ?? 'Charged for extra revision',
          // Store invoice ID in the revision record
          bukkuInvoiceLineId: invoiceRecord.id,
        },
      })

      // Increment revision counter to allow the over-limit revision
      await prisma.deliverableItem.update({
        where: { id: itemId },
        data: { revisionCount: { increment: 1 } },
      })

      await createAuditLog({
        projectId,
        deliverableItemId: itemId,
        action: 'REVISION_CHARGE_APPLIED',
        performedById: userId,
        metadata: { revisionId, chargeAmount, reason, invoiceId: invoiceRecord.id },
      })

      try {
        await notify('CS', {
          title: 'Extra Revision Charged',
          body: `Project **${projectCode}** — extra revision has been charged and unlocked. See Bukku for billing details.`,
          projectCode,
        })
      } catch (err) {
        logger.warn('Lark notify failed (non-fatal):', { error: getErrorMessage(err) })
      }

      return NextResponse.json({
        data: { decision: 'CHARGE', unlocked: true, invoiceId: invoiceRecord.id },
      })
    }

    if (decision === 'WAIVE') {
      await prisma.revision.update({
        where: { id: revisionId },
        data: {
          status: 'WAIVED',
          waivedById: userId,
          waivedReason: reason ?? 'Waived by CS',
        },
      })

      // Increment revision counter to allow the over-limit revision
      await prisma.deliverableItem.update({
        where: { id: itemId },
        data: { revisionCount: { increment: 1 } },
      })

      await createAuditLog({
        projectId,
        deliverableItemId: itemId,
        action: 'REVISION_WAIVED',
        performedById: userId,
        metadata: { revisionId, reason },
      })

      // Notify designer
      if (item.assignedDesigner) {
        await triggerEvent(
          CHANNELS.designer(item.assignedDesigner.id),
          EVENTS.REVISION_SUBMITTED,
          {
            itemId,
            revisionId,
            projectCode,
            waived: true,
            timestamp: new Date().toISOString(),
          }
        )
      }

      try {
        await notify('CS', {
          title: 'Extra Revision Waived',
          body: `Project **${projectCode}** — extra revision waived. Reason: ${reason ?? 'No reason provided'}.`,
          projectCode,
        })
      } catch (err) {
        logger.warn('Lark notify failed (non-fatal):', { error: getErrorMessage(err) })
      }

      return NextResponse.json({ data: { decision: 'WAIVE', unlocked: true } })
    }

    // REJECT — keep locked, CS to inform client
    await prisma.revision.update({
      where: { id: revisionId },
      data: {
        status: 'REJECTED',
        waivedById: userId,
        waivedReason: reason ?? 'Rejected — limit enforced',
      },
    })

    await createAuditLog({
      projectId,
      deliverableItemId: itemId,
      action: 'REVISION_REJECTED',
      performedById: userId,
      metadata: { revisionId, reason },
    })

    await triggerEvent(CHANNELS.project(projectId), EVENTS.STATUS_CHANGED, {
      itemId,
      status: 'revision_rejected',
      reason,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({ data: { decision: 'REJECT', unlocked: false } })
  } catch (error) {
    logger.error('POST revisions/[revisionId]/decision error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to process revision decision' }, { status: 500 })
  }
}
