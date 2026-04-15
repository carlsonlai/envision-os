import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getProjectProfitability } from '@/services/kpi'
import { logger, getErrorMessage } from '@/lib/logger'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowedRoles = ['ADMIN', 'CLIENT_SERVICING']
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { projectId } = await params
  try {
    const profitability = await getProjectProfitability(projectId)
    return NextResponse.json({ data: profitability })
  } catch (error) {
    logger.error('GET /api/kpi/profitability/[projectId] error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to calculate profitability' }, { status: 500 })
  }
}
