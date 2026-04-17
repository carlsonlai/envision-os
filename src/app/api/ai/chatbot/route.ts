import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { CHATBOT_CONFIGS } from '@/lib/chatbot-config'
import { logger, getErrorMessage } from '@/lib/logger'

// Lazy singleton for Anthropic client
let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) {
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY is not set.')
    }
    _client = new Anthropic({ apiKey: key })
  }
  return _client
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await req.json()) as {
      messages: ChatMessage[]
      role?: string
    }

    const userRole = body.role ?? session.user.role
    const config = CHATBOT_CONFIGS[userRole]
    if (!config) {
      return NextResponse.json({ error: 'No chatbot configuration for this role.' }, { status: 400 })
    }

    const messages = body.messages ?? []
    if (messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided.' }, { status: 400 })
    }

    // Build system prompt with role context
    const systemPrompt = [
      config.systemPrompt,
      `The user's name is ${session.user.name ?? 'Team Member'}.`,
      `Their role is ${config.role}.`,
      'Keep responses concise (under 300 words unless asked for detail).',
      'Use markdown formatting for readability when appropriate.',
      'If asked about specific data you don\'t have access to, acknowledge it honestly and suggest where they can find it in Envicion OS.',
    ].join('\n')

    // Stream response
    const stream = await getClient().messages.stream({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    })

    // Convert to a ReadableStream for streaming response
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
              )
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: getErrorMessage(err) })}\n\n`
            )
          )
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    logger.error('Chatbot API error', { detail: getErrorMessage(err) })
    return NextResponse.json(
      { error: getErrorMessage(err) },
      { status: 500 }
    )
  }
}
