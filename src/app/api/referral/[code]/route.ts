import { NextRequest, NextResponse } from 'next/server'
import { trackReferralConversion, getReferralLeaderboard } from '@/services/reputation'
import { z } from 'zod'
import { logger, getErrorMessage } from '@/lib/logger'

const TrackSchema = z.object({
  newLeadId: z.string().min(1),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  // Return leaderboard if code is 'leaderboard'
  if (code === 'leaderboard') {
    try {
      const leaderboard = await getReferralLeaderboard()
      return NextResponse.json({ data: leaderboard })
    } catch (error) {
      logger.error('GET /api/referral/leaderboard error', { error: getErrorMessage(error) })
      return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
    }
  }

  return NextResponse.json({ data: { code, valid: true } })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  try {
    const body: unknown = await req.json()
    const { newLeadId } = TrackSchema.parse(body)
    await trackReferralConversion(code, newLeadId)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    logger.error('POST /api/referral/[code] error', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to track referral' }, { status: 500 })
  }
}
