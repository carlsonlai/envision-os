import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDesignerKPIs, getCSKPIs, getSalesKPIs } from '@/services/kpi'
import { prisma } from '@/lib/db'
import { logger, getErrorMessage } from '@/lib/logger'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId } = await params

  // Users can only see their own KPIs unless admin
  if (session.user.role !== 'ADMIN' && session.user.id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const period = (searchParams.get('period') ?? 'MONTH') as 'WEEK' | 'MONTH'

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const designerRoles = [
      'JUNIOR_ART_DIRECTOR',
      'GRAPHIC_DESIGNER',
      'JUNIOR_DESIGNER',
      'DESIGNER_3D',
      'DIGITAL_MARKETING',
      'SENIOR_ART_DIRECTOR',
      'CREATIVE_DIRECTOR',
    ]

    let kpis
    if (designerRoles.includes(user.role)) {
      kpis = await getDesignerKPIs(userId, period)
    } else if (user.role === 'CLIENT_SERVICING') {
      kpis = await getCSKPIs(userId, period)
    } else if (user.role === 'SALES') {
      kpis = await getSalesKPIs(userId, period)
    } else {
      return NextResponse.json({ error: 'KPI type not applicable for this role' }, { status: 400 })
    }

    return NextResponse.json({ data: kpis, role: user.role, period })
  } catch (error) {
    logger.error('GET /api/kpi/[userId] error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to fetch KPIs' }, { status: 500 })
  }
}
