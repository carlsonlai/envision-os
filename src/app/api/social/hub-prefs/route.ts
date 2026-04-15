/**
 * GET  /api/social/hub-prefs  – load persisted mode + task states
 * PATCH /api/social/hub-prefs  – save mode and/or task states
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

interface HubPrefsRow {
  mode: string
  task_states: Record<string, string> | string
}

async function ensureTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS social_hub_prefs (
      id           TEXT        PRIMARY KEY DEFAULT 'singleton',
      mode         TEXT        NOT NULL DEFAULT 'copilot',
      task_states  JSONB       NOT NULL DEFAULT '{}',
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await prisma.$executeRawUnsafe(`
    INSERT INTO social_hub_prefs (id, mode, task_states, updated_at)
    VALUES ('singleton', 'copilot', '{}', NOW())
    ON CONFLICT (id) DO NOTHING
  `)
}

async function getPrefs(): Promise<{ mode: string; taskStates: Record<string, string> }> {
  await ensureTable()
  const rows = await prisma.$queryRawUnsafe<HubPrefsRow[]>(
    'SELECT mode, task_states FROM social_hub_prefs WHERE id = $1 LIMIT 1',
    'singleton'
  )
  const row = rows[0]
  if (!row) return { mode: 'copilot', taskStates: {} }
  const taskStates =
    typeof row.task_states === 'string'
      ? (JSON.parse(row.task_states) as Record<string, string>)
      : row.task_states
  return { mode: row.mode, taskStates }
}

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const prefs = await getPrefs()
  return NextResponse.json({ success: true, data: prefs })
}

const patchSchema = z.object({
  mode:       z.enum(['autopilot', 'copilot']).optional(),
  taskStates: z.record(z.string(), z.string()).optional(),
})

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureTable()

  const body = await req.json() as unknown
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const sets: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (parsed.data.mode !== undefined) {
    sets.push(`mode = $${idx}`)
    values.push(parsed.data.mode)
    idx++
  }
  if (parsed.data.taskStates !== undefined) {
    sets.push(`task_states = $${idx}::jsonb`)
    values.push(JSON.stringify(parsed.data.taskStates))
    idx++
  }

  if (sets.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  sets.push('updated_at = NOW()')
  await prisma.$executeRawUnsafe(
    `UPDATE social_hub_prefs SET ${sets.join(', ')} WHERE id = 'singleton'`,
    ...values
  )

  return NextResponse.json({ success: true })
}
