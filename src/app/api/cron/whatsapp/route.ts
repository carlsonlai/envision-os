/**
 * POST /api/cron/whatsapp
 *
 * Processes due scheduled WhatsApp messages from the
 * scheduled_whatsapp_messages table (written by reputation.ts).
 *
 * Call this every hour via an external cron service (e.g. cron-job.org,
 * Vercel Cron, GitHub Actions) with:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Example cron config (vercel.json):
 *   { "crons": [{ "path": "/api/cron/whatsapp", "schedule": "0 * * * *" }] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendMessage } from '@/services/whatsapp'

const CRON_SECRET = process.env.CRON_SECRET

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Verify caller is the cron scheduler (or internal call in dev)
  const auth = req.headers.get('authorization')
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.WHATSAPP_360DIALOG_API_KEY) {
    return NextResponse.json({ skipped: true, reason: 'WhatsApp not configured' })
  }

  interface DueMessage {
    id: string
    project_id: string
    phone: string
    message: string
    scheduled_at: string
  }

  let due: DueMessage[] = []
  try {
    due = await prisma.$queryRawUnsafe<DueMessage[]>(
      `SELECT id, project_id, phone, message, scheduled_at
       FROM scheduled_whatsapp_messages
       WHERE status = 'pending' AND scheduled_at <= NOW()
       ORDER BY scheduled_at ASC
       LIMIT 50`
    )
  } catch {
    // Table may not exist yet if no sequences have been triggered
    return NextResponse.json({ sent: 0, failed: 0, reason: 'Table not yet created' })
  }

  let sent = 0
  let failed = 0

  for (const msg of due) {
    try {
      await sendMessage(msg.phone, msg.message)
      await prisma.$executeRawUnsafe(
        `UPDATE scheduled_whatsapp_messages
         SET status = 'sent', sent_at = NOW()
         WHERE id = $1`,
        msg.id
      )
      sent++
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : 'Unknown error'
      await prisma.$executeRawUnsafe(
        `UPDATE scheduled_whatsapp_messages
         SET status = 'failed', error = $1
         WHERE id = $2`,
        error, msg.id
      ).catch(() => {}) // non-fatal
      failed++
    }
  }

  return NextResponse.json({
    ok: true,
    processed: due.length,
    sent,
    failed,
    processedAt: new Date().toISOString(),
  })
}

// Allow GET for health checks (returns table stats)
export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get('authorization')
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const stats = await prisma.$queryRawUnsafe<Array<{ status: string; count: string }>>(
      `SELECT status, COUNT(*)::text AS count
       FROM scheduled_whatsapp_messages
       GROUP BY status`
    )
    return NextResponse.json({ ok: true, stats })
  } catch {
    return NextResponse.json({ ok: true, stats: [], reason: 'Table not yet created' })
  }
}
