const WA_BASE = 'https://waba.360dialog.io/v1'
const API_KEY = process.env.WHATSAPP_360DIALOG_API_KEY ?? ''

export async function sendMessage(to: string, message: string): Promise<string> {
  const res = await fetch(`${WA_BASE}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'D360-API-KEY': API_KEY,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: message },
    }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`WhatsApp send failed: ${res.status} ${errorText}`)
  }

  const data = (await res.json()) as { messages?: { id: string }[] }
  return data.messages?.[0]?.id ?? ''
}

export async function sendTemplate(
  to: string,
  templateName: string,
  params: string[]
): Promise<string> {
  const components =
    params.length > 0
      ? [
          {
            type: 'body',
            parameters: params.map((p) => ({ type: 'text', text: p })),
          },
        ]
      : []

  const res = await fetch(`${WA_BASE}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'D360-API-KEY': API_KEY,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en' },
        components,
      },
    }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`WhatsApp template send failed: ${res.status} ${errorText}`)
  }

  const data = (await res.json()) as { messages?: { id: string }[] }
  return data.messages?.[0]?.id ?? ''
}

export interface InboundWAMessage {
  from: string
  messageId: string
  text: string
  timestamp: string
}

export function parseInboundWebhook(body: unknown): InboundWAMessage | null {
  if (!body || typeof body !== 'object') return null

  const payload = body as Record<string, unknown>
  const entry = (payload.entry as unknown[])?.[0] as Record<string, unknown> | undefined
  const changes = (entry?.changes as unknown[])?.[0] as Record<string, unknown> | undefined
  const value = changes?.value as Record<string, unknown> | undefined
  const messages = value?.messages as unknown[] | undefined
  const msg = messages?.[0] as Record<string, unknown> | undefined

  if (!msg) return null

  const text = msg.text as Record<string, unknown> | undefined
  if (!text?.body) return null

  return {
    from: String(msg.from ?? ''),
    messageId: String(msg.id ?? ''),
    text: String(text.body ?? ''),
    timestamp: String(msg.timestamp ?? ''),
  }
}
