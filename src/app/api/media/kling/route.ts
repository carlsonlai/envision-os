import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createHmac } from 'crypto'
import { authOptions } from '@/lib/auth'

const KLING_ACCESS_KEY_ID = process.env.KLING_ACCESS_KEY_ID
const KLING_ACCESS_KEY_SECRET = process.env.KLING_ACCESS_KEY_SECRET
const BASE = 'https://api.klingai.com'

const ALLOWED_ROLES = ['ADMIN', 'DIGITAL_MARKETING', 'CREATIVE_DIRECTOR', 'SENIOR_ART_DIRECTOR']

// Build a signed JWT for Kling API (HS256)
function buildKlingJwt(): string {
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: KLING_ACCESS_KEY_ID,
    exp: now + 1800,
    nbf: now - 5,
  })).toString('base64url')

  const signingInput = `${header}.${payload}`

  // Node.js built-in crypto for HMAC-SHA256
  const sig = createHmac('sha256', KLING_ACCESS_KEY_SECRET!)
    .update(signingInput)
    .digest('base64url')

  return `${signingInput}.${sig}`
}

// POST /api/media/kling — generate a text-to-video task
// body: { prompt, negative_prompt?, aspect_ratio?, duration?, mode? }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!KLING_ACCESS_KEY_ID || !KLING_ACCESS_KEY_SECRET) {
    return NextResponse.json({ error: 'KLING_ACCESS_KEY_ID / KLING_ACCESS_KEY_SECRET not configured' }, { status: 503 })
  }

  interface KlingBody {
    prompt: string
    negative_prompt?: string
    aspect_ratio?: string
    duration?: string
    mode?: string
    model?: string
  }
  const body = (await req.json()) as KlingBody
  const {
    prompt,
    negative_prompt = '',
    aspect_ratio = '16:9',
    duration = '5',
    mode = 'std',
    model = 'kling-v1',
  } = body

  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  const jwt = buildKlingJwt()

  const res = await fetch(`${BASE}/v1/videos/text2video`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, prompt, negative_prompt, cfg_scale: 0.5, mode, aspect_ratio, duration }),
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: `Kling error: ${res.status}`, detail: text }, { status: res.status })
  }

  const data: unknown = await res.json()
  return NextResponse.json({ success: true, data })
}

// GET /api/media/kling?task_id=xxx — poll task status
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!KLING_ACCESS_KEY_ID || !KLING_ACCESS_KEY_SECRET) {
    return NextResponse.json({ error: 'KLING_ACCESS_KEY_ID / KLING_ACCESS_KEY_SECRET not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const taskId = searchParams.get('task_id')
  if (!taskId) return NextResponse.json({ error: 'task_id is required' }, { status: 400 })

  const jwt = buildKlingJwt()
  const res = await fetch(`${BASE}/v1/videos/text2video/${taskId}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: `Kling poll error: ${res.status}`, detail: text }, { status: res.status })
  }

  const data: unknown = await res.json()
  return NextResponse.json({ success: true, data })
}
