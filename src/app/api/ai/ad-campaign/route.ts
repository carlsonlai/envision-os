import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma-extended'
import { z } from 'zod'
import { logger, getErrorMessage } from '@/lib/logger'

const ALLOWED_ROLES = ['ADMIN', 'SALES', 'AI_SALES_AGENT', 'DIGITAL_MARKETING']

const CreateCampaignSchema = z.object({
  clientId: z.string().optional(),
  leadId: z.string().optional(),
  platform: z.enum(['FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'GOOGLE', 'LINKEDIN', 'YOUTUBE', 'OTHER']),
  objective: z.enum(['AWARENESS', 'ENGAGEMENT', 'LEADS', 'CONVERSION', 'RETARGETING']),
  targetAudience: z.string().optional(),
  budget: z.number().optional(),
  hookAngle: z.string().optional(),
  adCopy: z.string().optional(),
  visualConcept: z.string().optional(),
  callToAction: z.string().optional(),
})

const UpdateCampaignSchema = z.object({
  status: z.enum(['DRAFT', 'READY', 'ACTIVE', 'PAUSED', 'ENDED', 'ARCHIVED']).optional(),
  impressions: z.number().optional(),
  clicks: z.number().optional(),
  leadsGenerated: z.number().optional(),
  conversions: z.number().optional(),
  spend: z.number().optional(),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') ?? undefined
    const platform = searchParams.get('platform') ?? undefined

    const campaigns = await prisma.adCampaign.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(platform ? { platform: platform as never } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ data: campaigns })
  } catch (error) {
    logger.error('GET /api/ai/ad-campaign error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body: unknown = await req.json()
    const data = CreateCampaignSchema.parse(body)
    const campaign = await prisma.adCampaign.create({
      data: {
        ...data,
        aiGenerated: true,
        status: 'DRAFT',
      },
    })
    return NextResponse.json({ data: campaign }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    logger.error('POST /api/ai/ad-campaign error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 })

    const body: unknown = await req.json()
    const data = UpdateCampaignSchema.parse(body)
    const campaign = await prisma.adCampaign.update({
      where: { id },
      data,
    })
    return NextResponse.json({ data: campaign })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    logger.error('PATCH /api/ai/ad-campaign error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
  }
}
