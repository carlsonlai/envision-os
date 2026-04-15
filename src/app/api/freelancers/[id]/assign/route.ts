import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { logger, getErrorMessage } from '@/lib/logger'

const AssignSchema = z.object({
  projectId: z.string().min(1),
  deliverableItemId: z.string().optional(),
  startedAt: z.string().datetime().optional(),
})

const ALLOWED_ROLES = ['ADMIN', 'CREATIVE_DIRECTOR', 'SENIOR_ART_DIRECTOR']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: freelancerId } = await params
    const body: unknown = await req.json()
    const parsed = AssignSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    // Complete any existing active assignment for same freelancer+project
    await prisma.freelancerAssignment.updateMany({
      where: {
        freelancerId,
        projectId: parsed.data.projectId,
        completedAt: null,
      },
      data: { completedAt: new Date() },
    })

    const assignment = await prisma.freelancerAssignment.create({
      data: {
        freelancerId,
        projectId: parsed.data.projectId,
        deliverableItemId: parsed.data.deliverableItemId,
        startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : new Date(),
      },
    })

    // Update freelancer status to ON_PROJECT
    await prisma.freelancer.update({
      where: { id: freelancerId },
      data: { status: 'ON_PROJECT' },
    })

    return NextResponse.json({ data: assignment }, { status: 201 })
  } catch (error) {
    logger.error('POST /api/freelancers/[id]/assign error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to assign freelancer' }, { status: 500 })
  }
}
