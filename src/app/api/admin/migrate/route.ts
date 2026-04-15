import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ensureSchemaUpToDate } from '@/lib/db-migrations'

export async function POST(): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const log = await ensureSchemaUpToDate()
  return NextResponse.json({ success: true, log })
}
