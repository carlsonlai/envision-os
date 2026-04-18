/**
 * GET/POST /api/cron/profit-sweep
 *
 * Runs the Profit Optimization Engine over all active projects.
 * Recomputes Project.profitability and writes leak decisions.
 *
 * Intended cadence: hourly (scope overruns, overdue unbilled surface daily).
 * Protected by CRON_SECRET bearer token; admin sessions may invoke manually.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runProfitSweep } from '@/lib/agents/profit-engine'
import { logger, getErrorMessage } from '@/lib/logger'

const CRON_SECRET = process.env.CRON_SECRET

async function handle(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get('authorization')
  const isCron = !!CRON_SECRET && auth === `Bearer ${CRON_SECRET}`

  let triggerKind: 'cron' | 'manual' = 'cron'

  if (!isCron) {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }
    triggerKind = 'manual'
  }

  try {
    const result = await runProfitSweep({ triggerKind })
    return NextResponse.json({
      ok: true,
      data: {
        runId: result.runId,
        skipped: result.skipped,
        summary: result.summary,
        projectCount: result.projects.length,
        clientCount: result.clients.length,
        leakCount: result.leaks.length,
        projects: result.projects,
        clients: result.clients,
        leaks: result.leaks,
      },
    })
  } catch (err) {
    logger.error('profit-sweep endpoint failed', { error: getErrorMessage(err) })
    return NextResponse.json(
      { error: 'Profit sweep failed', detail: getErrorMessage(err) },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handle(req)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handle(req)
}
