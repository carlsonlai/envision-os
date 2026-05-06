import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { BriefStage } from '@prisma/client'
import { z } from 'zod'
import { logger, getErrorMessage } from '@/lib/logger'

const ALLOWED_ROLES = ['ADMIN', 'CLIENT_SERVICING', 'CREATIVE_DIRECTOR', 'SENIOR_ART_DIRECTOR']

const assignSchema = z.object({
  assignedCDId: z.string().optional(),
  action: z.enum(['ASSIGN_CD', 'SEND_TO_CD', 'MARK_CD_RECEIVED', 'SEND_TO_AD']),
})

/**
 * GET /api/projects/[id]/assign-cd
 * Returns the project's current CD/AD assignment, brief stage, and available CD users.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const [project, brief, cdUsers] = await Promise.all([
      prisma.project.findUnique({
        where: { id },
        select: {
          id: true,
          assignedCDId: true,
          assignedADId: true,
          assignedCD: { select: { id: true, name: true, role: true } },
          assignedAD: { select: { id: true, name: true, role: true } },
        },
      }),
      prisma.projectBrief.findUnique({
        where: { projectId: id },
        select: {
          briefStage: true,
          completedByCSAt: true,
          sentToCDAt: true,
          cdReceivedAt: true,
          sentToADAt: true,
          adReceivedAt: true,
          designerAssignedAt: true,
        },
      }),
      prisma.$queryRawUnsafe<Array<{ id: string; name: string; role: string }>>(
        `SELECT id, name, role FROM "users"
         WHERE role = 'CREATIVE_DIRECTOR' AND active = true
         ORDER BY name ASC`
      ),
    ])

    return NextResponse.json({ data: { project, brief, cdUsers } })
  } catch (error) {
    logger.error('GET /api/projects/[id]/assign-cd error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to fetch assignment data' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/assign-cd
 * Handles brief chain stage transitions initiated by CS or Admin.
 *
 * action = ASSIGN_CD    → sets project.assignedCDId (no stage change)
 * action = SEND_TO_CD   → sets project.assignedCDId (if provided) + brief stage → CD_REVIEW + sentToCDAt
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Only CS and Admin can initiate CS→CD handoff
    const CS_ALLOWED = ['ADMIN', 'CLIENT_SERVICING']
    if (!CS_ALLOWED.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Forbidden: only CS or Admin can assign CD and send briefs' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await req.json()
    const parsed = assignSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { assignedCDId, action } = parsed.data

    if (action === 'ASSIGN_CD') {
      if (!assignedCDId) {
        return NextResponse.json({ error: 'assignedCDId is required for ASSIGN_CD' }, { status: 400 })
      }
      await prisma.project.update({
        where: { id },
        data: { assignedCDId },
      })
    } else if (action === 'SEND_TO_CD') {
      // Optionally update CD assignment
      if (assignedCDId) {
        await prisma.project.update({
          where: { id },
          data: { assignedCDId },
        })
      }
      // Transition brief stage to CD_REVIEW
      await prisma.projectBrief.upsert({
        where: { projectId: id },
        update: {
          briefStage: BriefStage.CD_REVIEW,
          sentToCDAt: new Date(),
        },
        create: {
          projectId: id,
          briefStage: BriefStage.CD_REVIEW,
          sentToCDAt: new Date(),
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('POST /api/projects/[id]/assign-cd error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 })
  }
}
