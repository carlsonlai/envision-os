import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getProjectForRole, prisma } from '@/lib/db'
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
    const project = await getProjectForRole(id, session.user.role)

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({ data: project })
  } catch (error) {
    logger.error('GET /api/projects/[id] error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()

    const allowed = ['status', 'quotedAmount', 'deadline', 'assignedCSId', 'clientId']
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) {
        data[key] = key === 'deadline' && body[key]
          ? new Date(body[key])
          : body[key] === '' ? null : body[key]
      }
    }

    const project = await prisma.project.update({
      where: { id },
      data,
      include: {
        client: { select: { id: true, companyName: true, contactPerson: true } },
        assignedCS: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ data: project })
  } catch (error) {
    logger.error('PATCH /api/projects/[id] error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const { id } = await params

    const project = await prisma.project.findUnique({ where: { id } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Delete dependent records first, then the project itself
    await prisma.$transaction([
      prisma.auditLog.deleteMany({ where: { projectId: id } }),
      prisma.chatMessage.deleteMany({ where: { projectId: id } }),
      prisma.fASignOff.deleteMany({ where: { projectId: id } }),
      prisma.freelancerAssignment.deleteMany({ where: { projectId: id } }),
      prisma.invoice.deleteMany({ where: { projectId: id } }),
      prisma.deliverableItem.deleteMany({ where: { projectId: id } }),
      prisma.fileVersion.deleteMany({ where: { projectId: id } }),
      prisma.projectBrief.deleteMany({ where: { projectId: id } }),
      prisma.project.delete({ where: { id } }),
    ])

    // If this project was synced from a Lark group, remember its chat_id so
    // the sync endpoint won't re-import it next time.
    if (project.larkFolderId) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS lark_group_exclusions (
          "chatId"     TEXT        PRIMARY KEY,
          "excludedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      await prisma.$executeRawUnsafe(
        `INSERT INTO lark_group_exclusions ("chatId") VALUES ($1) ON CONFLICT ("chatId") DO NOTHING`,
        project.larkFolderId
      )
    }

    return NextResponse.json({ data: { deleted: true, code: project.code } })
  } catch (error) {
    logger.error('DELETE /api/projects/[id] error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}
