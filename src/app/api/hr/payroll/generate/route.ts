import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Role } from '@prisma/client'

async function ensureTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS payslip_records (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id      TEXT NOT NULL,
      month        INT  NOT NULL,
      year         INT  NOT NULL,
      basic        FLOAT NOT NULL DEFAULT 0,
      transport    FLOAT NOT NULL DEFAULT 0,
      phone        FLOAT NOT NULL DEFAULT 0,
      bonus        FLOAT NOT NULL DEFAULT 0,
      epf_employee FLOAT NOT NULL DEFAULT 0,
      epf_employer FLOAT NOT NULL DEFAULT 0,
      socso_employee FLOAT NOT NULL DEFAULT 0,
      socso_employer FLOAT NOT NULL DEFAULT 0,
      eis          FLOAT NOT NULL DEFAULT 0,
      pcb          FLOAT NOT NULL DEFAULT 0,
      status       TEXT  NOT NULL DEFAULT 'processing',
      paid_on      TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, month, year)
    )
  `)
}

type GenerateBody = {
  /** Internal DB user IDs (or Lark openIds for Lark-only staff) */
  userIds: string[]
  month: number
  year: number
  /** Map of userId → bonus amount */
  bonuses?: Record<string, number>
  /** Map of userId → { basic, transport, phone, epfEmployee, epfEmployer, socsoEmployee, socsoEmployer, eis, pcb } */
  payrollData: Record<string, {
    basic: number
    transport: number
    phone: number
    epfEmployee: number
    epfEmployer: number
    socsoEmployee: number
    socsoEmployer: number
    eis: number
    pcb: number
  }>
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function lastDayOfMonth(month: number, year: number): string {
  const d = new Date(year, month, 0) // day 0 of next month = last day of this month
  return `${MONTH_NAMES[month - 1]} ${d.getDate()}, ${year}`
}

/**
 * POST /api/hr/payroll/generate
 * Generates and persists payslip records for the given users + month/year.
 * Admin only.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await ensureTable()

  const body = (await req.json()) as GenerateBody
  const { userIds, month, year, bonuses = {}, payrollData } = body

  if (!userIds?.length || !month || !year || !payrollData) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const paidOn = lastDayOfMonth(month, year)
  const generated: string[] = []
  const errors: string[] = []

  for (const userId of userIds) {
    const pd = payrollData[userId]
    if (!pd) {
      errors.push(`No payroll data for ${userId}`)
      continue
    }

    const bonus = bonuses[userId] ?? 0

    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO payslip_records
          (user_id, month, year, basic, transport, phone, bonus,
           epf_employee, epf_employer, socso_employee, socso_employer, eis, pcb,
           status, paid_on)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'processing',$14)
         ON CONFLICT (user_id, month, year)
         DO UPDATE SET
           basic = EXCLUDED.basic,
           transport = EXCLUDED.transport,
           phone = EXCLUDED.phone,
           bonus = EXCLUDED.bonus,
           epf_employee = EXCLUDED.epf_employee,
           epf_employer = EXCLUDED.epf_employer,
           socso_employee = EXCLUDED.socso_employee,
           socso_employer = EXCLUDED.socso_employer,
           eis = EXCLUDED.eis,
           pcb = EXCLUDED.pcb,
           status = 'processing',
           paid_on = EXCLUDED.paid_on`,
        userId, month, year,
        pd.basic, pd.transport, pd.phone, bonus,
        pd.epfEmployee, pd.epfEmployer, pd.socsoEmployee, pd.socsoEmployer, pd.eis, pd.pcb,
        paidOn
      )
      generated.push(userId)
    } catch (err) {
      errors.push(`${userId}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({ ok: true, generated: generated.length, errors })
}

/**
 * PATCH /api/hr/payroll/generate
 * Mark a payslip as paid. Admin only.
 */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, month, year } = (await req.json()) as {
    userId?: string
    month?: number
    year?: number
  }

  if (!userId || !month || !year) {
    return NextResponse.json({ error: 'userId, month, year required' }, { status: 400 })
  }

  await prisma.$executeRawUnsafe(
    `UPDATE payslip_records SET status = 'paid' WHERE user_id = $1 AND month = $2 AND year = $3`,
    userId, month, year
  )

  return NextResponse.json({ ok: true })
}
