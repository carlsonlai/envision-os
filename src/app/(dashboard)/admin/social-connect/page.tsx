'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw,
  Loader2,
  Link2,
  Shield,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface PlatformStatus {
  connected: boolean
  clientConfigured?: boolean
  orgConfigured?: boolean
  channelConfigured?: boolean
  serverConfigured?: boolean
}

interface AllStatus {
  meta: { facebook_app: boolean; facebook_page: boolean; instagram: boolean }
  linkedin: PlatformStatus
  tiktok: PlatformStatus
  google: PlatformStatus
  mailchimp: PlatformStatus
}

interface MailchimpVerifyResult {
  success: boolean
  accountName?: string
  error?: string
}

const PLATFORMS = [
  {
    id: 'meta' as const,
    label: 'Facebook & Instagram',
    icon: '📘📸',
    color: 'text-blue-400',
    accentBorder: 'border-[#6366f1]/30',
    accentBg: 'bg-[#6366f1]/5',
    description: 'One OAuth flow covers both. Your App ID is already registered.',
    setupUrl: '',
  },
  {
    id: 'linkedin' as const,
    label: 'LinkedIn',
    icon: '💼',
    color: 'text-sky-400',
    accentBorder: 'border-sky-500/30',
    accentBg: 'bg-sky-500/5',
    description: 'Connect your company page for B2B content and analytics.',
    setupUrl: 'https://www.linkedin.com/developers/apps/new',
  },
  {
    id: 'tiktok' as const,
    label: 'TikTok',
    icon: '🎵',
    color: 'text-rose-400',
    accentBorder: 'border-rose-500/30',
    accentBg: 'bg-rose-500/5',
    description: 'Connect TikTok for Business to fetch video and follower analytics.',
    setupUrl: 'https://developers.tiktok.com/console/index',
  },
  {
    id: 'youtube' as const,
    label: 'YouTube',
    icon: '▶️',
    color: 'text-red-400',
    accentBorder: 'border-red-500/30',
    accentBg: 'bg-red-500/5',
    description: 'Read channel stats and video performance via Google OAuth.',
    setupUrl: 'https://console.cloud.google.com/apis/credentials',
  },
  {
    id: 'mailchimp' as const,
    label: 'Mailchimp',
    icon: '📧',
    color: 'text-amber-400',
    accentBorder: 'border-amber-500/30',
    accentBg: 'bg-amber-500/5',
    description: 'Connect your newsletter audience for subscriber and open-rate analytics.',
    setupUrl: 'https://mailchimp.com/developer/',
  },
  {
    id: 'rednote' as const,
    label: '小红书 / RedNote',
    icon: '📕',
    color: 'text-red-300',
    accentBorder: 'border-red-400/30',
    accentBg: 'bg-red-500/5',
    description: 'No public API available. Stats are entered manually.',
    setupUrl: '',
    manual: true,
  },
]

type PlatformId = typeof PLATFORMS[number]['id']

