/**
 * PATCH /api/cs/job-track/item/[id]
 *
 * Update a single deliverable item's job-track fields.
 * Allowed fields: description, quoteNo, invoiceNo, qteAmount,
 *                 paymentStatus, paymentEta, invoiceDate, statusNotes,
 *                 invoiceSentStatus, isConfirmed
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ensureSchemaUpToDate } from '@/lib/db-migrations'

const ALLOWED_ROLES = ['ADMIN', 'CLIENT_SERVICING']

interface PatchBody {
  description?: string
  quoteNo?: string | null
  invoiceNo?: string | null
  qteAmount?: number | null
  paymentStatus?: string | null
  paymentEta?: string | null
  invoiceDate?: string | null
  statusNotes?: string | null
  invoiceSentStatus?: string | null
  isConfirmed?: boolean
  assignedDesignerId?: string | null
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

  // Build SET clause dynamically from provided fields
  const allowed: (keyof PatchBody)[] = [
    'description', 'quoteNo', 'invoiceNo', 'qteAmount',
    'paymentStatus', 'paymentEta', 'invoiceDate', 'statusNotes',
    'invoiceSentStatus', 'isConfirmed', 'assignedDesignerId',
  ]

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

  values.push(id)
  const sql = `UPDATE "deliverable_items" SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING id`

  try {
    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(sql, ...values)
    if (!rows.length) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, id: rows[0].id })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
