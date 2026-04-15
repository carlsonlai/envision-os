/**
 * POST /api/admin/sync-lark
 *
 * Fetches all active staff from Lark and upserts them into the local User table.
 * On first call, adds the larkOpenId column to the users table if it doesn't exist.
 *
 * Query param: ?deactivate=true  →  also set active=false on users not found in Lark
 *
 * Restricted to ADMIN only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { syncLarkStaffToUsers } from '@/lib/lark-sync'

async function ensureLarkOpenIdColumn(): Promise<void> {
  // Idempotent — adds the column only if it doesn't exist yet
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "larkOpenId" TEXT UNIQUE
  `)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const deactivateMissing = searchParams.get('deactivate') === 'true'

  try {
    // Ensure the column exists before writing to it
    await ensureLarkOpenIdColumn()

    const result = await syncLarkStaffToUsers(deactivateMissing)

    return NextResponse.json({
      success: true,
      result,
      message: `Sync complete — ${result.created} created, ${result.updated} updated${result.deactivated > 0 ? `, ${result.deactivated} deactivated` : ''}${result.errors.length > 0 ? ` (${result.errors.length} errors)` : ''}`,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // GET returns current sync status: local user count vs Lark-linked count
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await ensureLarkOpenIdColumn()

    const [totalRows, linkedRows, activeRows] = await Promise.all([
      prisma.$queryRawUnsafe<[{ count: string }]>(`SELECT COUNT(*)::text AS count FROM "users"`),
      prisma.$queryRawUnsafe<[{ count: string }]>(`SELECT COUNT(*)::text AS count FROM "users" WHERE "larkOpenId" IS NOT NULL`),
      prisma.$queryRawUnsafe<[{ count: string }]>(`SELECT COUNT(*)::text AS count FROM "users" WHERE active = true`),
    ])

    const total      = parseInt(totalRows[0].count,  10)
    const larkLinked = parseInt(linkedRows[0].count,  10)
    const active     = parseInt(activeRows[0].count,  10)

    return NextResponse.json({
      success: true,
      stats: { total, larkLinked, active, notLinked: total - larkLinked },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
