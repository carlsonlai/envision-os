import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, createAuditLog } from '@/lib/db'
import { triggerEvent, CHANNELS, EVENTS } from '@/services/pusher'
import { notify } from '@/services/lark'
import { canApproveQC } from '@/lib/permissions'
import { z } from 'zod'
import { logger, getErrorMessage } from '@/lib/logger'

const qcSchema = z.object({
  passed: z.boolean(),
  notes: z.string().min(1, 'Notes are required'),
  fileVersionId: z.string().min(1, 'File version ID is required'),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canApproveQC(session.user.role)) {
      return NextResponse.json(
        { error: 'Forbidden — CD, SAD, or Admin only' },
        { status: 403 }
      )
    }

    const { id: projectId, itemId } = await params
    const { id: userId } = session.user

    const body = await req.json()
    const parsed = qcSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { passed, notes, fileVersionId } = parsed.data

    const item = await prisma.deliverableItem.findUnique({
      where: { id: itemId },
      include: {
        project: { select: { code: true } },
        assignedDesigner: { select: { id: true } },
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Deliverable item not found' }, { status: 404 })
    }

    // Create QC check record
    const qcCheck = await prisma.qCCheck.create({
      data: {
        deliverableItemId: itemId,
        fileVersionId,
        checkedById: userId,
        passed,
        notes,
      },
      include: {
        checkedBy: { select: { id: true, name: true } },
      },
    })

    // Update item status based on result
    const newStatus = passed ? 'APPROVED' : 'IN_PROGRESS'
    await prisma.deliverableItem.update({
      where: { id: itemId },
      data: { status: newStatus },
    })

    await createAuditLog({
      projectId,
      deliverableItemId: itemId,
      action: passed ? 'QC_PASSED' : 'QC_FAILED',
      performedById: userId,
      metadata: { notes, fileVersionId, passed },
    })

    // Trigger Pusher
    const event = passed ? EVENTS.QC_PASSED : EVENTS.STATUS_CHANGED
    await triggerEvent(CHANNELS.project(projectId), event, {
      itemId,
      passed,
      notes,
      newStatus,
      checkedById: userId,
      timestamp: new Date().toISOString(),
    })

    // Notify designer if QC failed
    if (!passed && item.assignedDesigner) {
      await triggerEvent(
        CHANNELS.designer(item.assignedDesigner.id),
        EVENTS.STATUS_CHANGED,
        {
          itemId,
          status: 'qc_failed',
          notes,
          timestamp: new Date().toISOString(),
        }
      )
    }

    // Notify via Lark
    try {
      if (passed) {
        await notify('CS', {
          title: 'QC Passed',
          body: `Project **${item.project.code}** — ${item.itemType} has passed QC. Ready to send to client.`,
          projectCode: item.project.code,
          actionLabel: 'Approve & Send',
          actionUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/cs/projects/${projectId}`,
        })
      } else {
        await notify('CREATIVE', {
          title: 'QC Failed — Revision Needed',
          body: `Project **${item.project.code}** — ${item.itemType} did not pass QC.\nNotes: ${notes}`,
          projectCode: item.project.code,
          actionLabel: 'View Task',
          actionUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/designer/task/${itemId}`,
        })
      }
    } catch (err) {
      logger.warn('Lark notify failed (non-fatal):', { error: getErrorMessage(err) })
    }

    return NextResponse.json({ data: { qcCheck, newStatus } }, { status: 201 })
  } catch (error) {
    logger.error('POST /api/projects/[id]/items/[itemId]/qc error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to submit QC check' }, { status: 500 })
  }
}
