import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

async function ensureTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id     TEXT NOT NULL,
      employee    TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT '',
      dept        TEXT NOT NULL DEFAULT '',
      type        TEXT NOT NULL,
      from_date   DATE NOT NULL,
      to_date     DATE NOT NULL,
      days        INT  NOT NULL DEFAULT 1,
      reason      TEXT,
      status      TEXT NOT NULL DEFAULT 'pending',
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_by TEXT,
      reviewed_at TIMESTAMPTZ
    )
  `)
}

type LeaveRow = {
  id: string
  user_id: string
  employee: string
  role: string
  dept: string
  type: string
  from_date: Date
  to_date: Date
  days: number
  reason: string | null
  status: string
  applied_at: Date
  reviewed_by: string | null
  reviewed_at: Date | null
}

function fmtDate(d: Date | null): string {
  if (!d) return ''
  const diff = Date.now() - d.getTime()
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

/**
 * GET /api/hr/leave
 * Returns all leave requests. Admin/HR see all; staff see their own.
 */
export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureTable()

  const isAdmin = session.user.role === 'ADMIN'
  const rows = await prisma.$queryRawUnsafe<LeaveRow[]>(
    isAdmin
      ? `SELECT * FROM leave_requests ORDER BY applied_at DESC LIMIT 200`
      : `SELECT * FROM leave_requests WHERE user_id = $1 ORDER BY applied_at DESC`,
    ...(isAdmin ? [] : [session.user.id])
  )

  const data = rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    employee: r.employee,
    role: r.role,
    dept: r.dept,
    type: r.type,
    from: r.from_date instanceof Date ? r.from_date.toISOString().slice(0, 10) : String(r.from_date).slice(0, 10),
    to: r.to_date instanceof Date ? r.to_date.toISOString().slice(0, 10) : String(r.to_date).slice(0, 10),
    days: r.days,
    reason: r.reason ?? '',
    status: r.status,
    appliedAt: fmtDate(r.applied_at),
    reviewedBy: r.reviewed_by ?? null,
    reviewedAt: r.reviewed_at ? fmtDate(r.reviewed_at) : null,
  }))

  return NextResponse.json({ data })
}

/**
 * POST /api/hr/leave
 * Submit a new leave request (any authenticated staff).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureTable()

  const body = (await req.json()) as {
    type?: string
    from?: string
    to?: string
    days?: number
    reason?: string
  }

  if (!body.type || !body.from || !body.to) {
    return NextResponse.json({ error: 'type, from, and to are required' }, { status: 400 })
  }

  // Resolve user name + role for display
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, role: true },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const fromDate = new Date(body.from)
  const toDate = new Date(body.to)
  const days =
    body.days ??
    Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)

  const rows = await prisma.$queryRawUnsafe<LeaveRow[]>(
    `INSERT INTO leave_requests (user_id, employee, role, dept, type, from_date, to_date, days, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    session.user.id,
    user.name,
    user.role,
    '',
    body.type,
    body.from,
    body.to,
    days,
    body.reason ?? null
  )

  const r = rows[0]
  return NextResponse.json({
    data: {
      id: r.id,
      userId: r.user_id,
      employee: r.employee,
      type: r.type,
      from: body.from,
      to: body.to,
      days: r.days,
      reason: r.reason ?? '',
      status: r.status,
      appliedAt: 'Just now',
    },
  }, { status: 201 })
}
