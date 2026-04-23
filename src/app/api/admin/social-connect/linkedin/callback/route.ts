import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface LinkedInTokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

function html(body: string): NextResponse {
  return new NextResponse(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

async function saveLinkedInToken(token: string, expiresIn: number): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SocialConfig" (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      "updatedAt" TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  const payload = JSON.stringify({
    accessToken: token,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    savedAt: new Date().toISOString(),
  })
  await prisma.$executeRawUnsafe(
    `INSERT INTO "SocialConfig" (key, value, "updatedAt") VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = NOW()`,
    'linkedin_token',
    payload,
  )
  await prisma.$executeRawUnsafe(
    `INSERT INTO "SocialConfig" (key, value, "updatedAt") VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = NOW()`,
    'linkedin_connected',
    JSON.stringify({ connected: true, savedAt: new Date().toISOString() }),
  )
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return html(`<!DOCTYPE html><html><body style="background:#0a0a0f;color:#f87171;font-family:monospace;padding:2rem;">
      <h2>LinkedIn OAuth Error</h2><p>${error ?? 'No code returned'}</p></body></html>`)
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID ?? ''
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET ?? ''
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/admin/social-connect/linkedin/callback`

  let tokenData: LinkedInTokenResponse = {}
  try {
    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret }),
    })
    tokenData = await res.json() as LinkedInTokenResponse
  } catch (err: unknown) {
    return html(`<!DOCTYPE html><html><body style="background:#0a0a0f;color:#f87171;font-family:monospace;padding:2rem;"><h2>Token exchange failed</h2><p>${err instanceof Error ? err.message : 'Unknown'}</p></body></html>`)
  }

  if (!tokenData.access_token) {
    return html(`<!DOCTYPE html><html><body style="background:#0a0a0f;color:#f87171;font-family:monospace;padding:2rem;"><h2>No token</h2><pre>${JSON.stringify(tokenData, null, 2)}</pre></body></html>`)
  }

  const days = tokenData.expires_in ? Math.floor(tokenData.expires_in / 86400) : 60
  const expiresIn = tokenData.expires_in ?? 60 * 86400

  // Auto-save to DB
  let dbSaved = false
  try {
    await saveLinkedInToken(tokenData.access_token, expiresIn)
    dbSaved = true
  } catch {
    // Non-blocking — token still shown below for manual fallback
  }

  return html(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>LinkedIn Connected</title></head>
<body style="background:#0a0a0f;color:#e4e4e7;font-family:system-ui;padding:2rem;max-width:640px;margin:0 auto;">
  <h2 style="color:#34d399;">✓ LinkedIn Authorized</h2>
  ${dbSaved
    ? `<div style="background:#052e16;border:1px solid #166534;border-radius:8px;padding:1rem;margin:1rem 0;color:#86efac;font-size:0.875rem;">
        ✅ Token saved to Envicion OS database — connection is live immediately. Token valid ~${days} days.
       </div>
       <p style="color:#71717a;font-size:0.875rem;">You can close this window. Add your <strong style="color:#e4e4e7;">LINKEDIN_ORGANIZATION_ID</strong> in Admin → Integrations to enable analytics.</p>`
    : `<p style="color:#71717a;font-size:0.875rem;">Token valid ~${days} days. Copy into Vercel environment variables.</p>
       <div style="background:#18181b;border:1px solid #3f3f46;border-radius:8px;padding:1.25rem;margin:1.5rem 0;font-family:monospace;font-size:0.8rem;">
         <p style="color:#34d399;margin:0.25rem 0;word-break:break-all;">LINKEDIN_ACCESS_TOKEN=${tokenData.access_token}</p>
         <p style="color:#71717a;margin:0.25rem 0;"># Find org ID at linkedin.com/company/YOUR-SLUG → Admin → URL</p>
         <p style="color:#818cf8;margin:0.25rem 0;">LINKEDIN_ORGANIZATION_ID=&lt;your-org-id&gt;</p>
       </div>`
  }
  <button onclick="window.close()" style="background:#6366f1;color:white;border:none;padding:0.5rem 1.25rem;border-radius:6px;cursor:pointer;font-size:0.875rem;">Close window</button>
</body></html>`)
}
