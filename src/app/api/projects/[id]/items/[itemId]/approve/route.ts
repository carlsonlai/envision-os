import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, createAuditLog } from '@/lib/db'
import { triggerEvent, CHANNELS, EVENTS } from '@/services/pusher'
import { notify } from '@/services/lark'
import { sendDeliverableForApproval } from '@/services/feedback-processor'
import { logger, getErrorMessage } from '@/lib/logger'

const ALLOWED_ROLES = ['ADMIN', 'CLIENT_SERVICING', 'CREATIVE_DIRECTOR', 'SENIOR_ART_DIRECTOR']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: projectId, itemId } = await params
    const { id: userId } = session.user

    const item = await prisma.deliverableItem.findUnique({
      where: { id: itemId },
      include: {
        project: {
          select: {
            code: true,
            clientId: true,
            client: { select: { contactPerson: true, phone: true } },
          },
        },
        fileVersions: {
          orderBy: { version: 'desc' },
          take: 1,
          select: { url: true, version: true },
        },
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Deliverable item not found' }, { status: 404 })
    }

    if (item.status !== 'APPROVED') {
      return NextResponse.json(
        {
          error: `Item must be in APPROVED status before sending to client. Current status: ${item.status}`,
        },
        { status: 422 }
      )
    }

    // Update item status to DELIVERED
    await prisma.deliverableItem.update({
      where: { id: itemId },
      data: { status: 'DELIVERED' },
    })

    await createAuditLog({
      projectId,
      deliverableItemId: itemId,
      action: 'ITEM_DELIVERED_TO_CLIENT',
      performedById: userId,
      metadata: { itemType: item.itemType },
    })

    await triggerEvent(CHANNELS.project(projectId), EVENTS.ITEM_APPROVED, {
      itemId,
      itemType: item.itemType,
      approvedById: userId,
      timestamp: new Date().toISOString(),
    })

    await triggerEvent(CHANNELS.cs, EVENTS.ITEM_APPROVED, {
      projectId,
      itemId,
      projectCode: item.project.code,
      itemType: item.itemType,
      timestamp: new Date().toISOString(),
    })

    try {
      await notify('CS', {
        title: 'Item Sent to Client',
        body: `Project **${item.project.code}** — ${item.itemType} has been marked as delivered and sent to the client.`,
        projectCode: item.project.code,
        actionLabel: 'View Project',
        actionUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/cs/projects/${projectId}`,
      })
    } catch (err) {
      logger.warn('Lark notify failed (non-fatal):', { error: getErrorMessage(err) })
    }

    // ── WhatsApp: send deliverable to client for approval ─────────────────
    const latestFile = (item as unknown as { fileVersions?: { url: string; version: number }[] }).fileVersions?.[0]
    const clientPhone = (item.project as unknown as { client?: { phone?: string; contactPerson?: string } }).client?.phone
    const clientName = (item.project as unknown as { client?: { contactPerson?: string } }).client?.contactPerson

    if (clientPhone) {
      try {
        await sendDeliverableForApproval({
          clientPhone,
          clientName: clientName ?? 'Client',
          projectCode: item.project.code,
          projectId,
          deliverableItemId: itemId,
          itemType: item.itemType,
          fileUrl: latestFile?.url,
        })
      } catch (err) {
        logger.warn('[Approve] WhatsApp delivery failed (non-fatal):', { error: getErrorMessage(err) })
      }
    }

    return NextResponse.json({ data: { itemId, status: 'DELIVERED', whatsappSent: !!clientPhone } })
  } catch (error) {
    logger.error('POST /api/projects/[id]/items/[itemId]/approve error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to approve item' }, { status: 500 })
  }
}
