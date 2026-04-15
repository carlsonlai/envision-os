import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * GET /api/social/config?key=<key>
 * Returns a stored JSON value from the SocialConfig table.
 * Keys written by the autopilot engine: 'hashtag_sets', 'optimisation_report'
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = req.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'Missing key param' }, { status: 400 })

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SocialConfig" (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    const rows = await prisma.$queryRawUnsafe<Array<{ value: unknown }>>(
      `SELECT value FROM "SocialConfig" WHERE key = $1`,
      key
    )

    const data = rows[0]?.value ?? null
    return NextResponse.json({ success: true, data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
