import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as { role?: string }).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const action = req.nextUrl.searchParams.get('action')

  if (action === 'status') {
    return NextResponse.json({ connected: !!process.env.TIKTOK_ACCESS_TOKEN, clientConfigured: !!process.env.TIKTOK_CLIENT_KEY })
  }

  if (action === 'auth_url') {
    const clientKey = process.env.TIKTOK_CLIENT_KEY
    if (!clientKey) return NextResponse.json({ error: 'TIKTOK_CLIENT_KEY not configured' }, { status: 400 })

    const redirectUri = `${process.env.NEXTAUTH_URL}/api/admin/social-connect/tiktok/callback`
    const params = new URLSearchParams({
      client_key: clientKey,
      scope: 'user.info.basic,video.list',
      response_type: 'code',
      redirect_uri: redirectUri,
      state: crypto.randomBytes(12).toString('hex'),
    })
    return NextResponse.json({ url: `https://www.tiktok.com/v2/auth/authorize/?${params}` })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
