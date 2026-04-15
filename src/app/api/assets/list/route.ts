import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const platform = searchParams.get('platform')
  const kind = searchParams.get('kind')
  const take = Math.min(Number(searchParams.get('limit') ?? 60), 200)

  const where: Prisma.AssetWhereInput = {}
  if (platform) where.platform = platform
  if (kind && ['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'OTHER'].includes(kind)) {
    where.kind = kind as Prisma.AssetWhereInput['kind']
  }

  try {
    const assets = await prisma.asset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
    })
    return NextResponse.json({ ok: true, assets })
  } catch (e: unknown) {
    // Table may not yet exist on a fresh deploy — return an empty list so UI renders.
    const msg = e instanceof Error ? e.message : String(e)
    if (/relation .* does not exist|AssetKind/i.test(msg)) {
      return NextResponse.json({ ok: true, assets: [] })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
