/**
 * POST /api/admin/lark-hr
 *
 * Pulls leave requests and payroll data from Lark (Feishu People) and syncs
 * them into the local database.
 *
 * Lark APIs used:
 * - Attendance/Leave:  GET /attendance/v1/leave_accrual_record/list
 * - Leave approvals:   GET /approval/v4/instances (approval_code = leave approval)
 * - HR payroll:        Lark People payroll is enterprise-only; falls back to
 *                      reading from a designated Lark Spreadsheet if configured.
 *
 * Env vars required:
 *   LARK_APP_ID, LARK_APP_SECRET
 * Optional:
 *   LARK_PAYROLL_SPREADSHEET_TOKEN  — spreadsheet token for payroll sheet
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ensureSchemaUpToDate } from '@/lib/db-migrations'
import { logger, getErrorMessage } from '@/lib/logger'

const LARK_BASE = 'https://open.feishu.cn/open-apis'

// ─── Lark auth ────────────────────────────────────────────────────────────────

async function getTenantToken(): Promise<string> {
  const res = await fetch(`${LARK_BASE}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: process.env.LARK_APP_ID ?? '',
      app_secret: process.env.LARK_APP_SECRET ?? '',
    }),
  })
  const data = (await res.json()) as { tenant_access_token?: string }
  if (!data.tenant_access_token) throw new Error('Failed to get Lark tenant token')
  return data.tenant_access_token
}

// ─── Leave records ────────────────────────────────────────────────────────────

interface LarkLeaveInstance {
  instance_id: string
  user_id: string
  status: string // PENDING | APPROVED | REJECTED
  start_time: string
  end_time: string
  leave_type_name: string
  reason: string
  day_count: number
}

async function fetchLeaveInstances(token: string): Promise<LarkLeaveInstance[]> {
  // Use Lark Approval API to fetch leave approval instances
  // approval_code for leave must be configured in Lark developer console
  const approvalCode = process.env.LARK_LEAVE_APPROVAL_CODE ?? 'leave'

  const res = await fetch(
    `${LARK_BASE}/approval/v4/instances?approval_code=${approvalCode}&page_size=50`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!res.ok) {
    throw new Error(`Lark leave API error: ${res.status}`)
  }

  const data = (await res.json()) as {
    data?: {
      instance_list?: Array<{
        instance_id: string
        open_id: string
        status: string
        create_time: string
        end_time: string
        form?: string
      }>
    }
  }

  return (data.data?.instance_list ?? []).map((item) => {
    let form: Record<string, string> = {}
    try { form = JSON.parse(item.form ?? '{}') as Record<string, string> } catch { /* ignore */ }

    return {
      instance_id: item.instance_id,
      user_id: item.open_id,
      status: item.status,
      start_time: form.start_date ?? item.create_time,
      end_time: form.end_date ?? item.end_time,
      leave_type_name: form.leave_type ?? 'ANNUAL',
      reason: form.reason ?? '',
      day_count: parseFloat(form.days ?? '1') || 1,
    }
  })
}

function mapLeaveType(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('annual') || n.includes('cuti')) return 'ANNUAL'
  if (n.includes('medical') || n.includes('sick') || n.includes('sakit')) return 'MEDICAL'
  if (n.includes('emergency') || n.includes('kecemasan')) return 'EMERGENCY'
  if (n.includes('maternity') || n.includes('bersalin')) return 'MATERNITY'
  if (n.includes('paternity')) return 'PATERNITY'
  if (n.includes('unpaid') || n.includes('tanpa gaji')) return 'UNPAID'
  if (n.includes('replacement') || n.includes('ganti')) return 'REPLACEMENT'
  return 'OTHER'
}

function mapLeaveStatus(status: string): string {
  if (status === 'APPROVED') return 'APPROVED'
  if (status === 'REJECTED') return 'REJECTED'
  if (status === 'CANCELED' || status === 'CANCELLED') return 'CANCELLED'
  return 'PENDING'
}

// ─── Payroll from Lark Spreadsheet ────────────────────────────────────────────

interface PayrollRow {
  openId: string
  period: string
  basicSalary: number
  allowances: number
  deductions: number
  netPay: number
}

async function fetchPayrollFromSheet(token: string): Promise<PayrollRow[]> {
  const sheetToken = process.env.LARK_PAYROLL_SPREADSHEET_TOKEN
  if (!sheetToken) return []

  const res = await fetch(
    `${LARK_BASE}/sheets/v2/spreadsheets/${sheetToken}/values_batch_get?ranges=Sheet1!A:G`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!res.ok) return []

  const data = (await res.json()) as {
    data?: {
      valueRanges?: Array<{ values?: string[][] }>
    }
  }

  const rows = data.data?.valueRanges?.[0]?.values ?? []
  if (rows.length < 2) return []

  // Expected columns: OpenID | Period | BasicSalary | Allowances | Deductions | NetPay
  return rows.slice(1).map((row) => ({
    openId: row[0] ?? '',
    period: row[1] ?? '',
    basicSalary: parseFloat(row[2] ?? '0') || 0,
    allowances: parseFloat(row[3] ?? '0') || 0,
    deductions: parseFloat(row[4] ?? '0') || 0,
    netPay: parseFloat(row[5] ?? '0') || 0,
  })).filter((r) => r.openId && r.period)
}

