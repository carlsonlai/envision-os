/**
 * POST /api/cron/sync-lark
 *
 * Syncs staff from Lark (Feishu) into the users table via syncLarkStaffToUsers().
 * Runs hourly on Vercel Cron. Protected by CRON_SECRET bearer token.
 */

import { NextRequest, NextResponse } from 'next/server'
import { syncLarkStaffToUsers } from '@/lib/lark-sync'

const CRON_SECRET = process.env.CRON_SECRET

export async function POST(req: NextRequest): Promise<NextResponse> {
    const auth = req.headers.get('authorization')
    if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

  if (!process.env.LARK_APP_ID || !process.env.LARK_APP_SECRET) {
        return NextResponse.json({ skipped: true, reason: 'Lark not configured' })
  }

  try {
        const result = await syncLarkStaffToUsers(false)
        return NextResponse.json({
                ok: true,
                ...result,
                processedAt: new Date().toISOString(),
        })
  } catch (err: unknown) {
        const error = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.json({ ok: false, error }, { status: 500 })
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    const auth = req.headers.get('authorization')
    if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({
          ok: true,
          configured: Boolean(process.env.LARK_APP_ID && process.env.LARK_APP_SECRET),
          schedule: '0 * * * * (hourly)',
    })
}
