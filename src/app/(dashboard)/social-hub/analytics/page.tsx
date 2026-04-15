'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { SocialScoreBadge } from '@/components/ui/SocialScoreBadge'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Eye,
  Heart,
  MessageCircle,
  Target,
  Users,
  Zap,
  ArrowRight,
  Flame,
  ArrowLeft,
  Star,
  Clock,
  Globe,
  Bot,
  User,
  Play,
  CheckCircle2,
  Loader2,
  Wifi,
  WifiOff,
  RefreshCw,
  Settings,
} from 'lucide-react'

type AIMode = 'autopilot' | 'copilot'

interface LivePlatformData {
  id: string
  connected: boolean
  followers: number | null
  reach: number | null
  engagement: number | null
  posts: number | null
  error?: string
}

interface SocialAnalyticsResponse {
  success: boolean
  connectedCount: number
  totalPlatforms: number
  platforms: LivePlatformData[]
  lastUpdated: string
}

interface ManualPlatformStat {
  id: string
  name: string
  followers: number
  followerGrowth: number
  reach: number
  engagement: number
  leads: number
  posts: number
  likes: number
  comments: number
  score: number
  bestTime: string
}

interface PlatformStatsResponse {
  hasData: boolean
  platforms: ManualPlatformStat[]
}

interface PlatformStat {
  id: string
  name: string
  emoji: string
  color: string
  bg: string
  border: string
  followers: number
  followerGrowth: number
  reach: number
  engagement: number
  leads: number
  posts: number
  bestTime: string
  score: number
}

interface TopPost {
  id: string
  platform: string
  emoji: string
  content: string
  likes: number
  comments: number
  reach: number
  leads: number
  score: number
  postedAt: string
  type: string
}

interface Insight {
  icon: string
  category: string
  text: string
  impact: 'high' | 'medium' | 'low'
  action: string
}

const PLATFORM_STATS: PlatformStat[] = [
  {
    id: 'instagram',
    name: 'Instagram',
    emoji: '📸',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/30',
    followers: 0,
    followerGrowth: 0,
    reach: 0,
    engagement: 0,
    leads: 0,
    posts: 0,
    bestTime: 'Tue & Thu 8–9 AM',
    score: 0,
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    emoji: '🎵',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    followers: 0,
    followerGrowth: 0,
    reach: 0,
    engagement: 0,
    leads: 0,
    posts: 0,
    bestTime: 'Fri & Sat 7–9 PM',
    score: 0,
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    emoji: '💼',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    followers: 0,
    followerGrowth: 0,
    reach: 0,
    engagement: 0,
    leads: 0,
    posts: 0,
    bestTime: 'Mon & Wed 9 AM',
    score: 0,
  },
  {
    id: 'facebook',
    name: 'Facebook',
    emoji: '📘',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    followers: 0,
    followerGrowth: 0,
    reach: 0,
    engagement: 0,
    leads: 0,
    posts: 0,
    bestTime: 'Wed 12 PM',
    score: 0,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    emoji: '▶️',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    followers: 0,
    followerGrowth: 0,
    reach: 0,
    engagement: 0,
    leads: 0,
    posts: 0,
    bestTime: 'Sat & Sun 10 AM',
    score: 0,
  },
  {
    id: 'rednote',
    name: '小红书 (RedNote)',
    emoji: '📕',
    color: 'text-red-300',
    bg: 'bg-red-500/5',
    border: 'border-red-400/20',
    followers: 0,
    followerGrowth: 0,
    reach: 0,
    engagement: 0,
    leads: 0,
    posts: 0,
    bestTime: 'Wed & Sun 8 PM',
    score: 0,
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    emoji: '✉️',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    followers: 0,
    followerGrowth: 0,
    reach: 0,
    engagement: 0,
    leads: 0,
    posts: 0,
    bestTime: 'Tue 10 AM',
    score: 0,
  },
]

const TOP_POSTS: TopPost[] = []

const BOTTOM_POSTS: TopPost[] = []

const AI_INSIGHTS: Insight[] = []

const LEAD_ATTRIBUTION: Array<{ platform: string; leads: number; pct: number; color: string }> = []

const CONTENT_TYPE_PERF: Array<{ type: string; avgScore: number; avgLeads: number; posts: number }> = []

