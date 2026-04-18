/**
 * PATCH /api/projects/[id]/items/[itemId]/status
 *
 * Transition a deliverable's status. Used by the Designer queue's Start / Upload
 * buttons so the state actually persists (the previous client-side-only logic
 * left CS blind to designer progress).
 *
 * Allowed transitions (any of these combinations):
 *   PENDING       → IN_PROGRESS        (designer clicks "Start")
 *   IN_PROGRESS   → WIP_UPLOADED       (designer clicks "Upload")
 *   WIP_UPLOADED  → QC_REVIEW          (designer / CS moves to QC)
 *   QC_REVIEW     → IN_PROGRESS        (QC failed, back to designer)
 *
 * Emits Pusher events on project channel + CS channel so CS sees changes live.
 * Writes an AuditLog row for every transition.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, createAuditLog } from '@/lib/db'
import { triggerEvent, CHANNELS, EVENTS } from '@/services/pusher'
import { notify } from '@/services/lark'
import { z } from 'zod'
import { logger, getErrorMessage } from '@/lib/logger'

// Roles allowed to transition a deliverable's status.
// Designers can only move their own items; CS/CD/SAD/Admin can move anyone's.
const DESIGNER_ROLES = [
  'JUNIOR_ART_DIRECTOR',
  'GRAPHIC_DESIGNER',
  'JUNIOR_DESIGNER',
  'DESIGNER_3D',
  'MULTIMEDIA_DESIGNER',
  'DIGITAL_MARKETING',
]
const SUPERVISOR_ROLES = ['ADMIN', 'CREATIVE_DIRECTOR', 'SENIOR_ART_DIRECTOR', 'CLIENT_SERVICING']
const ALLOWED_ROLES = [...DESIGNER_ROLES, ...SUPERVISOR_ROLES]

type DeliverableStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'WIP_UPLOADED'
  | 'QC_REVIEW'
  | 'APPROVED'
  | 'DELIVERED'
  | 'FA_SIGNED'

// Transitions a designer is permitted to drive themselves.
// (Approve / Deliver / FA are CS-only and live on other endpoints.)
const DESIGNER_ALLOWED_TRANSITIONS: Partial<Record<DeliverableStatus, DeliverableStatus[]>> = {
  PENDING: ['IN_PROGRESS'],
  IN_PROGRESS: ['WIP_UPLOADED'],
  WIP_UPLOADED: ['QC_REVIEW', 'IN_PROGRESS'],
  QC_REVIEW: ['IN_PROGRESS'],
}

// Supervisors can also nudge items forward; still block APPROVED/DELIVERED/FA_SIGNED
// which have dedicated audited endpoints.
const SUPERVISOR_ALLOWED_TRANSITIONS: Partial<Record<DeliverableStatus, DeliverableStatus[]>> = {
  PENDING: ['IN_PROGRESS'],
  IN_PROGRESS: ['WIP_UPLOADED', 'QC_REVIEW'],
  WIP_UPLOADED: ['QC_REVIEW', 'IN_PROGRESS'],
  QC_REVIEW: ['IN_PROGRESS', 'WIP_UPLOADED'],
}

const patchSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'WIP_UPLOADED', 'QC_REVIEW']),
  note: z.string().max(500).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { role, id: userId, name: userName } = session.user
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: projectId, itemId } = await params
    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const nextStatus = parsed.data.status as DeliverableStatus

    const item = await prisma.deliverableItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        projectId: true,
        status: true,
        itemType: true,
        assignedDesignerId: true,
        assignedDesigner: { select: { id: true, name: true } },
        project: {
          select: {
            id: true,
            code: true,
            assignedCSId: true,
            assignedCS: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Deliverable item not found' }, { status: 404 })
    }

    if (item.projectId !== projectId) {
      return NextResponse.json({ error: 'Item does not belong to this project' }, { status: 400 })
    }

    const isDesigner = DESIGNER_ROLES.includes(role)
    const isSupervisor = SUPERVISOR_ROLES.includes(role)

    // Designers can only touch their own assigned items
    if (isDesigner && item.assignedDesignerId && item.assignedDesignerId !== userId) {
      return NextResponse.json(
        { error: 'You are not assigned to this item' },
        { status: 403 }
      )
    }

    const currentStatus = item.status as DeliverableStatus
    const allowed = isSupervisor
      ? SUPERVISOR_ALLOWED_TRANSITIONS[currentStatus] ?? []
      : DESIGNER_ALLOWED_TRANSITIONS[currentStatus] ?? []

    if (!allowed.includes(nextStatus)) {
      return NextResponse.json(
        {
          error: `Cannot transition from ${currentStatus} to ${nextStatus}`,
          allowedNext: allowed,
        },
        { status: 422 }
      )
    }

    // Perform the update
    await prisma.deliverableItem.update({
      where: { id: itemId },
      data: { status: nextStatus },
    })

    await createAuditLog({
      projectId,
      deliverableItemId: itemId,
      action: 'DELIVERABLE_STATUS_CHANGED',
      performedById: userId,
      metadata: {
        from: currentStatus,
        to: nextStatus,
        itemType: item.itemType,
        note: parsed.data.note ?? null,
      },
    })

    const payload = {
      itemId,
      projectId,
      projectCode: item.project.code,
      itemType: item.itemType,
      from: currentStatus,
      to: nextStatus,
      changedById: userId,
      changedByName: userName,
      assignedCSId: item.project.assignedCSId,
      assignedDesignerId: item.assignedDesignerId,
      timestamp: new Date().toISOString(),
    }

    // Real-time: push to project and CS channels so dashboards refresh live
    await triggerEvent(CHANNELS.project(projectId), EVENTS.STATUS_CHANGED, payload)
    await triggerEvent(CHANNELS.cs, EVENTS.STATUS_CHANGED, payload)
    if (item.assignedDesignerId) {
      await triggerEvent(CHANNELS.designer(item.assignedDesignerId), EVENTS.STATUS_CHANGED, payload)
    }

    // Lark nudge when designer finishes WIP → CS should know immediately.
    // (Business rule: never send invoice/quotation/pricing/payment content.
    //  Status update text is fine.)
    if (nextStatus === 'WIP_UPLOADED') {
      try {
        await notify('CS', {
          title: 'WIP Ready for Review',
          body:
            `Project **${item.project.code}** — ${item.itemType} uploaded by ` +
            `${item.assignedDesigner?.name ?? 'designer'}. Please review and run QC.`,
          projectCode: item.project.code,
          actionLabel: 'Open Project',
          actionUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/cs/projects/${projectId}`,
        })
      } catch (err) {
        logger.warn('[Status PATCH] Lark CS notify failed', { error: getErrorMessage(err) })
      }
    }

    return NextResponse.json({
      data: {
        itemId,
        projectId,
        status: nextStatus,
        previousStatus: currentStatus,
      },
    })
  } catch (error) {
    logger.error('PATCH /api/projects/[id]/items/[itemId]/status error:', {
      error: getErrorMessage(error),
    })
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }
}
