import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { convertLeadToClient } from '@/services/crm'
import { z } from 'zod'
import { logger, getErrorMessage } from '@/lib/logger'
import { inngest, AGENT_EVENTS } from '@/lib/inngest'

const ConvertSchema = z.object({
  csId: z.string().min(1),
  salesId: z.string().min(1),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowedRoles = ['ADMIN', 'SALES', 'CLIENT_SERVICING']
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  try {
    const body: unknown = await req.json()
    const { csId, salesId } = ConvertSchema.parse(body)
    const client = await convertLeadToClient(id, csId, salesId)
    // Notify agent layer: lead converted → Onboarding Agent
    inngest.send({ name: AGENT_EVENTS.onboardingLeadWon, data: { leadId: id } }).catch(() => {})
    return NextResponse.json({ data: client }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    logger.error('POST /api/crm/leads/[id]/convert error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to convert lead' }, { status: 500 })
  }
}
