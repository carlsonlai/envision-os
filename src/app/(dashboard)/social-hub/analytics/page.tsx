'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart3,
  TrendingUp,
  Heart,
  Users,
  UserPlus,
  AlertCircle,
  Loader2,
  RefreshCw,
  Link2,
} from 'lucide-react'
import Link from 'next/link'

interface ApiPlatform {
  id: string
  name: string
  connected: boolean
  followers: number | null
  reach: number | null
  engagement: number | null
  posts: number | null
  error?: string
}

interface AnalyticsResponse {
  success: boolean
  connectedCount: number
  platforms: ApiPlatform[]
  lastUpdated: string
}

const PLATFORM_META = [
  { id: 'instagram', emoji: '📸', label: 'Instagram',  color: 'text-pink-400',  bg: 'bg-pink-500/10',  border: 'border-pink-500/30' },
  { id: 'facebook',  emoji: '📘', label: 'Facebook',   color: 'text-blue-400',  bg: 'bg-blue-500/10',  border: 'border-blue-500/30' },
  { id: 'tiktok',    emoji: '🎵', label: 'TikTok',     color: 'text-rose-400',  bg: 'bg-rose-500/10',  border: 'border-rose-500/30' },
  { id: 'youtube',   emoji: '▶️', label: 'YouTube',    color: 'text-red-400',   bg: 'bg-red-500/10',   border: 'border-red-500/30' },
  { id: 'linkedin',  emoji: '💼', label: 'LinkedIn',   color: 'text-sky-400',   bg: 'bg-sky-500/10',   border: 'border-sky-500/30' },
  { id: 'mailchimp', emoji: '📧', label: 'Mailchimp',  color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
]

function fmt(n: number | null): string {
  if (n === null || n === 0) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

export default function AnalyticsPage() {
  const [platforms, setPlatforms] = useState<ApiPlatform[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setSyncing(true)
    try {
      const res = await fetch('/api/social/analytics')
      if (!res.ok) return
      const data = await res.json() as AnalyticsResponse
      setPlatforms(data.platforms)
      setLastUpdated(data.lastUpdated)
    } catch { /* silent */ } finally {
      setLoading(false)
      setSyncing(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const connected = platforms.filter(p => p.connected && !p.error)
  const needsReconnect = platforms.filter(p => p.connected && p.error)
  const totalFollowers = connected.reduce((s, p) => s + (p.followers ?? 0), 0)
  const totalReach = connected.reduce((s, p) => s + (p.reach ?? 0), 0)
  const totalPosts = connected.reduce((s, p) => s + (p.posts ?? 0), 0)

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-400" />
            Analytics
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Live stats from all connected platforms
            {lastUpdated && (
              <span className="ml-2 text-zinc-600">
                · {new Date(lastUpdated).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={syncing || loading}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Single reconnect banner — not per-card noise */}
      {needsReconnect.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-300">
              {needsReconnect.map(p => p.name).join(', ')} — token expired
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">Re-run the OAuth flow to restore live data.</p>
          </div>
          <Link
            href="/admin/social-connect"
            className="flex items-center gap-1 rounded-lg bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/30 transition-colors flex-shrink-0"
          >
            <Link2 className="h-3 w-3" /> Reconnect
          </Link>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
        </div>
      ) : (
        <>
          {/* KPI totals */}
          {connected.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: Users,     label: 'Total Followers', value: fmt(totalFollowers),       color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                { icon: TrendingUp,label: 'Total Reach',     value: fmt(totalReach),           color: 'text-blue-400',    bg: 'bg-blue-500/10' },
                { icon: Heart,     label: 'Total Posts',     value: fmt(totalPosts),           color: 'text-violet-400',  bg: 'bg-violet-500/10' },
                { icon: UserPlus,  label: 'Platforms Live',  value: `${connected.length} / ${PLATFORM_META.length}`, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
              ].map(k => {
                const Icon = k.icon
                return (
                  <div key={k.label} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                    <div className={`inline-flex p-1.5 rounded-lg ${k.bg} mb-2`}>
                      <Icon className={`h-4 w-4 ${k.color}`} />
                    </div>
                    <p className="text-xl font-bold text-zinc-100">{k.value}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{k.label}</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Platform cards — real data only, no fake numbers */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">Platform Breakdown</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {PLATFORM_META.map(meta => {
                const live = platforms.find(p => p.id === meta.id)
                const isLive = live?.connected && !live?.error
                const isError = live?.connected && !!live?.error
                return (
                  <div
                    key={meta.id}
                    className={`rounded-xl border p-4 transition-opacity ${
                      isLive ? `${meta.border} ${meta.bg}` : 'border-zinc-800/60 bg-zinc-900/30 opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{meta.emoji}</span>
                        <span className="text-sm font-semibold text-zinc-200">{meta.label}</span>
                      </div>
                      {isLive && (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-[10px] text-emerald-400">Live</span>
                        </span>
                      )}
                      {isError && <span className="text-[10px] text-amber-400">Reconnect needed</span>}
                      {!live?.connected && <span className="text-[10px] text-zinc-600">Not connected</span>}
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: 'Followers',  val: isLive ? fmt(live?.followers ?? null) : '—', accent: false },
                        { label: 'Reach',      val: isLive ? fmt(live?.reach ?? null)     : '—', accent: false },
                        { label: 'Engagement', val: isLive && live?.engagement !== null ? `${live.engagement}%` : '—', accent: true },
                        { label: 'Posts',      val: isLive ? fmt(live?.posts ?? null)     : '—', accent: false },
                      ].map(row => (
                        <div key={row.label} className="flex justify-between">
                          <span className="text-xs text-zinc-500">{row.label}</span>
                          <span className={`text-xs font-semibold ${isLive ? (row.accent ? meta.color : 'text-zinc-100') : 'text-zinc-700'}`}>
                            {row.val}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Empty state */}
          {platforms.every(p => !p.connected) && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 py-16 px-8 text-center">
              <BarChart3 className="h-10 w-10 text-zinc-700 mb-4" />
              <p className="text-sm font-semibold text-zinc-400 mb-1">No platforms connected yet</p>
              <p className="text-xs text-zinc-600 mb-5 max-w-xs">
                Connect your social accounts to see live followers, reach, and engagement data.
              </p>
              <Link
                href="/admin/social-connect"
                className="flex items-center gap-2 rounded-xl bg-[#6366f1] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4f52d4] transition-colors"
              >
                <Link2 className="h-4 w-4" /> Connect Accounts
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
