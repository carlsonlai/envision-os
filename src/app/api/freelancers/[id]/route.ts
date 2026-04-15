import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { FreelancerStatus } from '@prisma/client'
import { logger, getErrorMessage } from '@/lib/logger'

const UpdateFreelancerSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  skills: z.array(z.string()).optional(),
  hourlyRate: z.number().positive().optional(),
  status: z.nativeEnum(FreelancerStatus).optional(),
})

const ALLOWED_ROLES = ['ADMIN', 'CREATIVE_DIRECTOR']

export async function GET(
  _req: NextRequest,
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

    const { id } = await params
    const freelancer = await prisma.freelancer.findUnique({
      where: { id },
      include: {
        assignments: {
          where: { completedAt: null },
          select: { id: true, projectId: true },
        },
      },
    })

    if (!freelancer) {
      return NextResponse.json({ error: 'Freelancer not found' }, { status: 404 })
    }

    return NextResponse.json({ data: freelancer })
  } catch (error) {
    logger.error('GET /api/freelancers/[id] error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to fetch freelancer' }, { status: 500 })
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

    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body: unknown = await req.json()
    const parsed = UpdateFreelancerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const freelancer = await prisma.freelancer.update({
      where: { id },
      data: parsed.data,
    })

    return NextResponse.json({ data: freelancer })
  } catch (error) {
    logger.error('PATCH /api/freelancers/[id] error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to update freelancer' }, { status: 500 })
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

    // Complete all active assignments first
    await prisma.freelancerAssignment.updateMany({
      where: { freelancerId: id, completedAt: null },
      data: { completedAt: new Date() },
    })

    await prisma.freelancer.delete({ where: { id } })

    return NextResponse.json({ data: { deleted: true } })
  } catch (error) {
    logger.error('DELETE /api/freelancers/[id] error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to delete freelancer' }, { status: 500 })
  }
}
