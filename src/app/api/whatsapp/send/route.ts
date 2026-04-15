import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendMessage } from '@/services/whatsapp'
import { z } from 'zod'
import { logger, getErrorMessage } from '@/lib/logger'

const SendSchema = z.object({
  to: z.string().min(1),
  message: z.string().min(1),
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
    const { to, message } = SendSchema.parse(body)
    const messageId = await sendMessage(to, message)
    return NextResponse.json({ data: { messageId } })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    logger.error('POST /api/whatsapp/send error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
