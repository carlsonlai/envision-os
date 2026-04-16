import { NextRequest, NextResponse } from 'next/server'
import { createDecipheriv, createHmac, createHash } from 'crypto'
import { getToken } from '@/services/lark'
import axios from 'axios'
import { logger, getErrorMessage } from '@/lib/logger'

const LARK_BASE = 'https://open.larksuite.com/open-apis'

// ─── Signature Verification ───────────────────────────────────────────────────

function verifySignature(
  timestamp: string,
  nonce: string,
  encryptKey: string,
  body: string,
  signature: string
): boolean {
  const toSign = `${timestamp}${nonce}${encryptKey}${body}`
  const computed = createHmac('sha256', encryptKey).update(toSign).digest('hex')
  return computed === signature
}

// ─── AES Decryption (when ENCRYPT_KEY is set) ─────────────────────────────────

function decryptBody(encrypted: string, encryptKey: string): unknown {
  // Lark AES-256-CBC decryption
  const keyHash = createHash('sha256').update(encryptKey).digest()
  const encryptedBuffer = Buffer.from(encrypted, 'base64')
  const iv = encryptedBuffer.slice(0, 16)
  const content = encryptedBuffer.slice(16)
  const decipher = createDecipheriv('aes-256-cbc', keyHash, iv)
  const decrypted = Buffer.concat([decipher.update(content), decipher.final()])
  return JSON.parse(decrypted.toString('utf-8'))
}

// ─── Add bot to a chat ────────────────────────────────────────────────────────

async function addBotToChat(chatId: string): Promise<void> {
  const appId = process.env.LARK_APP_ID
  if (!appId) throw new Error('LARK_APP_ID not configured')

  const token = await getToken()

  const res = await axios.post<{ code: number; msg: string }>(
    `${LARK_BASE}/im/v1/chats/${chatId}/members`,
    {
      member_id_type: 'app_id',
      id_list: [appId],
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (res.data.code !== 0) {
    throw new Error(`Failed to add bot to chat ${chatId}: code ${res.data.code} – ${res.data.msg}`)
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const encryptKey = process.env.LARK_ENCRYPT_KEY ?? ''
  const verifyToken = process.env.LARK_VERIFY_TOKEN ?? ''
  const rawBody = await req.text()

  // ── Signature check (if keys are configured) ──────────────────────────────
  if (encryptKey && verifyToken) {
    const timestamp = req.headers.get('x-lark-request-timestamp') ?? ''
    const nonce = req.headers.get('x-lark-request-nonce') ?? ''
    const signature = req.headers.get('x-lark-signature') ?? ''

    if (timestamp && nonce && signature) {
      if (!verifySignature(timestamp, nonce, encryptKey, rawBody, signature)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }
  }

  // ── Parse body (decrypt if encrypted) ────────────────────────────────────
  let payload: Record<string, unknown>

  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>

    if (parsed.encrypt && encryptKey) {
      payload = decryptBody(parsed.encrypt as string, encryptKey) as Record<string, unknown>
    } else {
      payload = parsed
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // ── URL Verification Challenge ────────────────────────────────────────────
  if (payload.type === 'url_verification' || payload.challenge) {
    return NextResponse.json({ challenge: payload.challenge })
  }

  // ── Event Dispatch ────────────────────────────────────────────────────────
  const schema = payload.schema as string | undefined
  let eventType: string | undefined
  let event: Record<string, unknown> | undefined

  if (schema === '2.0') {
    // Lark Events API 2.0
    const header = payload.header as Record<string, unknown> | undefined
    eventType = header?.event_type as string | undefined
    event = payload.event as Record<string, unknown> | undefined
  } else {
    // Legacy Events API 1.0
    eventType = payload.event_type as string | undefined
    event = payload.event as Record<string, unknown> | undefined
  }

  // ── im.chat.created_v1 → auto-add Envicion OS bot ────────────────────────
  if (eventType === 'im.chat.created' || eventType === 'im.chat.created_v1') {
    const chatId = event?.chat_id as string | undefined

    if (chatId) {
      try {
        await addBotToChat(chatId)
        logger.info(`[Lark Events] Bot added to new chat: ${chatId}`)
      } catch (err) {
        logger.error('[Lark Events] Failed to add bot to chat:', { error: getErrorMessage(err) })
        // Return 200 so Lark doesn't keep retrying — log the error internally
      }
    }
  }

  return NextResponse.json({ success: true })
}
