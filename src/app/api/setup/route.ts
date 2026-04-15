// ONE-TIME SETUP ENDPOINT — DELETE AFTER USE
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: { email: true, role: true, active: true },
      take: 5,
    })
    return NextResponse.json({ ok: true, count: users.length, roles: users.map(u => u.role) })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg.substring(0, 300) }, { status: 500 })
  }
}
