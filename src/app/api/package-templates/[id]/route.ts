import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PackageTemplate } from '../route'
import { logger, getErrorMessage } from '@/lib/logger'

// In-memory store mirroring the base route (in production, use DB)
// This is intentionally minimal — extend with DB persistence when needed

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const { id } = await params

  try {
    const body = (await req.json()) as Partial<PackageTemplate>
    // In production, update DB record with id
    return NextResponse.json({
      data: { ...body, id },
    })
  } catch (error) {
    logger.error('PATCH /api/package-templates/[id] error', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const { id } = await params

  try {
    // In production, delete from DB
    return NextResponse.json({ data: { deleted: true, id } })
  } catch (error) {
    logger.error('DELETE /api/package-templates/[id] error', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
  }
}
