import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { scoreLead } from '@/services/ai'
import { z } from 'zod'
import { logger, getErrorMessage } from '@/lib/logger'

const ScoreLeadSchema = z.object({
  industry: z.string().min(1),
  projectType: z.string().min(1),
  budget: z.string().min(1),
  timeline: z.string().min(1),
  source: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowedRoles = ['ADMIN', 'SALES']
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body: unknown = await req.json()
    const data = ScoreLeadSchema.parse(body)
    const result = await scoreLead(data)
    return NextResponse.json({ data: result })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    logger.error('POST /api/ai/score-lead error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to score lead' }, { status: 500 })
  }
}
