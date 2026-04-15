import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

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

type PayslipRow = {
  id: string
  user_id: string
  month: number
  year: number
  basic: number
  transport: number
  phone: number
  bonus: number
  epf_employee: number
  epf_employer: number
  socso_employee: number
  socso_employer: number
  eis: number
  pcb: number
  status: string
  paid_on: string | null
  created_at: Date
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

/**
 * GET /api/my/payslips
 * Returns the signed-in user's payslip history.
 */
export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensureTable()

  const rows = await prisma.$queryRawUnsafe<PayslipRow[]>(
    `SELECT * FROM payslip_records WHERE user_id = $1 ORDER BY year DESC, month DESC LIMIT 24`,
    session.user.id
  )

  const data = rows.map((r) => ({
    id: r.id,
    month: MONTH_NAMES[r.month - 1] ?? String(r.month),
    year: String(r.year),
    basic: r.basic,
    transport: r.transport,
    phone: r.phone,
    bonus: r.bonus,
    epfEmployee: r.epf_employee,
    epfEmployer: r.epf_employer,
    socsoEmployee: r.socso_employee,
    socsoEmployer: r.socso_employer,
    eisEmployee: r.eis,
    pcb: r.pcb,
    status: r.status as 'paid' | 'processing',
    paidOn: r.paid_on ?? '',
  }))

  return NextResponse.json({ data })
}
