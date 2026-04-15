import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/services/lark'
import { prisma } from '@/lib/db'
import { logger, getErrorMessage } from '@/lib/logger'

interface LarkEvent {
  schema?: string
  type?: string
  challenge?: string
  token?: string
  event?: {
    type: string
    message?: {
      message_id: string
      chat_id: string
      content: string
      sender?: {
        sender_id?: { open_id: string }
      }
    }
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const rawBody = await req.text()

    // Verify signature
    const isValid = verifyWebhookSignature(req.headers, rawBody)
    if (!isValid) {
      // If verification is not configured, allow through (development)
      const verifyToken = process.env.LARK_VERIFY_TOKEN
      if (verifyToken) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const body: LarkEvent = JSON.parse(rawBody)

    // Handle URL verification challenge
    if (body.type === 'url_verification' || body.challenge) {
      return NextResponse.json({ challenge: body.challenge })
    }

    // Handle message events
    const event = body.event
    if (event?.type === 'im.message.receive_v1' && event.message) {
      const { message } = event
      const chatId = message.chat_id
      const content = message.content
      const senderId = message.sender?.sender_id?.open_id

      // Find the project associated with this chat
      const chatMsg = await prisma.chatMessage.findFirst({
        where: { larkMessageId: { not: null } },
        include: { project: true },
        orderBy: { createdAt: 'desc' },
      })

      if (chatMsg?.projectId) {
        // Guard: senderId may be null for bot/system messages
        const resolvedSenderId = senderId ?? chatMsg.senderId ?? 'lark-system'

        // Store incoming message
        await prisma.chatMessage.create({
          data: {
            projectId: chatMsg.projectId,
            senderId: resolvedSenderId,
            content: typeof content === 'string' ? content : JSON.stringify(content),
            senderType: 'CLIENT',
            larkMessageId: message.message_id,
          },
        })
      }

      logger.info(`Lark message received from ${senderId} in chat ${chatId}`)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('Lark webhook error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
