import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSettings, updateSettings } from '@/services/settings'
import { z } from 'zod'
import { Role } from '@prisma/client'

// Only ADMIN can read/write system settings
function requireAdmin(role: string): boolean {
  return role === Role.ADMIN
}

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || !requireAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const settings = await getSettings()
  return NextResponse.json({ success: true, data: settings })
}

const updateSchema = z.object({
  autopilotMode: z.boolean().optional(),
  autoAssignEnabled: z.boolean().optional(),
  larkGanttEnabled: z.boolean().optional(),
  larkBriefEnabled: z.boolean().optional(),
  autoImportQuotes: z.boolean().optional(),
  autoImportInvoices: z.boolean().optional(),
  overloadThreshold: z.number().int().min(50).max(100).optional(),
  weeklyDigestDay: z.number().int().min(0).max(6).optional(),
  salesAutopilotEnabled: z.boolean().optional(),
})

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || !requireAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json() as unknown
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const settings = await updateSettings(parsed.data, session.user.id)
  return NextResponse.json({ success: true, data: settings })
}
