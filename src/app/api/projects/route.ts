import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, getProjectsForRole, generateProjectCode, createAuditLog } from '@/lib/db'
import { isDesignerRole, canViewAllProjects } from '@/lib/permissions'
import { z } from 'zod'
import { logger, getErrorMessage } from '@/lib/logger'

const createProjectSchema = z.object({
  clientId: z.string().optional(),
  status: z
    .enum(['PROJECTED', 'ONGOING', 'COMPLETED', 'BILLED', 'PAID'])
    .default('PROJECTED'),
  quotedAmount: z.number().min(0).optional(),
  deadline: z.string().datetime().optional(),
  assignedCSId: z.string().optional(),
})

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { role, id: userId } = session.user
    const projects = await getProjectsForRole(role, userId)

    const res = NextResponse.json({ data: projects })
    res.headers.set('Cache-Control', 'private, max-age=15')
    return res
  } catch (error) {
    logger.error('GET /api/projects error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { role, id: userId } = session.user

    // Designers cannot create projects
    if (isDesignerRole(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createProjectSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { clientId, status, quotedAmount, deadline, assignedCSId } = parsed.data
    const code = await generateProjectCode()

    const project = await prisma.project.create({
      data: {
        code,
        clientId,
        status,
        quotedAmount: quotedAmount ?? 0,
        assignedCSId,
        deadline: deadline ? new Date(deadline) : undefined,
      },
    })

    // Create initial project brief
    await prisma.projectBrief.create({
      data: {
        projectId: project.id,
      },
    })

    await createAuditLog({
      projectId: project.id,
      action: 'PROJECT_CREATED',
      performedById: userId,
      metadata: { code, status, quotedAmount },
    })

    return NextResponse.json({ data: project }, { status: 201 })
  } catch (error) {
    logger.error('POST /api/projects error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
