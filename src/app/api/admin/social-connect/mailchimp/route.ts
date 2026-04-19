import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface MailchimpPingResponse {
  health_status?: string
}
interface MailchimpRootResponse {
  account_name?: string
  error?: string
}
interface VerifyBody {
  apiKey: string
  server: string
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as { role?: string }).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const action = req.nextUrl.searchParams.get('action')
  if (action === 'status') {
    return NextResponse.json({ connected: !!process.env.MAILCHIMP_API_KEY, serverConfigured: !!process.env.MAILCHIMP_SERVER_PREFIX })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as { role?: string }).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: VerifyBody
  try {
    body = await req.json() as VerifyBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { apiKey, server } = body
  if (!apiKey || !server) {
    return NextResponse.json({ error: 'apiKey and server are required' }, { status: 400 })
  }

  try {
    const [pingRes, rootRes] = await Promise.all([
      fetch(`https://${server}.api.mailchimp.com/3.0/ping`, { headers: { Authorization: `apikey ${apiKey}` } }),
      fetch(`https://${server}.api.mailchimp.com/3.0/`, { headers: { Authorization: `apikey ${apiKey}` } }),
    ])

    const ping = await pingRes.json() as MailchimpPingResponse
    if (ping.health_status !== "Everything's Chimpy!") {
      return NextResponse.json({ success: false, error: 'Mailchimp ping failed — check your API key and server prefix' }, { status: 400 })
    }

    const root = rootRes.ok ? await rootRes.json() as MailchimpRootResponse : {}
    return NextResponse.json({ success: true, accountName: root.account_name ?? 'Connected' })
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
