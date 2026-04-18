import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listPayments } from '@/services/bukku'
import { Role } from '@prisma/client'

const ADMIN_ROLES: Role[] = [Role.ADMIN, Role.CLIENT_SERVICING, Role.SALES]

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !ADMIN_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = Number(searchParams.get('page') ?? '1')
    const status = searchParams.get('status') ?? undefined

    const result = await listPayments({ page, per_page: 50, status })

    return NextResponse.json({ success: true, data: result.data, meta: result.meta })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