export default function SocialConnectPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [allStatus, setAllStatus] = useState<AllStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<PlatformId | null>(null)
  const [expanded, setExpanded] = useState<PlatformId | null>(null)
  const [authUrls, setAuthUrls] = useState<Partial<Record<PlatformId, string>>>({})
  const [mcKey, setMcKey] = useState('')
  const [mcServer, setMcServer] = useState('')
  const [mcVerifying, setMcVerifying] = useState(false)
  const [mcResult, setMcResult] = useState<MailchimpVerifyResult | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && (session?.user as { role?: string })?.role !== 'ADMIN') router.push('/command')
  }, [status, session, router])

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const [metaRes, liRes, ttRes, ggRes, mcRes] = await Promise.allSettled([
        fetch('/api/admin/social-connect?action=status').then(r => r.json()),
        fetch('/api/admin/social-connect/linkedin?action=status').then(r => r.json()),
        fetch('/api/admin/social-connect/tiktok?action=status').then(r => r.json()),
        fetch('/api/admin/social-connect/google?action=status').then(r => r.json()),
        fetch('/api/admin/social-connect/mailchimp?action=status').then(r => r.json()),
      ])
      setAllStatus({
        meta: metaRes.status === 'fulfilled' ? (metaRes.value as { status: AllStatus['meta'] }).status : { facebook_app: false, facebook_page: false, instagram: false },
        linkedin: liRes.status === 'fulfilled' ? liRes.value as PlatformStatus : { connected: false },
        tiktok: ttRes.status === 'fulfilled' ? ttRes.value as PlatformStatus : { connected: false },
        google: ggRes.status === 'fulfilled' ? ggRes.value as PlatformStatus : { connected: false },
        mailchimp: mcRes.status === 'fulfilled' ? mcRes.value as PlatformStatus : { connected: false },
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') void fetchStatus()
  }, [status, fetchStatus])

  async function handleOAuth(platformId: 'linkedin' | 'tiktok' | 'youtube') {
    const routeMap: Record<string, string> = {
      linkedin: '/api/admin/social-connect/linkedin?action=auth_url',
      tiktok: '/api/admin/social-connect/tiktok?action=auth_url',
      youtube: '/api/admin/social-connect/google?action=auth_url',
    }
    setConnecting(platformId)
    try {
      const res = await fetch(routeMap[platformId])
      if (!res.ok) throw new Error('Failed')
      const data = await res.json() as { url?: string; error?: string }
      if (!data.url) throw new Error(data.error ?? 'No URL returned')
      setAuthUrls(prev => ({ ...prev, [platformId]: data.url! }))
      window.open(data.url, '_blank', 'width=600,height=700,scrollbars=yes')
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to get auth URL')
    } finally {
      setConnecting(null)
    }
  }

  async function handleConnectMeta() {
    setConnecting('meta')
    try {
      const res = await fetch('/api/admin/social-connect?action=auth_url')
      if (!res.ok) throw new Error('Failed')
      const data = await res.json() as { url?: string }
      if (!data.url) throw new Error('No URL returned')
      setAuthUrls(prev => ({ ...prev, meta: data.url! }))
      window.open(data.url, '_blank', 'width=600,height=700,scrollbars=yes')
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed. Check FACEBOOK_APP_ID in .env.local')
    } finally {
      setConnecting(null)
    }
  }

  async function handleVerifyMailchimp() {
    if (!mcKey.trim() || !mcServer.trim()) return
    setMcVerifying(true)
    setMcResult(null)
    try {
      const res = await fetch('/api/admin/social-connect/mailchimp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: mcKey.trim(), server: mcServer.trim() }),
      })
      const data = await res.json() as MailchimpVerifyResult
      setMcResult(data)
    } catch {
      setMcResult({ success: false, error: 'Network error' })
    } finally {
      setMcVerifying(false)
    }
  }

  function isConnected(id: PlatformId): boolean {
    if (!allStatus) return false
    if (id === 'meta') return allStatus.meta.facebook_page
    if (id === 'linkedin') return allStatus.linkedin.connected
    if (id === 'tiktok') return allStatus.tiktok.connected
    if (id === 'youtube') return allStatus.google.connected
    if (id === 'mailchimp') return allStatus.mailchimp.connected
    return false
  }

  const nonManualPlatforms = PLATFORMS.filter(p => !p.manual)
  const connectedCount = nonManualPlatforms.filter(p => isConnected(p.id)).length

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Link2 className="h-5 w-5 text-[#818cf8]" />
            Social Media Connections
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Connect platforms so Autopilot can post, analyse, and optimise automatically
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${connectedCount > 0 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-zinc-700 bg-zinc-800/50 text-zinc-500'}`}>
            {connectedCount}/{nonManualPlatforms.length} connected
          </span>
          <button
            type="button"
            onClick={() => { void fetchStatus() }}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        </div>
      </div>

      {PLATFORMS.map((platform) => {
        const connected = isConnected(platform.id)
        const isExp = expanded === platform.id
        const isConn = connecting === platform.id
        const authUrl = authUrls[platform.id]

        return (
          <div key={platform.id} className={`rounded-xl border transition-colors ${isExp ? `${platform.accentBorder} ${platform.accentBg}` : 'border-zinc-800 bg-zinc-900/30'}`}>
            <button
              type="button"
              onClick={() => setExpanded(isExp ? null : platform.id)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left"
            >
              <span className="text-2xl w-8 shrink-0 text-center">{platform.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${platform.color}`}>{platform.label}</p>
                <p className="text-xs text-zinc-500 mt-0.5 truncate">{platform.description}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {connected ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-zinc-600">
                    <XCircle className="h-3.5 w-3.5" /> Not connected
                  </span>
                )}
                {isExp ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
              </div>
            </button>

            {isExp && (
              <div className="px-5 pb-5 space-y-4 border-t border-zinc-800/60 pt-4">
                {platform.id === 'meta' && (
                  <>
                    <div className="space-y-1.5 text-xs text-zinc-400">
                      <p className="font-medium text-zinc-300">What this grants:</p>
                      <ul className="space-y-0.5 ml-3">
                        <li>✓ Post to Facebook Page &amp; Instagram Business</li>
                        <li>✓ Read page analytics and engagement</li>
                        <li>✓ Manage scheduled posts via Autopilot</li>
                      </ul>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => { void handleConnectMeta() }}
                        disabled={isConn || !allStatus?.meta.facebook_app}
                        className="flex items-center gap-2 rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5558e3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isConn ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                        {isConn ? 'Opening…' : 'Connect via Facebook OAuth'}
                      </button>
                      {!allStatus?.meta.facebook_app && (
                        <p className="text-xs text-amber-400">Add FACEBOOK_APP_ID to .env.local first</p>
                      )}
                    </div>
                    {authUrl && (
                      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-xs">
                        <p className="text-zinc-400 mb-1">Popup blocked? Open manually:</p>
                        <a href={authUrl} target="_blank" rel="noreferrer" className="text-[#818cf8] break-all hover:underline">{authUrl.slice(0, 80)}…</a>
                      </div>
                    )}
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 flex items-start gap-2 text-xs text-zinc-500">
                      <Shield className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      After approving, copy the tokens shown into <span className="font-mono text-zinc-400 mx-1">.env.local</span> and restart.
                    </div>
                  </>
                )}

                {platform.id === 'linkedin' && (
                  <>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs space-y-1.5">
                      <p className="font-medium text-zinc-300">Setup steps</p>
                      <p className="text-zinc-400">1. Create a LinkedIn app at <a href="https://www.linkedin.com/developers/apps/new" target="_blank" rel="noreferrer" className="text-[#818cf8] hover:underline">linkedin.com/developers</a></p>
                      <p className="text-zinc-400">2. Add redirect URL: <span className="font-mono text-zinc-300 break-all">/api/admin/social-connect/linkedin/callback</span></p>
                      <p className="text-zinc-400">3. Set <span className="font-mono text-zinc-300">LINKEDIN_CLIENT_ID</span> + <span className="font-mono text-zinc-300">LINKEDIN_CLIENT_SECRET</span> in .env.local</p>
                      <p className="text-zinc-400">4. Click Connect — the popup shows your access token</p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <button type="button" onClick={() => { void handleOAuth('linkedin') }} disabled={isConn || !allStatus?.linkedin.clientConfigured}
                        className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        {isConn ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                        {isConn ? 'Opening…' : 'Connect LinkedIn'}
                      </button>
                      {!allStatus?.linkedin.clientConfigured && <p className="text-xs text-amber-400">Set LINKEDIN_CLIENT_ID in .env.local first</p>}
                      <a href="https://www.linkedin.com/developers/apps/new" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200">Create app <ExternalLink className="h-3 w-3" /></a>
                    </div>
                    {authUrl && (
                      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-xs">
                        <a href={authUrl} target="_blank" rel="noreferrer" className="text-[#818cf8] break-all hover:underline">{authUrl.slice(0, 80)}…</a>
                      </div>
                    )}
                    {connected && !allStatus?.linkedin.orgConfigured && (
                      <p className="text-xs text-amber-400">⚠ Token set — also add LINKEDIN_ORGANIZATION_ID to enable analytics.</p>
                    )}
                  </>
                )}

                {platform.id === 'tiktok' && (
                  <>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs space-y-1.5">
                      <p className="font-medium text-zinc-300">Setup steps</p>
                      <p className="text-zinc-400">1. Create a TikTok Developer app at <a href="https://developers.tiktok.com/console/index" target="_blank" rel="noreferrer" className="text-[#818cf8] hover:underline">developers.tiktok.com</a></p>
                      <p className="text-zinc-400">2. Add redirect URI: <span className="font-mono text-zinc-300">/api/admin/social-connect/tiktok/callback</span></p>
                      <p className="text-zinc-400">3. Set <span className="font-mono text-zinc-300">TIKTOK_CLIENT_KEY</span> + <span className="font-mono text-zinc-300">TIKTOK_CLIENT_SECRET</span> in .env.local</p>
                      <p className="text-zinc-400">4. Click Connect — the popup shows your access token</p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <button type="button" onClick={() => { void handleOAuth('tiktok') }} disabled={isConn || !allStatus?.tiktok.clientConfigured}
                        className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        {isConn ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                        {isConn ? 'Opening…' : 'Connect TikTok'}
                      </button>
                      {!allStatus?.tiktok.clientConfigured && <p className="text-xs text-amber-400">Set TIKTOK_CLIENT_KEY in .env.local first</p>}
                    </div>
                    {authUrl && (
                      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-xs">
                        <a href={authUrl} target="_blank" rel="noreferrer" className="text-[#818cf8] break-all hover:underline">{authUrl.slice(0, 80)}…</a>
                      </div>
                    )}
                  </>
                )}

                {platform.id === 'youtube' && (
                  <>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs space-y-1.5">
                      <p className="font-medium text-zinc-300">Setup steps</p>
                      <p className="text-zinc-400">1. Create OAuth 2.0 credentials at <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-[#818cf8] hover:underline">Google Cloud Console</a></p>
                      <p className="text-zinc-400">2. Enable YouTube Data API v3 in your project</p>
                      <p className="text-zinc-400">3. Add redirect URI: <span className="font-mono text-zinc-300">/api/admin/social-connect/google/callback</span></p>
                      <p className="text-zinc-400">4. Set <span className="font-mono text-zinc-300">GOOGLE_CLIENT_ID</span> + <span className="font-mono text-zinc-300">GOOGLE_CLIENT_SECRET</span> in .env.local</p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <button type="button" onClick={() => { void handleOAuth('youtube') }} disabled={isConn || !allStatus?.google.clientConfigured}
                        className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        {isConn ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                        {isConn ? 'Opening…' : 'Connect YouTube'}
                      </button>
                      {!allStatus?.google.clientConfigured && <p className="text-xs text-amber-400">Set GOOGLE_CLIENT_ID in .env.local first</p>}
                    </div>
                    {authUrl && (
                      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-xs">
                        <a href={authUrl} target="_blank" rel="noreferrer" className="text-[#818cf8] break-all hover:underline">{authUrl.slice(0, 80)}…</a>
                      </div>
                    )}
                    {connected && !allStatus?.google.channelConfigured && (
                      <p className="text-xs text-amber-400">⚠ Token set — also add YOUTUBE_CHANNEL_ID to enable analytics.</p>
                    )}
                  </>
                )}

                {platform.id === 'mailchimp' && (
                  <>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs space-y-1.5">
                      <p className="font-medium text-zinc-300">Setup steps</p>
                      <p className="text-zinc-400">1. Get your API key at <a href="https://us1.admin.mailchimp.com/account/api-key-popup/" target="_blank" rel="noreferrer" className="text-[#818cf8] hover:underline">Account → Extras → API keys</a></p>
                      <p className="text-zinc-400">2. Your server prefix is in your Mailchimp URL, e.g. <span className="font-mono text-zinc-300">us21</span></p>
                      <p className="text-zinc-400">3. Paste both below and click Verify</p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex gap-2 flex-wrap">
                        <input type="text" value={mcKey} onChange={e => setMcKey(e.target.value)}
                          placeholder="API Key (xxxxxxxx-usXX)" className="flex-1 min-w-40 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50" />
                        <input type="text" value={mcServer} onChange={e => setMcServer(e.target.value)}
                          placeholder="Server (us21)" className="w-28 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50" />
                        <button type="button" onClick={() => { void handleVerifyMailchimp() }} disabled={mcVerifying || !mcKey.trim() || !mcServer.trim()}
                          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
                          {mcVerifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                          {mcVerifying ? 'Verifying…' : 'Verify & Save'}
                        </button>
                      </div>
                      {mcResult && (
                        <div className={`rounded-lg border p-3 text-xs ${mcResult.success ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
                          {mcResult.success ? (
                            <span>&#10003; Connected to <strong>{mcResult.accountName}</strong>. Add to .env.local:<br />
                              <span className="font-mono text-emerald-300 block mt-1">MAILCHIMP_API_KEY={mcKey}</span>
                              <span className="font-mono text-emerald-300">MAILCHIMP_SERVER_PREFIX={mcServer}</span>
                            </span>
                          ) : (
                            <span>&#10007; {mcResult.error}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {platform.id === 'rednote' && (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-xs text-zinc-400 space-y-2">
                    <p className="font-medium text-zinc-300">No public API</p>
                    <p>小红书 does not offer a public analytics API. Stats shown in the Analytics page are estimated from engagement patterns.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-zinc-300">All environment variables</h3>
        <div className="font-mono text-xs text-zinc-500 space-y-0.5">
          <p><span className="text-zinc-400">FACEBOOK_APP_ID=</span><span className="text-zinc-600"> # Meta App Dashboard</span></p>
          <p><span className="text-zinc-400">FACEBOOK_APP_SECRET=</span></p>
          <p><span className="text-zinc-400">FACEBOOK_PAGE_ACCESS_TOKEN=</span><span className="text-zinc-600"> # from OAuth callback</span></p>
          <p><span className="text-zinc-400">FACEBOOK_PAGE_ID=</span></p>
          <p><span className="text-zinc-400">INSTAGRAM_ACCESS_TOKEN=</span></p>
          <p><span className="text-zinc-400">INSTAGRAM_BUSINESS_ACCOUNT_ID=</span></p>
          <p className="mt-1.5"><span className="text-zinc-400">LINKEDIN_CLIENT_ID=</span></p>
          <p><span className="text-zinc-400">LINKEDIN_CLIENT_SECRET=</span></p>
          <p><span className="text-zinc-400">LINKEDIN_ACCESS_TOKEN=</span><span className="text-zinc-600"> # from OAuth callback</span></p>
          <p><span className="text-zinc-400">LINKEDIN_ORGANIZATION_ID=</span></p>
          <p className="mt-1.5"><span className="text-zinc-400">TIKTOK_CLIENT_KEY=</span></p>
          <p><span className="text-zinc-400">TIKTOK_CLIENT_SECRET=</span></p>
          <p><span className="text-zinc-400">TIKTOK_ACCESS_TOKEN=</span><span className="text-zinc-600"> # from OAuth callback</span></p>
          <p className="mt-1.5"><span className="text-zinc-400">GOOGLE_CLIENT_ID=</span></p>
          <p><span className="text-zinc-400">GOOGLE_CLIENT_SECRET=</span></p>
          <p><span className="text-zinc-400">GOOGLE_ACCESS_TOKEN=</span><span className="text-zinc-600"> # from OAuth callback</span></p>
          <p><span className="text-zinc-400">YOUTUBE_CHANNEL_ID=</span></p>
          <p className="mt-1.5"><span className="text-zinc-400">MAILCHIMP_API_KEY=</span></p>
          <p><span className="text-zinc-400">MAILCHIMP_SERVER_PREFIX=</span></p>
        </div>
        <p className="text-xs text-zinc-600">After editing .env.local restart with <span className="font-mono text-zinc-400">npm run dev</span> or redeploy to Vercel.</p>
      </div>
    </div>
  )
}
