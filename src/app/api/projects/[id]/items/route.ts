import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isDesignerRole } from '@/lib/permissions'
import { logger, getErrorMessage } from '@/lib/logger'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { role, id: userId } = session.user

    const items = await prisma.deliverableItem.findMany({
      where: {
        projectId: id,
        // Designers only see their own items
        ...(isDesignerRole(role) ? { assignedDesignerId: userId } : {}),
      },
      include: {
        assignedDesigner: isDesignerRole(role)
          ? false
          : {
              select: { id: true, name: true, email: true },
            },
        revisions: {
          select: {
            id: true,
            revisionNumber: true,
            status: true,
            feedback: true,
            createdAt: true,
          },
        },
        fileVersions: {
          orderBy: { version: 'desc' },
          take: 1,
          select: {
            id: true,
            version: true,
            filename: true,
            url: true,
            larkFolderStage: true,
            createdAt: true,
          },
        },
        qcChecks: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            passed: true,
            notes: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ data: items })
  } catch (error) {
    logger.error('GET /api/projects/[id]/items error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to fetch deliverable items' }, { status: 500 })
  }
}
