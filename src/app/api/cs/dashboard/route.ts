/**
 * GET /api/cs/dashboard
 *
 * Returns ALL active projects for CS Dashboard.
 * CS staff can see every project and self-select which ones they handle.
 * Includes claim info (which CS staff have claimed each project).
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const ALLOWED_ROLES = ['ADMIN', 'CLIENT_SERVICING', 'CREATIVE_DIRECTOR', 'SENIOR_ART_DIRECTOR']

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    // Show ALL active projects — CS staff pick which ones they handle
    const projects = await prisma.project.findMany({
      where: {
        status: { in: ['PROJECTED', 'ONGOING', 'COMPLETED', 'BILLED', 'PAID'] },
      },
      select: {
        id: true,
        code: true,
        status: true,
        quotedAmount: true,
        deadline: true,
        updatedAt: true,
        client: {
          select: { companyName: true },
        },
        csAssignments: {
          select: {
            userId: true,
            claimedAt: true,
            user: {
              select: { name: true },
            },
          },
        },
        deliverableItems: {
          select: {
            id: true,
            itemType: true,
            description: true,
            status: true,
            revisionCount: true,
            deadline: true,
            assignedDesigner: {
              select: { name: true },
            },
            fileVersions: {
              select: { version: true, filename: true, url: true },
              orderBy: { version: 'desc' },
              take: 1,
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const data = projects.map((p) => ({
      id: p.id,
      code: p.code,
      status: p.status,
      clientName: p.client?.companyName ?? 'Unknown',
      quotedAmount: p.quotedAmount,
      deadline: p.deadline?.toISOString() ?? null,
      updatedAt: p.updatedAt.toISOString(),
      claimedBy: p.csAssignments.map((a) => ({
        userId: a.userId,
        name: a.user.name,
        claimedAt: a.claimedAt.toISOString(),
      })),
      isMyClaim: p.csAssignments.some((a) => a.userId === userId),
      items: p.deliverableItems.map((di) => ({
        id: di.id,
        itemType: di.itemType,
        description: di.description,
        status: di.status,
        revisionCount: di.revisionCount,
        deadline: di.deadline?.toISOString() ?? null,
        designerName: di.assignedDesigner?.name ?? null,
        latestFileVersion: di.fileVersions[0]?.filename ?? null,
        latestFileUrl: di.fileVersions[0]?.url ?? null,
      })),
    }))

    return NextResponse.json({ data, currentUserId: userId })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
