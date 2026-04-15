import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Role } from '@prisma/client'

async function ensureTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS payroll_config (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id      TEXT NOT NULL UNIQUE,
      basic        FLOAT NOT NULL DEFAULT 0,
      transport    FLOAT NOT NULL DEFAULT 0,
      phone        FLOAT NOT NULL DEFAULT 0,
      bank         TEXT  NOT NULL DEFAULT '',
      account_masked TEXT NOT NULL DEFAULT '',
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

type PayrollRow = {
  user_id: string
  basic: number
  transport: number
  phone: number
  bank: string
  account_masked: string
}

/** Standard statutory deductions based on Malaysian payroll rules */
function calcStatutory(basic: number) {
  const gross = basic  // simplified: gross = basic (allowances added separately)
  const epfEmp = Math.round(gross * 0.11 * 100) / 100
  const epfEmr = Math.round(gross * 0.12 * 100) / 100
  // SOCSO capped at RM 5,000
  const socsoBase = Math.min(gross, 5000)
  const socsoEmp = socsoBase <= 4000 ? 14.75 : 19.75
  const socsoEmr = Math.round(socsoBase * 0.0175 * 100) / 100
  const eis = Math.round(Math.min(gross, 5000) * 0.002 * 100) / 100
  // Simplified PCB (income tax deduction) estimate
  const pcb =
    gross > 8000 ? Math.round(gross * 0.12) :
    gross > 5000 ? Math.round(gross * 0.08) :
    gross > 3500 ? Math.round(gross * 0.04) : 0
  return { epfEmp, epfEmr, socsoEmp, socsoEmr, eis, pcb }
}

/**
 * GET /api/hr/payroll
 * Returns all active staff with their payroll configuration.
 * Auth: ADMIN only.
 */
export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await ensureTable()

  // All active non-CLIENT staff
  const users = await prisma.user.findMany({
    where: { active: true, role: { not: Role.CLIENT } },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  })

  if (users.length === 0) {
    return NextResponse.json({ data: [] })
  }

  const userIds = users.map((u) => u.id)
  const placeholders = userIds.map((_, i) => `$${i + 1}`).join(', ')

  const configs = await prisma.$queryRawUnsafe<PayrollRow[]>(
    `SELECT user_id, basic, transport, phone, bank, account_masked
     FROM payroll_config
     WHERE user_id IN (${placeholders})`,
    ...userIds
  )

  const configMap = new Map(configs.map((c) => [c.user_id, c]))

  const data = users.map((u) => {
    const cfg = configMap.get(u.id)
    const basic = cfg?.basic ?? 0
    const transport = cfg?.transport ?? 0
    const phone = cfg?.phone ?? 0
    const stat = calcStatutory(basic)
    const gross = basic + transport + phone
    const netPay = gross - stat.epfEmp - stat.socsoEmp - stat.eis - stat.pcb

    return {
      id: u.id,
      name: u.name,
      role: u.role,
      basic,
      transport,
      phone,
      epfEmployee: stat.epfEmp,
      epfEmployer: stat.epfEmr,
      socsoEmployee: stat.socsoEmp,
      socsoEmployer: stat.socsoEmr,
      eisEmployee: stat.eis,
      pcb: stat.pcb,
      gross,
      netPay: Math.round(netPay * 100) / 100,
      bank: cfg?.bank ?? '—',
      account: cfg?.account_masked ?? '—',
      configured: !!cfg,
    }
  })

  return NextResponse.json({ data })
}

/**
 * PUT /api/hr/payroll
 * Upsert payroll config for a specific user. Admin only.
 */
export async function PUT(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await ensureTable()

  const body = (await req.json()) as {
    userId?: string
    basic?: number
    transport?: number
    phone?: number
    bank?: string
    accountMasked?: string
  }

  if (!body.userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO payroll_config (user_id, basic, transport, phone, bank, account_masked, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET
       basic = EXCLUDED.basic,
       transport = EXCLUDED.transport,
       phone = EXCLUDED.phone,
       bank = EXCLUDED.bank,
       account_masked = EXCLUDED.account_masked,
       updated_at = NOW()`,
    body.userId,
    body.basic ?? 0,
    body.transport ?? 0,
    body.phone ?? 0,
    body.bank ?? '',
    body.accountMasked ?? ''
  )

  return NextResponse.json({ ok: true })
}
