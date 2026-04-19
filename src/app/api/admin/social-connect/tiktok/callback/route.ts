import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface TikTokData {
  access_token?: string
  open_id?: string
  expires_in?: number
}
interface TikTokTokenResponse {
  data?: TikTokData
  error?: { code?: string; message?: string }
}

function html(body: string): NextResponse {
  return new NextResponse(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return html(`<!DOCTYPE html><html><body style="background:#0a0a0f;color:#f87171;font-family:monospace;padding:2rem;"><h2>TikTok Error</h2><p>${error ?? 'No code'}</p></body></html>`)
  }

  const redirectUri = `${process.env.NEXTAUTH_URL}/api/admin/social-connect/tiktok/callback`
  let tokenData: TikTokTokenResponse = {}
  try {
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_KEY ?? '', client_secret: process.env.TIKTOK_CLIENT_SECRET ?? '', code, grant_type: 'authorization_code', redirect_uri: redirectUri }),
    })
    tokenData = await res.json() as TikTokTokenResponse
  } catch (err: unknown) {
    return html(`<!DOCTYPE html><html><body style="background:#0a0a0f;color:#f87171;padding:2rem;font-family:monospace;"><p>${err instanceof Error ? err.message : 'Failed'}</p></body></html>`)
  }

  const token = tokenData.data?.access_token
  const openId = tokenData.data?.open_id
  if (!token) {
    return html(`<!DOCTYPE html><html><body style="background:#0a0a0f;color:#f87171;padding:2rem;font-family:monospace;"><pre>${JSON.stringify(tokenData, null, 2)}</pre></body></html>`)
  }

  return html(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>TikTok Connected</title></head>
<body style="background:#0a0a0f;color:#e4e4e7;font-family:monospace;padding:2rem;max-width:640px;margin:0 auto;">
  <h2 style="color:#34d399;">&#10003; TikTok Authorized</h2>
  <p style="color:#71717a;font-size:0.875rem;">Copy into <code style="color:#818cf8;">.env.local</code> then restart.</p>
  <div style="background:#18181b;border:1px solid #3f3f46;border-radius:8px;padding:1.25rem;margin:1.5rem 0;">
    <p style="color:#34d399;margin:0.25rem 0;word-break:break-all;">TIKTOK_ACCESS_TOKEN=${token}</p>
    ${openId ? `<p style="color:#818cf8;margin:0.25rem 0;">TIKTOK_OPEN_ID=${openId}</p>` : ''}
  </div>
  <button onclick="window.close()" style="background:#6366f1;color:white;border:none;padding:0.5rem 1.25rem;border-radius:6px;cursor:pointer;">Close window</button>
</body></html>`)
}
