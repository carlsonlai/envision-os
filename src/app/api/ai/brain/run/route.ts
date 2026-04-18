/**
 * POST /api/ai/brain/run
 *
 * Triggers an AI Brain pass. Returns the run id + decisions generated.
 *
 * Auth modes:
 *   - Bearer CRON_SECRET   → cron-triggered (e.g., hourly via Vercel Cron)
 *   - Admin session        → manual trigger from /admin/brain
 *
 * Non-admin authenticated users are rejected — this writes AgentDecision rows
 * that become operational directives downstream.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runBrain } from '@/lib/agents/brain'
import { logger, getErrorMessage } from '@/lib/logger'

const CRON_SECRET = process.env.CRON_SECRET

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get('authorization')
  const isCron = !!CRON_SECRET && auth === `Bearer ${CRON_SECRET}`

  let triggerKind: 'cron' | 'manual' = 'manual'

  if (isCron) {
    triggerKind = 'cron'
  } else {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }
  }

  try {
    const result = await runBrain({ triggerKind })
    return NextResponse.json({
      ok: true,
      data: {
        runId: result.runId,
        skipped: result.skipped,
        summary: result.summary,
        decisionCount: result.decisions.length,
        decisions: result.decisions,
      },
    })
  } catch (err) {
    logger.error('POST /api/ai/brain/run failed', { error: getErrorMessage(err) })
    return NextResponse.json(
      { error: 'Brain run failed', detail: getErrorMessage(err) },
      { status: 500 }
    )
  }
}

// Support GET for Vercel Cron (which defaults to GET)
export async function GET(req: NextRequest): Promise<NextResponse> {
  return POST(req)
}
