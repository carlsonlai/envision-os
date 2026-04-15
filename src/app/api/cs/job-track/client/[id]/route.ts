/**
 * PATCH /api/cs/job-track/client/[id]
 *
 * Update a client record's companyName (displayed as the company name in Job Track).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const ALLOWED_ROLES = ['ADMIN', 'CLIENT_SERVICING']

interface PatchBody {
  companyName?: string
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json() as PatchBody

  if (!body.companyName?.trim()) {
    return NextResponse.json({ error: 'companyName is required' }, { status: 400 })
  }

  try {
    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `UPDATE "clients" SET "companyName" = $1 WHERE id = $2 RETURNING id`,
      body.companyName.trim(),
      id
    )
    if (!rows.length) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, id: rows[0].id })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
