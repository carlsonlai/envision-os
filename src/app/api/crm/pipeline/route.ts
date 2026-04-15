import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getLeadPipeline } from '@/services/crm'
import { logger, getErrorMessage } from '@/lib/logger'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const salesId = searchParams.get('salesId') ?? undefined

  try {
    const pipeline = await getLeadPipeline(salesId)
    return NextResponse.json({ data: pipeline })
  } catch (error) {
    logger.error('GET /api/crm/pipeline error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to fetch pipeline' }, { status: 500 })
  }
}