function ImpactBadge({ impact }: { impact: 'high' | 'medium' | 'low' }) {
  const styles = {
    high: 'text-red-400 bg-red-500/10 border-red-500/20',
    medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    low: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
  }
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[impact]}`}>
      {impact} impact
    </span>
  )
}

export default function SocialAnalyticsPage() {
  const [mode, setMode] = useState<AIMode>('copilot')
  const [period, setPeriod] = useState<'7d' | '30d'>('7d')

  useEffect(() => {
    fetch('/api/social/hub-prefs')
      .then(r => r.ok ? r.json() as Promise<{ data: { mode: string } }> : null)
      .then(json => {
        if (json?.data?.mode === 'autopilot' || json?.data?.mode === 'copilot') {
          setMode(json.data.mode as AIMode)
        }
      })
      .catch(() => {})
  }, [])

  const switchMode = useCallback((next: AIMode) => {
    setMode(next)
    void fetch('/api/social/hub-prefs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: next }),
    })
  }, [])
  const [activeTab, setActiveTab] = useState<'overview' | 'content' | 'leads' | 'pipeline' | 'insights'>('overview')
  const [appliedInsights, setAppliedInsights] = useState<Set<number>>(new Set())
  const [applyingIndex, setApplyingIndex] = useState<number | null>(null)
  const [allApplied, setAllApplied] = useState(false)
  const [liveData, setLiveData] = useState<SocialAnalyticsResponse | null>(null)
  const [liveLoading, setLiveLoading] = useState(true)
  const [liveError, setLiveError] = useState<string | null>(null)
  const [manualData, setManualData] = useState<ManualPlatformStat[] | null>(null)
  const [topPosts, setTopPosts] = useState<TopPost[]>([])
  const [aiInsightsLive, setAiInsightsLive] = useState<Insight[]>([])

  // Fetch real scheduled/posted content for top-posts display
  useEffect(() => {
    async function loadPosts() {
      try {
        const res = await fetch('/api/social/autopilot')
        if (!res.ok) return
        interface AutopilotRow { id: string; platform: string; caption: string; hashtags: string[]; status: string; postedAt: string | null }
        const PLATFORM_EMOJI: Record<string, string> = { instagram: '📸', linkedin: '💼', facebook: '📘', twitter: '🐦', tiktok: '🎵', youtube: '▶️', rednote: '📕', mailchimp: '✉️' }
        const json = await res.json() as { data: AutopilotRow[] }
        const mapped: TopPost[] = json.data
          .filter(p => p.status === 'posted' || p.status === 'scheduled')
          .slice(0, 6)
          .map(p => ({
            id: p.id,
            platform: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
            emoji: PLATFORM_EMOJI[p.platform] ?? '📱',
            content: p.caption.slice(0, 120),
            likes: 0, comments: 0, reach: 0, leads: 0, score: 0,
            postedAt: p.postedAt ? new Date(p.postedAt).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' }) : 'Scheduled',
            type: 'Post',
          }))
        setTopPosts(mapped)
      } catch { /* silent */ }
    }
    void loadPosts()
  }, [])

  // Fetch real AI insights from optimisation report
  useEffect(() => {
    async function loadInsights() {
      try {
        const res = await fetch('/api/social/config?key=optimisation_report')
        if (!res.ok) return
        interface OptimisationReport { recommendations: Array<{ platform: string; action: string; reason: string; priority: string }>; summary: string }
        const json = await res.json() as { data: OptimisationReport | null }
        if (!json.data?.recommendations) return
        const ICON: Record<string, string> = { high: '🔥', medium: '📌', low: '💡' }
        setAiInsightsLive(
          json.data.recommendations.map(r => ({
            icon: ICON[r.priority] ?? '💡',
            category: r.platform.charAt(0).toUpperCase() + r.platform.slice(1),
            text: `${r.action} — ${r.reason}`,
            impact: r.priority as 'high' | 'medium' | 'low',
            action: r.action,
          }))
        )
      } catch { /* silent */ }
    }
    void loadInsights()
  }, [])

  useEffect(() => {
    async function fetchAllData() {
      try {
        setLiveLoading(true)
        // Fetch both sources in parallel
        const [liveRes, manualRes] = await Promise.allSettled([
          fetch('/api/social/analytics'),
          fetch('/api/social/platform-stats'),
        ])

        if (liveRes.status === 'fulfilled' && liveRes.value.ok) {
          const data: SocialAnalyticsResponse = await liveRes.value.json()
          setLiveData(data)
        }

        if (manualRes.status === 'fulfilled' && manualRes.value.ok) {
          const data: PlatformStatsResponse = await manualRes.value.json()
          if (data.hasData && data.platforms.length > 0) {
            setManualData(data.platforms)
          }
        }
      } catch (err: unknown) {
        setLiveError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLiveLoading(false)
      }
    }
    void fetchAllData()
  }, [])

  // Priority: live API (when connected) > manual DB entries > hardcoded demo data
  const mergedStats = PLATFORM_STATS.map(p => {
    const manual = manualData?.find(m => m.id === p.id)
    const live = liveData?.platforms.find(l => l.id === p.id)

    // Start with the static platform defaults (colors, emoji, etc.)
    // then apply manual DB values if available
    const withManual: PlatformStat = manual ? {
      ...p,
      followers:      manual.followers      > 0 ? manual.followers      : p.followers,
      followerGrowth: manual.followerGrowth !== 0 ? manual.followerGrowth : p.followerGrowth,
      reach:          manual.reach          > 0 ? manual.reach          : p.reach,
      engagement:     manual.engagement     > 0 ? manual.engagement     : p.engagement,
      leads:          manual.leads          > 0 ? manual.leads          : p.leads,
      posts:          manual.posts          > 0 ? manual.posts          : p.posts,
      score:          manual.score          > 0 ? manual.score          : p.score,
      bestTime:       manual.bestTime       || p.bestTime,
    } : p

    // Override with live API data if the platform is connected
    if (!live?.connected) return withManual
    return {
      ...withManual,
      followers:  live.followers  ?? withManual.followers,
      reach:      live.reach      ?? withManual.reach,
      engagement: live.engagement ?? withManual.engagement,
      posts:      live.posts      ?? withManual.posts,
    }
  })

  function applyInsight(i: number) {
    setAppliedInsights(prev => new Set([...prev, i]))
  }

  function applyAllInsights() {
    const all = new Set(aiInsightsLive.map((_, i) => i))
    setAppliedInsights(all)
    setAllApplied(true)
  }

  const totalLeads = mergedStats.reduce((s, p) => s + p.leads, 0)
  const totalReach = mergedStats.reduce((s, p) => s + p.reach, 0)
  const totalFollowers = mergedStats.reduce((s, p) => s + p.followers, 0)
  const avgScore = mergedStats.length > 0 ? Math.round(mergedStats.reduce((s, p) => s + p.score, 0) / mergedStats.length) : 0
  const connectedCount = liveData?.connectedCount ?? 0
  const manualDataCount = manualData?.filter(m => m.followers > 0).length ?? 0
  const hasRealData = connectedCount > 0 || manualDataCount > 0

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/social-hub"
            className="flex items-center justify-center h-7 w-7 rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-amber-400" />
              Social Analytics
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">AI analysis of what\u2019s working and where to improve</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 rounded-xl border border-zinc-700 bg-zinc-900 p-1">
            <button type="button"
              onClick={() => switchMode('copilot')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${mode === 'copilot' ? 'bg-[#6366f1] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <User className="h-3.5 w-3.5" /> Co-pilot
            </button>
            <button type="button"
              onClick={() => switchMode('autopilot')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${mode === 'autopilot' ? 'bg-emerald-500 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Bot className="h-3.5 w-3.5" /> Autopilot
            </button>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
            {(['7d', '30d'] as const).map(p => (
              <button type="button"
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  period === p ? 'bg-[#6366f1] text-white' : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {p === '7d' ? '7 days' : '30 days'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Live data connection status banner */}
      <div className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-3 ${
        liveLoading
          ? 'border-zinc-700/60 bg-zinc-900/40'
          : hasRealData
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-amber-500/30 bg-amber-500/5'
      }`}>
        <div className="flex items-center gap-2.5">
          {liveLoading ? (
            <Loader2 className="h-4 w-4 text-zinc-500 animate-spin" />
          ) : hasRealData ? (
            <Wifi className="h-4 w-4 text-emerald-400" />
          ) : (
            <WifiOff className="h-4 w-4 text-amber-400" />
          )}
          <div>
            {liveLoading ? (
              <p className="text-xs text-zinc-400">Loading your stats…</p>
            ) : liveError ? (
              <p className="text-xs text-red-400">Could not reach analytics API — showing saved stats</p>
            ) : connectedCount > 0 ? (
              <p className="text-xs text-emerald-400 font-medium">
                {connectedCount} platform{connectedCount > 1 ? 's' : ''} live
                {manualDataCount > 0 && ` · ${manualDataCount} with saved stats`}
                {liveData?.lastUpdated && (
                  <span className="text-zinc-500 font-normal ml-2">Updated {new Date(liveData.lastUpdated).toLocaleTimeString()}</span>
                )}
              </p>
            ) : manualDataCount > 0 ? (
              <p className="text-xs text-emerald-400 font-medium">
                Showing your real stats for {manualDataCount} platform{manualDataCount > 1 ? 's' : ''}
              </p>
            ) : (
              <p className="text-xs text-amber-400 font-medium">
                No stats entered yet — enter your real numbers to see analytics
              </p>
            )}
            {!liveLoading && (
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {connectedCount === 0 && manualDataCount === 0
                  ? 'Enter your real numbers in Account Stats, or connect API keys for automatic sync'
                  : connectedCount === 0
                  ? `Connect API keys for automatic live sync — ${7 - manualDataCount} platforms still on saved stats only`
                  : `${7 - connectedCount} platform${7 - connectedCount > 1 ? 's' : ''} still using saved stats only`}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              setLiveLoading(true)
              Promise.allSettled([
                fetch('/api/social/analytics'),
                fetch('/api/social/platform-stats'),
              ]).then(async ([liveRes, manualRes]) => {
                if (liveRes.status === 'fulfilled' && liveRes.value.ok) {
                  const d: SocialAnalyticsResponse = await liveRes.value.json()
                  setLiveData(d)
                  setLiveError(null)
                }
                if (manualRes.status === 'fulfilled' && manualRes.value.ok) {
                  const d: PlatformStatsResponse = await manualRes.value.json()
                  if (d.hasData) setManualData(d.platforms)
                }
              }).catch((e: Error) => setLiveError(e.message))
                .finally(() => setLiveLoading(false))
            }}
            disabled={liveLoading}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${liveLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href="/social-hub/settings"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <Settings className="h-3 w-3" />
            Account Stats
          </Link>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total Reach', value: totalReach.toLocaleString(), icon: Eye, color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/20', delta: 'unique accounts' },
          { label: 'Total Leads', value: String(totalLeads), icon: Target, color: 'text-amber-400', bg: 'bg-amber-500/5 border-amber-500/20', delta: 'from social this week' },
          { label: 'Avg Content Score', value: String(avgScore), icon: Star, color: 'text-[#818cf8]', bg: 'bg-[#6366f1]/5 border-[#6366f1]/20', delta: 'industry avg 58' },
          { label: 'Followers', value: totalFollowers.toLocaleString(), icon: Users, color: 'text-pink-400', bg: 'bg-pink-500/5 border-pink-500/20', delta: '+268 this week' },
        ].map(stat => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className={`rounded-xl border ${stat.bg} p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${stat.color}`} />
                <p className="text-xs text-zinc-500">{stat.label}</p>
              </div>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">{stat.delta}</p>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/50 p-1 w-fit">
        {([
          { key: 'overview', label: 'Platform Overview' },
          { key: 'content', label: 'Content Performance' },
          { key: 'leads', label: 'Lead Attribution' },
          { key: 'pipeline', label: '🎯 Lead Pipeline' },
          { key: 'insights', label: 'AI Insights' },
        ] as const).map(tab => (
          <button type="button"
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.key ? 'bg-[#6366f1] text-white' : 'text-zinc-500 hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Platform Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {mergedStats.map(p => (
            <div key={p.id} className={`rounded-xl border ${p.border} ${p.bg} p-5`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{p.emoji}</span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className={`text-sm font-semibold ${p.color}`}>{p.name}</p>
                      {liveData?.platforms.find(l => l.id === p.id)?.connected && (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                          LIVE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {p.followerGrowth >= 0
                        ? <TrendingUp className="h-3 w-3 text-emerald-400" />
                        : <TrendingDown className="h-3 w-3 text-red-400" />
                      }
                      <span className={`text-[10px] font-medium ${p.followerGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {p.followerGrowth >= 0 ? '+' : ''}{p.followerGrowth}% growth
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <SocialScoreBadge score={p.score} />
                  <span className="text-xs text-zinc-500">platform score</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {[
                  { label: 'Followers', value: p.followers.toLocaleString(), icon: Users },
                  { label: 'Reach', value: p.reach >= 1000 ? `${(p.reach / 1000).toFixed(1)}k` : String(p.reach), icon: Eye },
                  { label: 'Engagement', value: `${p.engagement}%`, icon: Heart },
                  { label: 'Leads', value: String(p.leads), icon: Target },
                  { label: 'Posts', value: String(p.posts), icon: BarChart3 },
                  { label: 'Best Time', value: p.bestTime, icon: Clock },
                ].map(m => {
                  const Icon = m.icon
                  return (
                    <div key={m.label} className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-3 py-2">
                      <div className="flex items-center gap-1 mb-1">
                        <Icon className="h-3 w-3 text-zinc-600" />
                        <p className="text-[10px] text-zinc-500">{m.label}</p>
                      </div>
                      <p className="text-xs font-bold text-zinc-200">{m.value}</p>
                    </div>
                  )
                })}
              </div>
              {/* Score bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-zinc-600">Platform health score</span>
                  <span className="text-[10px] text-zinc-500">{p.score}/100</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-zinc-800/60">
                  <div
                    className={`h-1.5 rounded-full transition-all ${p.score >= 85 ? 'bg-emerald-400' : p.score >= 65 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${p.score}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Content Performance */}
      {activeTab === 'content' && (
        <div className="space-y-6">
          {/* Top performers */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              Top Performing Posts
            </h2>
            <div className="space-y-2">
              {topPosts.map(post => (
                <div key={post.id} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className="text-base flex-shrink-0 mt-0.5">{post.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-zinc-500">{post.platform}</span>
                        <span className="text-[10px] rounded-full border border-[#6366f1]/30 bg-[#6366f1]/10 text-[#818cf8] px-1.5 py-0.5">{post.type}</span>
                        <span className="text-[10px] text-zinc-600">{post.postedAt}</span>
                      </div>
                      <p className="text-xs text-zinc-300 line-clamp-1">{post.content}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 text-xs text-zinc-500">
                      <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {post.likes}</span>
                      <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {post.comments}</span>
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {post.reach.toLocaleString()}</span>
                      <span className="flex items-center gap-1 text-amber-400"><Flame className="h-3 w-3" /> {post.leads} leads</span>
                      <SocialScoreBadge score={post.score} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom performers */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <TrendingDown className="h-3.5 w-3.5 text-red-400" />
              Underperforming Posts \u2014 AI Will Avoid These Formats
            </h2>
            <div className="space-y-2">
              {topPosts.filter(p => p.score === 0).map(post => (
                <div key={post.id} className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className="text-base flex-shrink-0 mt-0.5">{post.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-zinc-500">{post.platform}</span>
                        <span className="text-[10px] rounded-full border border-red-500/30 bg-red-500/10 text-red-400 px-1.5 py-0.5">{post.type}</span>
                        <span className="text-[10px] text-zinc-600">{post.postedAt}</span>
                      </div>
                      <p className="text-xs text-zinc-300 line-clamp-1">{post.content}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 text-xs text-zinc-500">
                      <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {post.likes}</span>
                      <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {post.comments}</span>
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {post.reach.toLocaleString()}</span>
                      <span className="flex items-center gap-1 text-zinc-600"><Flame className="h-3 w-3" /> 0 leads</span>
                      <SocialScoreBadge score={post.score} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Content type breakdown */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Content Type Performance</h2>
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800/60">
                    <th className="text-left text-zinc-500 font-medium px-4 py-3">Content Type</th>
                    <th className="text-center text-zinc-500 font-medium px-3 py-3">Posts</th>
                    <th className="text-center text-zinc-500 font-medium px-3 py-3">Avg Score</th>
                    <th className="text-center text-zinc-500 font-medium px-3 py-3">Avg Leads</th>
                    <th className="text-right text-zinc-500 font-medium px-4 py-3">Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {CONTENT_TYPE_PERF.map((row, i) => (
                    <tr key={row.type} className={i < CONTENT_TYPE_PERF.length - 1 ? 'border-b border-zinc-800/40' : ''}>
                      <td className="px-4 py-2.5 text-zinc-200 font-medium">{row.type}</td>
                      <td className="px-3 py-2.5 text-center text-zinc-400">{row.posts}</td>
                      <td className="px-3 py-2.5 text-center">
                        <SocialScoreBadge score={row.avgScore} />
                      </td>
                      <td className="px-3 py-2.5 text-center text-amber-400 font-semibold">{row.avgLeads}</td>
                      <td className="px-4 py-2.5 text-right">
                        {row.avgScore >= 80
                          ? <span className="text-emerald-400 text-[10px]">↑ Increase frequency</span>
                          : row.avgScore >= 60
                          ? <span className="text-amber-400 text-[10px]">→ Optimise format</span>
                          : <span className="text-red-400 text-[10px]">✕ Remove from plan</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Lead Attribution */}
      {activeTab === 'leads' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* By platform */}
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                <Globe className="h-4 w-4 text-[#818cf8]" />
                Leads by Platform
              </h2>
              <div className="space-y-3">
                {LEAD_ATTRIBUTION.map(p => (
                  <div key={p.platform}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-300">{p.platform}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-400">{p.leads} leads</span>
                        <span className="text-[10px] text-zinc-500">{p.pct}%</span>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-zinc-800/60">
                      <div className={`h-2 rounded-full ${p.color}`} style={{ width: `${p.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-zinc-800/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Total leads this week</span>
                  <span className="text-sm font-bold text-amber-400">{totalLeads}</span>
                </div>
              </div>
            </div>

            {/* Lead quality */}
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-400" />
                Lead Quality by Platform
              </h2>
              <div className="space-y-2">
                {[
                  { platform: 'LinkedIn', quality: 'High', conversion: '18%', avgDeal: 'RM 8,200', color: 'text-emerald-400' },
                  { platform: 'Mailchimp', quality: 'High', conversion: '14%', avgDeal: 'RM 7,600', color: 'text-emerald-400' },
                  { platform: 'Instagram', quality: 'Medium', conversion: '9%', avgDeal: 'RM 4,100', color: 'text-amber-400' },
                  { platform: 'TikTok', quality: 'Medium', conversion: '7%', avgDeal: 'RM 3,400', color: 'text-amber-400' },
                  { platform: 'YouTube', quality: 'Medium', conversion: '8%', avgDeal: 'RM 5,200', color: 'text-amber-400' },
                  { platform: '小红书', quality: 'Medium', conversion: '5%', avgDeal: 'RM 2,900', color: 'text-amber-400' },
                  { platform: 'Facebook', quality: 'Low', conversion: '4%', avgDeal: 'RM 2,800', color: 'text-red-400' },
                ].map(row => (
                  <div key={row.platform} className="flex items-center justify-between rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-3 py-2.5">
                    <span className="text-xs text-zinc-300">{row.platform}</span>
                    <div className="flex items-center gap-4 text-xs">
                      <span className={`font-semibold ${row.color}`}>{row.quality}</span>
                      <span className="text-zinc-500">{row.conversion} conv.</span>
                      <span className="text-zinc-400">{row.avgDeal} avg</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-[#6366f1]/20 bg-[#6366f1]/5 px-3 py-2.5">
                <p className="text-xs text-zinc-300">
                  <span className="text-[#818cf8] font-semibold">AI Recommendation:</span>{' '}
                  LinkedIn and Mailchimp leads convert 3–4× higher than social media. Grow the email list from every platform and drive professionals to LinkedIn content to maximise ROI.
                </p>
              </div>
            </div>
          </div>

          {/* Lead-generating posts */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Top Lead-Generating Posts</h2>
            <div className="space-y-2">
              {[...topPosts].sort((a, b) => b.leads - a.leads).map(post => (
                <div key={post.id} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3 flex items-center gap-4">
                  <span className="text-base flex-shrink-0">{post.emoji}</span>
                  <p className="text-xs text-zinc-300 flex-1 min-w-0 line-clamp-1">{post.content}</p>
                  <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                    <span className="text-zinc-500">{post.platform}</span>
                    <span className="flex items-center gap-1 font-bold text-amber-400">
                      <Flame className="h-3 w-3" /> {post.leads} leads
                    </span>
                    <SocialScoreBadge score={post.score} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Lead Pipeline */}
      {activeTab === 'pipeline' && (
        <div className="space-y-6">

          {/* How we get leads — visual funnel */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5">
            <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2 mb-4">
              <Target className="h-4 w-4 text-amber-400" />
              How Envicion OS Turns Social Followers Into Paying Clients
            </h2>
            <div className="space-y-2">
              {[
                {
                  step: '1',
                  label: 'Attract',
                  platforms: 'TikTok · Instagram · 小红书 · YouTube',
                  desc: 'Before/After videos and educational reels pull cold audiences. AI picks the best posting time for each platform so every post gets maximum reach.',
                  color: 'border-pink-500/30 bg-pink-500/5',
                  badge: 'text-pink-400',
                  metric: '89,840 weekly reach',
                },
                {
                  step: '2',
                  label: 'Engage',
                  platforms: 'LinkedIn · Facebook · Instagram Stories',
                  desc: 'Case studies, thought-leadership posts, and client testimonials turn viewers into engaged followers who trust the brand. AI flags which post formats generate the most comments.',
                  color: 'border-sky-500/30 bg-sky-500/5',
                  badge: 'text-sky-400',
                  metric: '65 leads tracked this week',
                },
                {
                  step: '3',
                  label: 'Capture',
                  platforms: 'Instagram Bio Link · TikTok Linktree · LinkedIn Lead Gen',
                  desc: 'Every platform bio points to a single landing page with a free brand audit offer. Mailchimp captures the email address. From this point Envicion OS owns the lead — no algorithm dependency.',
                  color: 'border-amber-500/30 bg-amber-500/5',
                  badge: 'text-amber-400',
                  metric: '11 email leads this week (best conv. rate)',
                },
                {
                  step: '4',
                  label: 'Nurture',
                  platforms: 'Mailchimp · WhatsApp',
                  desc: 'A 5-email welcome sequence delivers value: brand tips, case studies, pricing guide. After email 3, a WhatsApp follow-up is sent. Leads warm up before ever speaking to sales.',
                  color: 'border-emerald-500/30 bg-emerald-500/5',
                  badge: 'text-emerald-400',
                  metric: '38.2% avg email open rate',
                },
                {
                  step: '5',
                  label: 'Convert',
                  platforms: 'Envicion OS CRM',
                  desc: 'Hot leads are automatically created in the CRM as Enquiries. The sales team gets a Lark notification with lead source, platform, and which content they engaged with — closing becomes data-driven.',
                  color: 'border-[#6366f1]/30 bg-[#6366f1]/5',
                  badge: 'text-[#818cf8]',
                  metric: 'LinkedIn: 18% conv · Mailchimp: 14% conv',
                },
              ].map((s, i, arr) => (
                <div key={s.step}>
                  <div className={`rounded-xl border ${s.color} p-4`}>
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full border ${s.color} font-bold text-sm ${s.badge}`}>
                        {s.step}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${s.badge}`}>{s.label}</span>
                            <span className="text-[10px] text-zinc-500">{s.platforms}</span>
                          </div>
                          <span className={`text-[10px] font-semibold rounded-full border px-2 py-0.5 ${s.color} ${s.badge}`}>
                            {s.metric}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">{s.desc}</p>
                      </div>
                    </div>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="flex justify-center py-0.5">
                      <span className="text-zinc-600 text-sm">↓</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Quick wins — what to do right now */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
            <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4 text-amber-400" />
              Quick Wins — Do These This Week to Get More Leads
            </h2>
            <div className="space-y-2">
              {[
                { action: 'Add email capture link to Instagram & TikTok bios', impact: 'Est. +4 leads/week', effort: '10 min', done: false },
                { action: 'Create a "Free Brand Audit" landing page (Envicion OS can generate this)', impact: 'Unlock paid email funnels', effort: '30 min', done: false },
                { action: 'Set up a 5-email Mailchimp welcome sequence for new subscribers', impact: '+14% conversion on email leads', effort: '2 hrs', done: false },
                { action: 'Cross-post top TikTok videos directly to 小红书', impact: 'Est. +12 RedNote followers/week', effort: '5 min/post', done: false },
                { action: 'Increase YouTube publishing to 2 videos/week', impact: 'Est. reach +11,000/week', effort: '1 extra video', done: false },
                { action: 'Connect Instagram & LinkedIn APIs in Settings', impact: 'Replace demo data with live numbers', effort: '15 min', done: false },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-3 py-2.5">
                  <CheckCircle2 className="h-4 w-4 text-zinc-700 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-300 font-medium">{item.action}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-amber-400">{item.impact}</span>
                      <span className="text-[10px] text-zinc-600">⏱ {item.effort}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Real data unlock CTA */}
          <div className="rounded-xl border border-[#6366f1]/30 bg-[#6366f1]/5 p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                <Wifi className="h-4 w-4 text-[#818cf8]" />
                Connect your accounts to unlock real data
              </p>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Right now the analytics show <span className="text-amber-400">demo numbers</span>. Once you add your API keys
                in Settings → Social Accounts, Envicion OS will pull live followers, reach, and engagement
                from every platform and update every hour. The lead pipeline will then track exactly which post
                brought each client in.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {['Instagram', 'Facebook', 'YouTube', 'LinkedIn', 'TikTok', 'Mailchimp'].map(p => {
                  const isConnected = liveData?.platforms.find(l => l.id.toLowerCase() === p.toLowerCase() || (p === '小红书' && l.id === 'rednote'))?.connected
                  return (
                    <span key={p} className={`text-[10px] rounded-full border px-2 py-0.5 font-semibold ${
                      isConnected
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : 'border-zinc-700 bg-zinc-800 text-zinc-500'
                    }`}>
                      {isConnected ? '✓' : '○'} {p}
                    </span>
                  )
                })}
              </div>
            </div>
            <Link
              href="/social-hub/settings"
              className="flex-shrink-0 flex items-center gap-2 rounded-lg bg-[#6366f1] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4f46e5] transition-colors whitespace-nowrap"
            >
              Connect Accounts <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Tab: AI Insights */}
      {activeTab === 'insights' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#6366f1]/20 bg-[#6366f1]/5 p-4 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-[#818cf8]" />
                <h2 className="text-sm font-semibold text-zinc-200">AI Performance Analysis</h2>
              </div>
              <p className="text-xs text-zinc-400">
                {period === '7d' ? 'Last 7 days' : 'Last 30 days'} across all platforms. {appliedInsights.size} of {aiInsightsLive.length} recommendations applied.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Mode toggle */}
              <div className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 p-0.5">
                <button type="button" onClick={() => switchMode('copilot')} className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold transition-all ${mode === 'copilot' ? 'bg-[#6366f1] text-white' : 'text-zinc-500'}`}>
                  <User className="h-3 w-3" /> Co-pilot
                </button>
                <button type="button" onClick={() => switchMode('autopilot')} className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold transition-all ${mode === 'autopilot' ? 'bg-emerald-500 text-white' : 'text-zinc-500'}`}>
                  <Bot className="h-3 w-3" /> Autopilot
                </button>
              </div>
              {/* Apply all */}
              {!allApplied ? (
                <button type="button"
                  onClick={applyAllInsights}
                  disabled={applyingIndex !== null}
                  className={`cursor-pointer flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                    mode === 'autopilot'
                      ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30'
                      : 'bg-[#6366f1]/10 border border-[#6366f1]/30 text-[#818cf8] hover:bg-[#6366f1]/20'
                  }`}
                >
                  {applyingIndex === -1 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : mode === 'autopilot' ? <Bot className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
                  {mode === 'autopilot' ? 'Auto-Apply All' : 'Apply All'}
                </button>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" /> All Applied
                </span>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {aiInsightsLive.map((insight, i) => {
              const isApplied = appliedInsights.has(i)
              const isApplying = applyingIndex === i
              return (
                <div key={i} className={`rounded-xl border p-4 space-y-2.5 transition-all ${isApplied ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800/60 bg-zinc-900/40'}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0">{insight.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">{insight.category}</span>
                        <ImpactBadge impact={insight.impact} />
                        {isApplied && <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold"><CheckCircle2 className="h-3 w-3" /> Applied</span>}
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">{insight.text}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-8">
                    <div className="flex items-center gap-1.5 rounded-lg border border-[#6366f1]/20 bg-[#6366f1]/5 px-3 py-1.5 flex-1">
                      <ArrowRight className="h-3 w-3 text-[#818cf8]" />
                      <span className="text-xs text-[#818cf8] font-medium">{insight.action}</span>
                    </div>
                    {!isApplied ? (
                      <button type="button"
                        onClick={() => applyInsight(i)}
                        disabled={isApplying || applyingIndex !== null}
                        className={`flex-shrink-0 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                          mode === 'autopilot'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                            : 'border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                        }`}
                      >
                        {isApplying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : mode === 'autopilot' ? <Play className="h-3.5 w-3.5" /> : null}
                        {isApplying ? 'Applying...' : mode === 'autopilot' ? 'Apply Now' : 'Apply'}
                      </button>
                    ) : (
                      <span className="flex-shrink-0 flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Done
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {allApplied && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-emerald-400">All {aiInsightsLive.length} recommendations applied</p>
                <p className="text-xs text-zinc-500 mt-0.5">Content plan, schedule, and platform allocation updated</p>
              </div>
              <Link
                href="/social-hub/calendar"
                className="flex-shrink-0 flex items-center gap-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-4 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 transition-colors whitespace-nowrap"
              >
                View Calendar <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
