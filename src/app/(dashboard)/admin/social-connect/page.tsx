'use client'

import { useEffect, useState } from 'react'
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
} from 'lucide-react'

interface ConnectionStatus {
  facebook_app: boolean
  facebook_page: boolean
  instagram: boolean
  linkedin: boolean
  tiktok: boolean
  youtube: boolean
  whatsapp: boolean
}

const PLATFORM_META: Array<{
  key: keyof ConnectionStatus
  label: string
  icon: string
  color: string
  setupUrl: string
  note: string
}> = [
  {
    key: 'facebook_page',
    label: 'Facebook Pages',
    icon: '📘',
    color: 'text-blue-400',
    setupUrl: '',  // handled via OAuth button below
    note: 'Required for posting to Facebook pages',
  },
  {
    key: 'instagram',
    label: 'Instagram Business',
    icon: '📸',
    color: 'text-pink-400',
    setupUrl: '',
    note: 'Linked via Facebook Page — same OAuth flow',
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    icon: '💼',
    color: 'text-blue-500',
    setupUrl: 'https://www.linkedin.com/developers/apps',
    note: 'Requires Marketing Developer Platform access (1–2 day approval)',
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    icon: '🎵',
    color: 'text-zinc-300',
    setupUrl: 'https://ads.tiktok.com/marketing_api/homepage',
    note: 'Requires Business API approval (3–7 days)',
  },
  {
    key: 'youtube',
    label: 'YouTube',
    icon: '▶️',
    color: 'text-red-400',
    setupUrl: 'https://console.cloud.google.com',
    note: 'Analytics only — enable YouTube Data API v3',
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp (360dialog)',
    icon: '💬',
    color: 'text-emerald-400',
    setupUrl: 'https://hub.360dialog.com',
    note: 'For outbound WhatsApp messaging',
  },
]

export default function SocialConnectPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [authUrl, setAuthUrl] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') router.push('/command')
  }, [status, session, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetchStatus()
  }, [status])

  async function fetchStatus() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/social-connect?action=status')
      if (res.ok) {
        const data = await res.json() as { status: ConnectionStatus }
        setConnectionStatus(data.status)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleConnectMeta() {
    setConnecting(true)
    try {
      const res = await fetch('/api/admin/social-connect?action=auth_url')
      if (res.ok) {
        const data = await res.json() as { url: string }
        setAuthUrl(data.url)
        // Open OAuth in new tab
        window.open(data.url, '_blank', 'width=600,height=700,scrollbars=yes')
      }
    } catch {
      alert('Failed to generate auth URL. Check FACEBOOK_APP_ID is set in .env.local')
    } finally {
      setConnecting(false)
    }
  }

  const metaAppConfigured = connectionStatus?.facebook_app

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Link2 className="h-5 w-5 text-[#818cf8]" />
            Social Media Connections
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Connect your platforms so Autopilot can post, analyse, and optimise automatically
          </p>
        </div>
        <button
          type="button"
          onClick={fetchStatus}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </button>
      </div>

      {/* Meta OAuth Card — primary CTA */}
      <div className="rounded-xl border border-[#6366f1]/30 bg-[#6366f1]/5 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">🔗</div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-zinc-100">Connect Facebook & Instagram</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              One OAuth flow connects both. Your App ID{' '}
              <span className="font-mono text-[#818cf8]">1518882096466890</span> is already configured.
            </p>
          </div>
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border ${metaAppConfigured ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-zinc-700 bg-zinc-800 text-zinc-500'}`}>
            {metaAppConfigured ? <><CheckCircle2 className="h-3 w-3" /> App Ready</> : <><XCircle className="h-3 w-3" /> App not configured</>}
          </div>
        </div>

        <div className="space-y-2 text-xs text-zinc-400">
          <p className="font-medium text-zinc-300">What this grants:</p>
          <ul className="space-y-1 ml-3">
            <li>✓ Post to your Facebook Page</li>
            <li>✓ Post to Instagram Business (if linked to the page)</li>
            <li>✓ Read page analytics and engagement</li>
            <li>✓ Manage scheduled posts</li>
          </ul>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleConnectMeta}
            disabled={connecting || !metaAppConfigured}
            className="flex items-center gap-2 rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5558e3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            {connecting ? 'Opening…' : 'Connect via Facebook OAuth'}
          </button>
          {!metaAppConfigured && (
            <p className="text-xs text-amber-400">Add FACEBOOK_APP_ID to .env.local first</p>
          )}
        </div>

        {authUrl && (
          <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-xs">
            <p className="text-zinc-400 mb-1">If the popup was blocked, open this URL manually:</p>
            <a href={authUrl} target="_blank" rel="noreferrer" className="text-[#818cf8] break-all hover:underline">
              {authUrl.slice(0, 80)}…
            </a>
          </div>
        )}

        {/* After OAuth, user lands on callback page — remind them */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 flex items-start gap-2 text-xs text-zinc-500">
          <Shield className="h-3.5 w-3.5 mt-0.5 shrink-0 text-zinc-600" />
          After approving, you&apos;ll see your Page tokens displayed. Copy them into <span className="font-mono text-zinc-400 mx-1">.env.local</span> and restart the dev server.
        </div>
      </div>

      {/* All platforms status grid */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-800">
        <div className="px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-300">Platform Status</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-zinc-600">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          PLATFORM_META.map(platform => {
            const connected = connectionStatus?.[platform.key] ?? false
            return (
              <div key={platform.key} className="flex items-center gap-4 px-5 py-4">
                <span className="text-xl w-8 text-center">{platform.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${platform.color}`}>{platform.label}</p>
                  <p className="text-xs text-zinc-500">{platform.note}</p>
                </div>
                <div className="flex items-center gap-3">
                  {connected ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-zinc-600">
                      <XCircle className="h-3.5 w-3.5" /> Not connected
                    </span>
                  )}
                  {platform.setupUrl && !connected && (
                    <a
                      href={platform.setupUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-[#818cf8] hover:text-[#a5b4fc] transition-colors"
                    >
                      Setup <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Env file hint */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-zinc-300">Other platforms — paste tokens into .env.local</h3>
        <div className="font-mono text-xs text-zinc-500 space-y-1">
          <p><span className="text-zinc-400">LINKEDIN_ACCESS_TOKEN=</span><span className="text-zinc-600"># from linkedin.com/developers</span></p>
          <p><span className="text-zinc-400">LINKEDIN_ORGANIZATION_ID=</span><span className="text-zinc-600"># from your company page URL</span></p>
          <p><span className="text-zinc-400">YOUTUBE_API_KEY=</span><span className="text-zinc-600"># from console.cloud.google.com</span></p>
          <p><span className="text-zinc-400">WHATSAPP_360DIALOG_API_KEY=</span><span className="text-zinc-600"># from hub.360dialog.com → Developers</span></p>
          <p><span className="text-zinc-400">TIKTOK_ACCESS_TOKEN=</span><span className="text-zinc-600"># from ads.tiktok.com/marketing_api</span></p>
        </div>
        <p className="text-xs text-zinc-600">After editing .env.local, restart with <span className="font-mono text-zinc-400">npm run dev</span></p>
      </div>
    </div>
  )
}
