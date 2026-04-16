/**
 * GET /api/admin/agents/incidents — list recent failsafe incidents
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const agent = url.searchParams.get('agent')
  const unresolvedOnly = url.searchParams.get('unresolved') === 'true'
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200)

  const incidents = await prisma.failsafeIncident.findMany({
    where: {
      ...(agent ? { agent: agent as never } : {}),
      ...(unresolvedOnly ? { resolvedAt: null } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({ data: incidents })
}
