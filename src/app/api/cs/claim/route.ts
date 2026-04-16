/**
 * POST /api/cs/claim   — CS staff claims a project
 * DELETE /api/cs/claim  — CS staff unclaims a project
 *
 * Body: { projectId: string }
 *
 * Multiple CS staff can claim the same project.
 * Only CLIENT_SERVICING and ADMIN roles allowed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const ALLOWED_ROLES = ['ADMIN', 'CLIENT_SERVICING']

async function getSessionUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    return null
  }
  return session.user
}

/** POST — claim a project */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await req.json()) as { projectId?: string }
    if (!body.projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    // Verify the project exists
    const project = await prisma.project.findUnique({
      where: { id: body.projectId },
      select: { id: true, code: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Upsert — idempotent claim
    await prisma.projectCSAssignment.upsert({
      where: {
        projectId_userId: {
          projectId: body.projectId,
          userId: user.id,
        },
      },
      create: {
        projectId: body.projectId,
        userId: user.id,
      },
      update: {}, // already claimed, no-op
    })

    return NextResponse.json({
      success: true,
      action: 'claimed',
      projectCode: project.code,
      userId: user.id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** DELETE — unclaim a project */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await req.json()) as { projectId?: string }
    if (!body.projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    // Delete the claim (ignore if not found)
    await prisma.projectCSAssignment.deleteMany({
      where: {
        projectId: body.projectId,
        userId: user.id,
      },
    })

    return NextResponse.json({
      success: true,
      action: 'unclaimed',
      projectId: body.projectId,
      userId: user.id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
