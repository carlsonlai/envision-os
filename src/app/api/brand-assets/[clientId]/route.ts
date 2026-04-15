import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { BrandAssetType } from '@prisma/client'
import { logger, getErrorMessage } from '@/lib/logger'

const CreateAssetSchema = z.object({
  type: z.nativeEnum(BrandAssetType),
  filename: z.string().min(1),
  url: z.string().url(),
  larkFileToken: z.string().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { clientId } = await params
  try {
    const assets = await prisma.brandAsset.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ data: assets })
  } catch (error) {
    logger.error('GET /api/brand-assets/[clientId] error', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to fetch brand assets' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowedRoles = ['ADMIN', 'CLIENT_SERVICING']
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { clientId } = await params
  try {
    const body: unknown = await req.json()
    const data = CreateAssetSchema.parse(body)

    const asset = await prisma.brandAsset.create({
      data: {
        clientId,
        type: data.type,
        filename: data.filename,
        url: data.url,
        larkFileToken: data.larkFileToken,
      },
    })
    return NextResponse.json({ data: asset }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    logger.error('POST /api/brand-assets/[clientId] error', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to create brand asset' }, { status: 500 })
  }
}
