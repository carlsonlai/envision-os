/**
 * GET  /api/admin/social-connect?action=auth_url
 *   → Returns the Facebook OAuth URL to start the flow
 *
 * GET  /api/admin/social-connect?action=callback&code=XXX
 *   → Exchanges code for short-lived token, then upgrades to long-lived,
 *     fetches all pages + Instagram accounts, returns everything needed
 *     for .env.local
 *
 * GET  /api/admin/social-connect?action=status
 *   → Returns current connection status for all platforms
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const APP_ID     = process.env.FACEBOOK_APP_ID
const APP_SECRET = process.env.FACEBOOK_APP_SECRET
const REDIRECT   = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/admin/social-connect/callback`

// Standard Access scopes — no Meta App Review required.
// pages_manage_posts, instagram_content_publish, instagram_manage_insights
// require Advanced Access (App Review). Add those after Meta approves the app.
const SCOPES = [
  'pages_show_list',       // list all managed pages
  'pages_read_engagement', // read page analytics
  'business_management',   // access business accounts + linked Instagram IDs
].join(',')

// ─── Auth URL ─────────────────────────────────────────────────────────────────

function buildAuthUrl(): string {
  const params = new URLSearchParams({
    client_id:     APP_ID ?? '',
    redirect_uri:  REDIRECT,
    scope:         SCOPES,
    response_type: 'code',
    state:         'envision_social_connect',
  })
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`
}

// ─── Token exchange ───────────────────────────────────────────────────────────

async function exchangeCode(code: string): Promise<{
  pages: Array<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string } }>
  longLivedToken: string
  userId: string
}> {
  // Step 1: Short-lived user token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT)}&client_secret=${APP_SECRET}&code=${code}`
  )
  if (!tokenRes.ok) {
    const err = await tokenRes.json() as { error: { message: string } }
    throw new Error(err.error?.message ?? 'Token exchange failed')
  }
  const { access_token: shortToken } = await tokenRes.json() as { access_token: string }

  // Step 2: Upgrade to long-lived user token (60 days)
  const longRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${shortToken}`
  )
  if (!longRes.ok) throw new Error('Long-lived token exchange failed')
  const { access_token: longLivedToken } = await longRes.json() as { access_token: string }

  // Step 3: Get user ID
  const meRes = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${longLivedToken}`)
  const me = await meRes.json() as { id: string }

  // Step 4: Get all managed pages + their Instagram business accounts
  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/${me.id}/accounts?fields=id,name,access_token,instagram_business_account&access_token=${longLivedToken}`
  )
  if (!pagesRes.ok) throw new Error('Failed to fetch pages')
  const pagesData = await pagesRes.json() as { data: Array<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string } }> }

  return { pages: pagesData.data, longLivedToken, userId: me.id }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') ?? 'auth_url'

  // ── Return the OAuth URL ──────────────────────────────────────────────────
  if (action === 'auth_url') {
    if (!APP_ID || !APP_SECRET) {
      return NextResponse.json({
        error: 'FACEBOOK_APP_ID and FACEBOOK_APP_SECRET must be set in .env.local first',
      }, { status: 400 })
    }
    return NextResponse.json({ url: buildAuthUrl(), redirect: REDIRECT })
  }

  // ── Exchange the code after OAuth redirect ────────────────────────────────
  if (action === 'exchange') {
    const code = searchParams.get('code')
    if (!code) return NextResponse.json({ error: 'code param required' }, { status: 400 })

    try {
      const { pages, longLivedToken, userId } = await exchangeCode(code)

      const result = pages.map(page => ({
        pageId:   page.id,
        pageName: page.name,
        pageAccessToken:  page.access_token,
        instagramBusinessAccountId: page.instagram_business_account?.id ?? null,
      }))

      return NextResponse.json({
        ok: true,
        userId,
        longLivedUserToken: longLivedToken,
        pages: result,
        // Pre-formatted env vars ready to paste
        envVars: result.map(p => [
          `# ${p.pageName}`,
          `FACEBOOK_PAGE_ID=${p.pageId}`,
          `FACEBOOK_PAGE_ACCESS_TOKEN=${p.pageAccessToken}`,
          p.instagramBusinessAccountId
            ? `INSTAGRAM_BUSINESS_ACCOUNT_ID=${p.instagramBusinessAccountId}\nINSTAGRAM_ACCESS_TOKEN=${p.pageAccessToken}`
            : '# No Instagram business account linked to this page',
        ].join('\n')).join('\n\n'),
        note: 'Page access tokens from /accounts are already long-lived (never expire while the app is active). Copy the env vars above into your .env.local.',
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      return NextResponse.json({ ok: false, error: msg }, { status: 500 })
    }
  }

  // ── Connection status ─────────────────────────────────────────────────────
  if (action === 'status') {
    const checks: Record<string, boolean> = {
      facebook_app:   !!(APP_ID && APP_SECRET),
      facebook_page:  !!process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
      instagram:      !!process.env.INSTAGRAM_ACCESS_TOKEN,
      linkedin:       !!process.env.LINKEDIN_ACCESS_TOKEN,
      tiktok:         !!process.env.TIKTOK_ACCESS_TOKEN,
      youtube:        !!process.env.YOUTUBE_API_KEY,
      whatsapp:       !!process.env.WHATSAPP_360DIALOG_API_KEY,
    }
    return NextResponse.json({ status: checks })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
