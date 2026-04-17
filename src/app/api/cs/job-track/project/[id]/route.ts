/**
 * PATCH /api/cs/job-track/project/[id]
 *
 * Update a project's staff assignment (assignedCSId) and/or status.
 * Allowed fields: assignedCSId, status
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ensureSchemaUpToDate } from '@/lib/db-migrations'

const ALLOWED_ROLES = ['ADMIN', 'CLIENT_SERVICING']

interface PatchBody {
  assignedCSId?: string | null
  status?: string
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensureSchemaUpToDate()

  const { id } = await params
  const body = await req.json() as PatchBody

  const allowed: (keyof PatchBody)[] = ['assignedCSId', 'status']

  const setClauses: string[] = []
  const values: unknown[] = []
  let idx = 1

  for (const key of allowed) {
    if (key in body) {
      setClauses.push(`"${key}" = $${idx}`)
      values.push(body[key] ?? null)
      idx++
    }
  }

  if (setClauses.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  // Always bump updatedAt
  setClauses.push(`"updatedAt" = NOW()`)
  values.push(id)

  const sql = `UPDATE "projects" SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING id`

  try {
    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(sql, ...values)
    if (!rows.length) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, id: rows[0].id })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * DELETE /api/cs/job-track/project/[id]
 *
 * Delete a project and all related records via cascade.
 * Only ADMIN and CLIENT_SERVICING roles can delete.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    // Use Prisma's cascading delete (schema has onDelete: Cascade for most relations)
    const project = await prisma.project.delete({
      where: { id },
      select: { id: true, code: true },
    })

    return NextResponse.json({ success: true, code: project.code })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // Check for not-found
    if (message.includes('Record to delete does not exist')) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
