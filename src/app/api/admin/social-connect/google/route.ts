import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as { role?: string }).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const action = req.nextUrl.searchParams.get('action')

  if (action === 'status') {
    return NextResponse.json({
      connected: !!(process.env.YOUTUBE_API_KEY || process.env.GOOGLE_CLIENT_ID),
      channelConfigured: !!process.env.YOUTUBE_CHANNEL_ID,
      clientConfigured: !!process.env.GOOGLE_CLIENT_ID,
    })
  }

  if (action === 'auth_url') {
    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) return NextResponse.json({ error: 'GOOGLE_CLIENT_ID not configured' }, { status: 400 })

    const redirectUri = `${process.env.NEXTAUTH_URL}/api/admin/social-connect/google/callback`
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/youtube.readonly',
      access_type: 'offline',
      prompt: 'consent',
    })
    return NextResponse.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
