import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const SCOPES = [
  'r_organization_social',
  'w_organization_social',
  'r_organization_followers',
  'r_basicprofile',
].join(' ')

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as { role?: string }).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const action = req.nextUrl.searchParams.get('action')

  if (action === 'status') {
    return NextResponse.json({
      connected: !!process.env.LINKEDIN_ACCESS_TOKEN,
      orgConfigured: !!process.env.LINKEDIN_ORGANIZATION_ID,
      clientConfigured: !!process.env.LINKEDIN_CLIENT_ID,
    })
  }

  if (action === 'auth_url') {
    const clientId = process.env.LINKEDIN_CLIENT_ID
    if (!clientId) {
      return NextResponse.json({ error: 'LINKEDIN_CLIENT_ID not configured' }, { status: 400 })
    }
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/admin/social-connect/linkedin/callback`
    const state = Buffer.from(JSON.stringify({ ts: Date.now() })).toString('base64url')
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: SCOPES,
    })
    return NextResponse.json({ url: `https://www.linkedin.com/oauth/v2/authorization?${params}` })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
