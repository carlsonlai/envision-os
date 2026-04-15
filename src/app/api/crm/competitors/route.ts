import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logCompetitorLoss, getCompetitorIntelligence } from '@/services/crm'
import { z } from 'zod'
import { logger, getErrorMessage } from '@/lib/logger'

const LogLossSchema = z.object({
  leadId: z.string().min(1),
  competitor: z.string().min(1),
  reason: z.string().min(1),
})

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const report = await getCompetitorIntelligence()
    return NextResponse.json({ data: report })
  } catch (error) {
    logger.error('GET /api/crm/competitors error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to fetch competitor data' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowedRoles = ['ADMIN', 'SALES']
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body: unknown = await req.json()
    const { leadId, competitor, reason } = LogLossSchema.parse(body)
    await logCompetitorLoss(leadId, competitor, reason)
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    logger.error('POST /api/crm/competitors error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to log competitor loss' }, { status: 500 })
  }
}