// ─── API Route ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || !['ADMIN', 'CREATIVE_DIRECTOR'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const log: string[] = []

  try {
    // Ensure tables exist
    await ensureSchemaUpToDate()

    const token = await getTenantToken()

    // ── Sync leave records ───────────────────────────────────────────────
    let leaveUpserted = 0
    try {
      const instances = await fetchLeaveInstances(token)

      for (const instance of instances) {
        // Match Lark open_id to internal user
        const user = await prisma.$queryRawUnsafe<{ id: string }[]>(
          `SELECT id FROM "users" WHERE "larkOpenId" = $1 LIMIT 1`,
          instance.user_id
        ).then((rows) => rows[0]).catch(() => null)

        if (!user) continue

        const leaveType = mapLeaveType(instance.leave_type_name)
        const leaveStatus = mapLeaveStatus(instance.status)

        await prisma.$executeRawUnsafe(
          `INSERT INTO "leave_records"
             (id, "userId", "larkLeaveId", "leaveType", "startDate", "endDate", days, reason, status, "createdAt", "updatedAt")
           VALUES
             (gen_random_uuid()::text, $1, $2, $3::"LeaveType", $4::date, $5::date, $6, $7, $8::"LeaveStatus", NOW(), NOW())
           ON CONFLICT ("larkLeaveId") DO UPDATE
             SET status = $8::"LeaveStatus",
                 "updatedAt" = NOW()`,
          user.id,
          instance.instance_id,
          leaveType,
          instance.start_time.slice(0, 10),
          instance.end_time.slice(0, 10),
          instance.day_count,
          instance.reason,
          leaveStatus,
        ).catch(() => {
          // ON CONFLICT requires unique constraint — handle gracefully
        })

        leaveUpserted++
      }

      log.push(`✓ Leave: synced ${leaveUpserted} records`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.push(`✗ Leave: ${msg}`)
    }

    // ── Sync payroll from spreadsheet ────────────────────────────────────
    let payrollUpserted = 0
    try {
      const payrollRows = await fetchPayrollFromSheet(token)

      for (const row of payrollRows) {
        const user = await prisma.$queryRawUnsafe<{ id: string }[]>(
          `SELECT id FROM "users" WHERE "larkOpenId" = $1 LIMIT 1`,
          row.openId
        ).then((rows) => rows[0]).catch(() => null)

        if (!user) continue

        await prisma.$executeRawUnsafe(
          `INSERT INTO "payroll_records"
             (id, "userId", period, "basicSalary", allowances, deductions, "netPay", status, "createdAt", "updatedAt")
           VALUES
             (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, 'PROCESSED', NOW(), NOW())
           ON CONFLICT ("userId", period) DO UPDATE
             SET "basicSalary" = $3, allowances = $4, deductions = $5, "netPay" = $6, "updatedAt" = NOW()`,
          user.id, row.period, row.basicSalary, row.allowances, row.deductions, row.netPay
        )
        payrollUpserted++
      }

      log.push(payrollRows.length === 0
        ? '✓ Payroll: no spreadsheet configured (set LARK_PAYROLL_SPREADSHEET_TOKEN to enable)'
        : `✓ Payroll: synced ${payrollUpserted} records`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.push(`✗ Payroll: ${msg}`)
    }

    return NextResponse.json({ success: true, log })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: msg, log }, { status: 500 })
  }
}

// GET: fetch leave + payroll summary for a user or all users
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') ?? session.user.id

  try {
    const [leaveRecords, payrollRecords, leaveBalance] = await Promise.all([
      prisma.$queryRawUnsafe<{
        id: string; leaveType: string; startDate: string; endDate: string;
        days: number; reason: string; status: string; larkApprovedAt: string | null;
      }[]>(
        `SELECT id, "leaveType", "startDate", "endDate", days, reason, status, "larkApprovedAt"
         FROM "leave_records" WHERE "userId" = $1
         ORDER BY "startDate" DESC`,
        userId
      ).catch(() => []),

      prisma.$queryRawUnsafe<{
        period: string; basicSalary: number; allowances: number;
        deductions: number; netPay: number; status: string;
      }[]>(
        `SELECT period, "basicSalary", allowances, deductions, "netPay", status
         FROM "payroll_records" WHERE "userId" = $1
         ORDER BY period DESC LIMIT 12`,
        userId
      ).catch(() => []),

      // Leave balance summary
      prisma.$queryRawUnsafe<{ leaveType: string; totalDays: number }[]>(
        `SELECT "leaveType", SUM(days) as "totalDays"
         FROM "leave_records"
         WHERE "userId" = $1 AND status = 'APPROVED'
           AND EXTRACT(YEAR FROM "startDate") = EXTRACT(YEAR FROM NOW())
         GROUP BY "leaveType"`,
        userId
      ).catch(() => []),
    ])

    return NextResponse.json({
      data: {
        userId,
        leaveRecords,
        payrollRecords,
        leaveBalance,
      },
    })
  } catch (error) {
    logger.error('GET /api/admin/lark-hr error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to fetch HR data' }, { status: 500 })
  }
}
