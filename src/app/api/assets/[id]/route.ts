import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { deleteFromDrive } from '@/services/gdrive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params
  const asset = await prisma.asset.findUnique({ where: { id } })
  if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    await deleteFromDrive(asset.driveFileId)
  } catch (e) {
    console.error('[assets/delete] drive error:', e)
    // Continue — we still want to remove the DB row so it stops showing up.
  }
  await prisma.asset.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
