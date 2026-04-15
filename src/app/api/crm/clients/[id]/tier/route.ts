import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { calculateClientLTV, updateClientTier } from '@/services/crm'
import { prisma } from '@/lib/db'
import { logger, getErrorMessage } from '@/lib/logger'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    const [ltv, tier, client] = await Promise.all([
      calculateClientLTV(id),
      updateClientTier(id),
      prisma.client.findUnique({ where: { id }, select: { companyName: true, tier: true } }),
    ])

    return NextResponse.json({ data: { clientId: id, companyName: client?.companyName, ltv, tier } })
  } catch (error) {
    logger.error('GET /api/crm/clients/[id]/tier error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to calculate tier' }, { status: 500 })
  }
}
