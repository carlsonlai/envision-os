import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, createAuditLog } from '@/lib/db'
import { isDesignerRole } from '@/lib/permissions'
import { z } from 'zod'
import { logger, getErrorMessage } from '@/lib/logger'

const updateBriefSchema = z.object({
  packageType: z.string().optional(),
  specialInstructions: z.string().optional(),
  styleNotes: z.string().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'RUSH']).optional(),
  qualityGateScore: z.number().min(0).max(100).optional(),
  qualityGatePassed: z.boolean().optional(),
})

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
    const brief = await prisma.projectBrief.findUnique({
      where: { projectId: id },
    })

    if (!brief) {
      return NextResponse.json({ error: 'Brief not found' }, { status: 404 })
    }

    return NextResponse.json({ data: brief })
  } catch (error) {
    logger.error('GET /api/projects/[id]/brief error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to fetch brief' }, { status: 500 })
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

    const { role, id: userId } = session.user

    // Only CS, CD, SAD, and Admin can update briefs
    const ALLOWED_BRIEF_ROLES = ['ADMIN', 'CLIENT_SERVICING', 'CREATIVE_DIRECTOR', 'SENIOR_ART_DIRECTOR']
    if (!ALLOWED_BRIEF_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const parsed = updateBriefSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const updateData = { ...parsed.data } as Record<string, unknown>

    // If all 3 main fields are being set, mark as completed by CS
    if (parsed.data.packageType && parsed.data.specialInstructions && parsed.data.styleNotes) {
      updateData.completedByCSId = userId
      updateData.completedByCSAt = new Date()
    }

    const brief = await prisma.projectBrief.update({
      where: { projectId: id },
      data: updateData,
    })

    await createAuditLog({
      projectId: id,
      action: 'BRIEF_UPDATED',
      performedById: userId,
      metadata: parsed.data as Record<string, unknown>,
    })

    return NextResponse.json({ data: brief })
  } catch (error) {
    logger.error('PATCH /api/projects/[id]/brief error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to update brief' }, { status: 500 })
  }
}
