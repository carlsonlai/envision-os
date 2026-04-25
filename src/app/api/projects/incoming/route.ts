/**
 * GET /api/projects/incoming
 *
 * Returns ONGOING projects that came from Lark (larkFolderId set) and have
 * zero deliverable items. These are "pending setup" projects — synced from
 * a Lark group but not yet assigned any work items.
 *
 * Used by:
 *  - Designer queue page  →  "Incoming Projects" panel
 *  - CS workload page     →  "Needs Setup" panel
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logger, getErrorMessage } from '@/lib/logger'

const ALLOWED_ROLES = [
  'ADMIN',
  'CLIENT_SERVICING',
  'CREATIVE_DIRECTOR',
  'SENIOR_ART_DIRECTOR',
  'JUNIOR_ART_DIRECTOR',
  'GRAPHIC_DESIGNER',
  'JUNIOR_DESIGNER',
  'DESIGNER_3D',
  'MULTIMEDIA_DESIGNER',
  'DIGITAL_MARKETING',
]

export interface IncomingProject {
  id: string
  code: string
  clientName: string
  status: string
  deadline: string | null
  updatedAt: string
  larkFolderId: string
}

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const projects = await prisma.project.findMany({
      where: {
        status: { in: ['PROJECTED', 'ONGOING'] },
        larkFolderId: { not: null },
        deliverableItems: { none: {} },
      },
      select: {
        id: true,
        code: true,
        status: true,
        deadline: true,
        updatedAt: true,
        larkFolderId: true,
        client: { select: { companyName: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const data: IncomingProject[] = projects.map((p) => ({
      id: p.id,
      code: p.code,
      clientName: p.client?.companyName ?? 'Unknown',
      status: p.status,
      deadline: p.deadline?.toISOString() ?? null,
      updatedAt: p.updatedAt.toISOString(),
      larkFolderId: p.larkFolderId!,
    }))

    return NextResponse.json({ data })
  } catch (error) {
    logger.error('GET /api/projects/incoming error', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to fetch incoming projects' }, { status: 500 })
  }
}
