/**
 * PATCH /api/admin/agents/incidents/[id] — resolve a failsafe incident
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { resolveIncident } from '@/lib/agents/failsafe'
import { z } from 'zod'
import { getErrorMessage } from '@/lib/logger'

const resolveSchema = z.object({
  note: z.string().max(500).optional(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await ctx.params

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const parsed = resolveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid payload', issues: parsed.error.issues }, { status: 400 })
  }

  try {
    await resolveIncident(id, session.user.id, parsed.data.note)
    return NextResponse.json({ status: 'resolved' })
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
