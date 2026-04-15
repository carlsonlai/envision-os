import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { triggerPostDeliverySequence } from '@/services/reputation'
import { logger, getErrorMessage } from '@/lib/logger'

export async function POST(
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
    await triggerPostDeliverySequence(projectId)
    return NextResponse.json({ success: true, message: 'Post-delivery sequence initiated' })
  } catch (error) {
    logger.error('POST /api/reputation/sequence/[projectId] error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to trigger sequence' }, { status: 500 })
  }
}
