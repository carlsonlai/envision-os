/**
 * OAuth callback — Meta redirects here after user grants permissions.
 * Immediately exchanges the code and renders a result page.
 */

import { NextRequest, NextResponse } from 'next/server'

const APP_ID     = process.env.FACEBOOK_APP_ID
const APP_SECRET = process.env.FACEBOOK_APP_SECRET
const REDIRECT   = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/admin/social-connect/callback`

const EXPECTED_STATE = 'envision_social_connect'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error_description')

  if (error || !code) {
    return new NextResponse(renderPage('error', null, error ?? 'No code returned'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // CSRF: validate state parameter matches what we sent in the auth URL
  if (state !== EXPECTED_STATE) {
    return new NextResponse(renderPage('error', null, 'Invalid state parameter — possible CSRF. Please try connecting again.'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  try {
    // 1. Short-lived user token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT)}&client_secret=${APP_SECRET}&code=${code}`
    )
    const tokenData = await tokenRes.json() as { access_token?: string; error?: { message: string } }
    if (!tokenData.access_token) throw new Error(tokenData.error?.message ?? 'Token exchange failed')

    // 2. Upgrade to long-lived user token
    const longRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${tokenData.access_token}`
    )
    const longData = await longRes.json() as { access_token?: string }
    const longToken = longData.access_token ?? tokenData.access_token

    // 3. Get all pages + Instagram accounts
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${longToken}`
    )
    const pagesData = await pagesRes.json() as {
      data: Array<{
        id: string
        name: string
        access_token: string
        instagram_business_account?: { id: string }
      }>
    }

    return new NextResponse(renderPage('success', pagesData.data, null), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return new NextResponse(renderPage('error', null, msg), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}

// ─── HTML result page ─────────────────────────────────────────────────────────

function renderPage(
  status: 'success' | 'error',
  pages: Array<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string } }> | null,
  errorMsg: string | null
): string {
  if (status === 'error') {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Connection Failed</title>
<style>body{font-family:system-ui;background:#09090b;color:#f4f4f5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
.box{background:#18181b;border:1px solid #3f3f46;border-radius:16px;padding:32px;max-width:480px;width:100%;text-align:center;}
h2{color:#f87171;margin:0 0 12px;}p{color:#a1a1aa;font-size:14px;}
a{color:#818cf8;text-decoration:none;font-size:14px;}</style></head>
<body><div class="box"><h2>❌ Connection Failed</h2><p>${errorMsg ?? 'Unknown error'}</p><br><a href="/admin/social-connect">← Try again</a></div></body></html>`
  }

  const rows = (pages ?? []).map(page => {
    const igId = page.instagram_business_account?.id
    return `
      <div style="background:#09090b;border:1px solid #3f3f46;border-radius:12px;padding:20px;margin-bottom:16px;text-align:left;">
        <div style="font-size:16px;font-weight:600;margin-bottom:12px;">📘 ${page.name}</div>
        <div style="font-size:12px;color:#71717a;margin-bottom:4px;">Facebook Page ID</div>
        <code style="background:#27272a;padding:6px 10px;border-radius:6px;font-size:12px;display:block;word-break:break-all;margin-bottom:10px;">${page.id}</code>
        <div style="font-size:12px;color:#71717a;margin-bottom:4px;">Facebook Page Access Token</div>
        <code style="background:#27272a;padding:6px 10px;border-radius:6px;font-size:12px;display:block;word-break:break-all;margin-bottom:10px;">${page.access_token}</code>
        ${igId ? `
        <div style="font-size:12px;color:#71717a;margin-bottom:4px;">📸 Instagram Business Account ID</div>
        <code style="background:#1a1a2e;border:1px solid #4f46e5;padding:6px 10px;border-radius:6px;font-size:12px;display:block;word-break:break-all;margin-bottom:10px;">${igId}</code>
        <div style="font-size:12px;color:#71717a;margin-bottom:4px;">Instagram Access Token (same as page token)</div>
        <code style="background:#1a1a2e;border:1px solid #4f46e5;padding:6px 10px;border-radius:6px;font-size:12px;display:block;word-break:break-all;">${page.access_token}</code>
        ` : '<div style="font-size:12px;color:#f59e0b;">⚠️ No Instagram Business Account linked to this page</div>'}
      </div>
      <div style="background:#052e16;border:1px solid #166534;border-radius:8px;padding:14px;margin-bottom:20px;font-size:11px;font-family:monospace;color:#86efac;white-space:pre-wrap;word-break:break-all;">FACEBOOK_PAGE_ID=${page.id}
FACEBOOK_PAGE_ACCESS_TOKEN=${page.access_token}
${igId ? `INSTAGRAM_BUSINESS_ACCOUNT_ID=${igId}\nINSTAGRAM_ACCESS_TOKEN=${page.access_token}` : '# No Instagram account linked'}</div>
    `
  }).join('')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Social Connect — Envicion OS</title>
<style>
  *{box-sizing:border-box;}
  body{font-family:system-ui;background:#09090b;color:#f4f4f5;padding:32px 16px;margin:0;}
  .container{max-width:640px;margin:0 auto;}
  h1{font-size:20px;font-weight:700;margin:0 0 4px;}
  .sub{color:#71717a;font-size:14px;margin:0 0 28px;}
  .success-badge{display:inline-flex;align-items:center;gap:6px;background:#052e16;border:1px solid #166534;color:#86efac;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:600;margin-bottom:24px;}
  .instructions{background:#18181b;border:1px solid #3f3f46;border-radius:12px;padding:20px;margin-bottom:24px;font-size:13px;color:#a1a1aa;line-height:1.6;}
  .instructions strong{color:#f4f4f5;}
  code{background:#27272a;padding:2px 6px;border-radius:4px;font-size:12px;}
  a{color:#818cf8;text-decoration:none;}
</style></head>
<body>
<div class="container">
  <h1>🔗 Social Media Connected</h1>
  <p class="sub">Copy the values below into your <code>.env.local</code> file, then restart your dev server.</p>
  <div class="success-badge">✅ OAuth Successful</div>
  <div class="instructions">
    <strong>Next steps:</strong><br>
    1. Open <code>Jobs/envision-os/.env.local</code><br>
    2. Paste the green env block for your page into the file<br>
    3. Run <code>npm run dev</code> to restart — autopilot will start posting immediately<br><br>
    <strong>Note:</strong> These page tokens never expire as long as your Meta App stays active and the user doesn't revoke access. No refresh needed.
  </div>
  ${rows || '<p style="color:#71717a;">No Facebook pages found. Make sure your Meta account manages at least one page.</p>'}
  <a href="/admin/social-connect">← Back to Social Connect</a>
</div>
</body></html>`
}
