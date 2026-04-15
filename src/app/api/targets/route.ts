import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { logger, getErrorMessage } from '@/lib/logger'

const CreateTargetSchema = z.object({
  metric: z.string().min(1),
  targetValue: z.number().positive(),
  period: z.string().min(1),
  deadline: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') ?? undefined

  try {
    const targets = await prisma.target.findMany({
      where: period ? { period } : {},
      include: { setBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(
      { data: targets },
      {
        headers: {
          // Targets change rarely (admin-set goals). Cache aggressively at the
          // edge per-user; POST/PUT handlers don't need to invalidate because
          // the 60s TTL is short enough.
          'Cache-Control':
            'private, s-maxage=60, stale-while-revalidate=300',
        },
      },
    )
  } catch (error) {
    logger.error('GET /api/targets error', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to fetch targets' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only admins can set targets' }, { status: 403 })
  }

  try {
    const body: unknown = await req.json()
    const data = CreateTargetSchema.parse(body)

    const target = await prisma.target.create({
      data: {
        setById: session.user.id,
        metric: data.metric,
        targetValue: data.targetValue,
        period: data.period,
        deadline: data.deadline ? new Date(data.deadline) : undefined,
      },
    })

    return NextResponse.json({ data: target }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    logger.error('POST /api/targets error', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to create target' }, { status: 500 })
  }
}
