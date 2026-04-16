/**
 * GET /api/cs/activity
 *
 * Returns recent project activity (audit logs) for the CS team.
 * Supports optional query params:
 *   scope=mine   — only logs for projects assigned to the current user
 *   limit=N      — number of logs (default 50, max 200)
 *   projectId=X  — filter to a specific project
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const ALLOWED_ROLES = ['ADMIN', 'CLIENT_SERVICING', 'CREATIVE_DIRECTOR', 'SENIOR_ART_DIRECTOR']

interface ActivityRow {
  id: string
  action: string
  metadata: unknown
  createdAt: string
  projectId: string | null
  projectCode: string | null
  clientName: string | null
  performerName: string | null
  performerRole: string | null
  deliverableItemId: string | null
  itemDescription: string | null
  itemType: string | null
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = req.nextUrl
  const scope = url.searchParams.get('scope')
  const projectId = url.searchParams.get('projectId')
  const limitParam = parseInt(url.searchParams.get('limit') ?? '50', 10)
  const limit = Math.min(Math.max(limitParam, 1), 200)

  try {
    const conditions: string[] = ['a."projectId" IS NOT NULL']
    const params: unknown[] = []
    let paramIdx = 0

    if (scope === 'mine') {
      paramIdx++
      conditions.push(`p."assignedCSId" = $${paramIdx}`)
      params.push(session.user.id)
    }

    if (projectId) {
      paramIdx++
      conditions.push(`a."projectId" = $${paramIdx}`)
      params.push(projectId)
    }

    paramIdx++
    const limitPlaceholder = `$${paramIdx}`
    params.push(limit)

    const sql = `
      SELECT
        a.id,
        a.action,
        a.metadata,
        a."createdAt",
        a."projectId",
        p.code        AS "projectCode",
        c."companyName" AS "clientName",
        u.name         AS "performerName",
        u.role         AS "performerRole",
        a."deliverableItemId",
        di.description AS "itemDescription",
        di."itemType"  AS "itemType"
      FROM audit_logs a
      LEFT JOIN projects p     ON p.id = a."projectId"
      LEFT JOIN clients c      ON c.id = p."clientId"
      LEFT JOIN users u        ON u.id = a."performedById"
      LEFT JOIN deliverable_items di ON di.id = a."deliverableItemId"
      WHERE ${conditions.join(' AND ')}
      ORDER BY a."createdAt" DESC
      LIMIT ${limitPlaceholder}
    `

    const rows = await prisma.$queryRawUnsafe<ActivityRow[]>(sql, ...params)

    // Serialize dates
    const activity = rows.map(r => ({
      ...r,
      createdAt: new Date(r.createdAt).toISOString(),
    }))

    return NextResponse.json({ data: activity })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
