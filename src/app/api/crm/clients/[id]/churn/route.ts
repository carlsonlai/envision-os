import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { detectChurnRisk } from '@/services/crm'
import { logger, getErrorMessage } from '@/lib/logger'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Verify client exists before calling detectChurnRisk (which throws on not-found)
  const client = await prisma.client.findUnique({ where: { id }, select: { id: true } })
  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  try {
    const churnRisk = await detectChurnRisk(id)
    return NextResponse.json({ data: churnRisk })
  } catch (error) {
    logger.error('GET /api/crm/clients/[id]/churn error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to assess churn risk' }, { status: 500 })
  }
}
