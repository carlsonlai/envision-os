/**
 * POST /api/projects/[id]/items/[itemId]/client-confirm
 *
 * Called from the client portal annotation page when the client
 * confirms approval of a delivered artwork item.
 *
 * This does NOT change the item status — the item remains DELIVERED
 * so that the FA signing flow can proceed. It records the client's
 * approval as an audit log entry and notifies the CS team.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, createAuditLog } from '@/lib/db'
import { notify } from '@/services/lark'
import { triggerEvent, CHANNELS, EVENTS } from '@/services/pusher'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: projectId, itemId } = await params
  const { id: userId } = session.user

  try {
    const item = await prisma.deliverableItem.findUnique({
      where: { id: itemId },
      include: { project: { select: { code: true } } },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    if (item.status !== 'DELIVERED') {
      return NextResponse.json(
        { error: 'Item is not currently awaiting client review' },
        { status: 422 }
      )
    }

    await createAuditLog({
      projectId,
      deliverableItemId: itemId,
      action: 'CLIENT_APPROVED',
      performedById: userId,
      metadata: { itemType: item.itemType },
    })

    await triggerEvent(CHANNELS.cs, EVENTS.ITEM_APPROVED, {
      projectId,
      itemId,
      projectCode: item.project.code,
      itemType: item.itemType,
      clientApproved: true,
      timestamp: new Date().toISOString(),
    })

    try {
      await notify('CS', {
        title: 'Client Approved Artwork',
        body: `Client has approved **${item.project.code}** — ${item.itemType}. Proceed with Final Artwork when all items are confirmed.`,
        projectCode: item.project.code,
        actionLabel: 'View Project',
        actionUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/cs/projects/${projectId}`,
      })
    } catch {
      // Lark notification is non-fatal
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
