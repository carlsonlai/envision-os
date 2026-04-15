import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { FreelancerStatus } from '@prisma/client'
import { logger, getErrorMessage } from '@/lib/logger'

const CreateFreelancerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  skills: z.array(z.string()).min(1),
  hourlyRate: z.number().positive(),
  status: z.nativeEnum(FreelancerStatus).default('AVAILABLE'),
})

const ALLOWED_ROLES = ['ADMIN', 'CREATIVE_DIRECTOR']

export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const freelancers = await prisma.freelancer.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        assignments: {
          where: { completedAt: null },
          select: { id: true, projectId: true },
        },
      },
    })

    return NextResponse.json({ data: freelancers })
  } catch (error) {
    logger.error('GET /api/freelancers error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to fetch freelancers' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body: unknown = await req.json()
    const parsed = CreateFreelancerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const freelancer = await prisma.freelancer.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        skills: parsed.data.skills,
        hourlyRate: parsed.data.hourlyRate,
        status: parsed.data.status,
      },
    })

    return NextResponse.json({ data: freelancer }, { status: 201 })
  } catch (error) {
    logger.error('POST /api/freelancers error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to create freelancer' }, { status: 500 })
  }
}
