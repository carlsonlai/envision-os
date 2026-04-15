import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { draftUpsellMessage } from '@/services/ai'
import { z } from 'zod'
import { logger, getErrorMessage } from '@/lib/logger'

const UpsellDraftSchema = z.object({
  clientIndustry: z.string().min(1),
  lastProjectType: z.string().min(1),
  suggestedService: z.string().min(1),
  channel: z.enum(['WHATSAPP', 'EMAIL']),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowedRoles = ['ADMIN', 'SALES', 'CLIENT_SERVICING']
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body: unknown = await req.json()
    const data = UpsellDraftSchema.parse(body)
    const message = await draftUpsellMessage(data)
    return NextResponse.json({ data: { message } })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    logger.error('POST /api/ai/upsell-draft error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to draft upsell message' }, { status: 500 })
  }
}
