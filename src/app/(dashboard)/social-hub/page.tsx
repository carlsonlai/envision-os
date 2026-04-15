'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { SocialScoreBadge } from '@/components/ui/SocialScoreBadge'
import { VisibilityBooster } from '@/components/social/VisibilityBooster'
import {
  TrendingUp,
  TrendingDown,
  Zap,
  Plus,
  Users,
  Heart,
  Eye,
  MessageCircle,
  ArrowRight,
  BarChart3,
  Target,
  Flame,
  Calendar,
  Sparkles,
  Bot,
  User,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Send,
  Clock,
  Play,
} from 'lucide-react'

type AIMode = 'autopilot' | 'copilot'

interface Platform {
  id: string
  name: string
  emoji: string
  color: string
  bg: string
  border: string
  followers: number
  followerDelta: number
  engagement: number
  reach: number
  leads: number
  connected: boolean
}

interface RecentPost {
  id: string
  platform: string
  content: string
  postedAt: string
  likes: number
  comments: number
  reach: number
  leads: number
  score: number
}

// Static platform metadata (colours, names) — data is merged from DB at runtime
const PLATFORM_META: Omit<Platform, 'followers' | 'followerDelta' | 'engagement' | 'reach' | 'leads' | 'connected'>[] = [
  { id: 'instagram', name: 'Instagram',        emoji: '📸', color: 'text-pink-400',   bg: 'bg-pink-500/10',   border: 'border-pink-500/30'  },
  { id: 'tiktok',    name: 'TikTok',            emoji: '🎵', color: 'text-rose-400',   bg: 'bg-rose-500/10',   border: 'border-rose-500/30'  },
  { id: 'linkedin',  name: 'LinkedIn',          emoji: '💼', color: 'text-sky-400',    bg: 'bg-sky-500/10',    border: 'border-sky-500/30'   },
  { id: 'facebook',  name: 'Facebook',          emoji: '📘', color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30'  },
  { id: 'youtube',   name: 'YouTube',           emoji: '▶️', color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30'   },
  { id: 'rednote',   name: '小红书 (RedNote)',   emoji: '📕', color: 'text-red-300',    bg: 'bg-red-500/5',     border: 'border-red-400/20'   },
  { id: 'mailchimp', name: 'Mailchimp',         emoji: '✉️', color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30' },
]

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '\ud83d\udcf8',
  linkedin: '\ud83d\udcbc',
  facebook: '\ud83d\udcda',
  twitter: '\ud83d\udc26',
}

const AUTOPILOT_TASKS = [
  { id: 'generate', label: 'Auto-generate weekly content', desc: 'AI writes all posts for next 7 days', status: 'active' },
  { id: 'schedule', label: 'Auto-schedule at peak times', desc: 'Posts go live at optimal engagement windows', status: 'active' },
  { id: 'hashtags', label: 'Auto-optimise hashtags', desc: 'AI refreshes hashtag sets weekly', status: 'active' },
  { id: 'reply', label: 'Auto-reply to comments', desc: 'AI drafts and sends first replies', status: 'paused' },
  { id: 'leads', label: 'Auto-DM warm leads', desc: 'AI messages users who engage 3+ times', status: 'paused' },
]

function ModeBadge({ mode }: { mode: AIMode }) {
  if (mode === 'autopilot') {
    return (
      <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
        <Play className="h-2.5 w-2.5" /> Autopilot
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 rounded-full border border-[#6366f1]/30 bg-[#6366f1]/10 px-2 py-0.5 text-[10px] font-semibold text-[#818cf8]">
      <User className="h-2.5 w-2.5" /> Co-pilot
    </span>
  )
}

export default function SocialHubPage() {
  const [mode, setMode] = useState<AIMode>('copilot')
  const [period, setPeriod] = useState<'7d' | '30d'>('7d')
  const [taskStates, setTaskStates] = useState<Record<string, string>>(
    Object.fromEntries(AUTOPILOT_TASKS.map(t => [t.id, t.status]))
  )
  const [runningTask, setRunningTask] = useState<string | null>(null)
  const [doneTask, setDoneTask] = useState<Set<string>>(new Set())
  const [approvals, setApprovals] = useState<Record<string, 'pending' | 'approved' | 'rejected'>>({})
  const [dbStats, setDbStats] = useState<Record<string, Partial<Platform>>>({})
  const [statsLoading, setStatsLoading] = useState(true)
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([])
  const [aiInsights, setAiInsights] = useState<{ icon: string; text: string }[]>([])

  // ── Persist mode + taskStates ──────────────────────────────────────────────
  const prefsLoaded = useRef(false)

  // Load saved prefs on mount
  useEffect(() => {
    async function loadPrefs() {
      try {
        const res = await fetch('/api/social/hub-prefs')
        if (!res.ok) return
        interface HubPrefsResponse { success: boolean; data: { mode: string; taskStates: Record<string, string> } }
        const json = await res.json() as HubPrefsResponse
        if (!json.success) return
        if (json.data.mode === 'autopilot' || json.data.mode === 'copilot') {
          setMode(json.data.mode as AIMode)
        }
        if (Object.keys(json.data.taskStates).length > 0) {
          setTaskStates(prev => ({ ...prev, ...json.data.taskStates }))
        }
      } catch {
        // silently fall back to defaults
      } finally {
        prefsLoaded.current = true
      }
    }
    void loadPrefs()
  }, [])

  const savePrefs = useCallback((nextMode: AIMode, nextStates: Record<string, string>) => {
    if (!prefsLoaded.current) return
    void fetch('/api/social/hub-prefs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: nextMode, taskStates: nextStates }),
    })
  }, [])

  // Wrap setMode to also persist
  const setModeAndSave = useCallback((next: AIMode) => {
    setMode(next)
    setTaskStates(prev => {
      savePrefs(next, prev)
      return prev
    })
  }, [savePrefs])
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch('/api/social/platform-stats')
        if (!res.ok) return
        interface PlatformStatsRow { id: string; followers: number; followerGrowth: number; engagement: number; reach: number; leads: number }
        const json = await res.json() as { hasData: boolean; platforms: PlatformStatsRow[] }
        if (!json.hasData) return
        const map: Record<string, Partial<Platform>> = {}
        for (const p of json.platforms) {
          if (p.followers > 0) {
            map[p.id] = {
              followers:    p.followers,
              followerDelta: Math.round(p.followers * p.followerGrowth / 100 / 4), // approx weekly delta
              engagement:   p.engagement,
              reach:        p.reach,
              leads:        p.leads,
              connected:    true,
            }
          }
        }
        setDbStats(map)
      } catch {
        // fall through — demo data remains
      } finally {
        setStatsLoading(false)
      }
    }
    void loadStats()
  }, [])

  // Fetch real recent posts from autopilot queue
  useEffect(() => {
    async function loadRecentPosts() {
      try {
        const res = await fetch('/api/social/autopilot')
        if (!res.ok) return
        interface AutopilotPost { id: string; platform: string; caption: string; hashtags: string[]; status: string; postedAt: string | null; scheduledAt: string | null; createdAt: string }
        const json = await res.json() as { data: AutopilotPost[] }
        const posted = json.data
          .filter(p => p.status === 'posted' || p.status === 'scheduled')
          .slice(0, 4)
          .map(p => ({
            id: p.id,
            platform: p.platform,
            content: p.caption.slice(0, 120),
            postedAt: p.postedAt ? new Date(p.postedAt).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' }) : 'Scheduled',
            likes: 0,
            comments: 0,
            reach: 0,
            leads: 0,
            score: 0,
          }))
        setRecentPosts(posted)
      } catch { /* silent */ }
    }
    void loadRecentPosts()
  }, [])

  // Fetch AI insights from stored optimisation report
  useEffect(() => {
    async function loadInsights() {
      try {
        const res = await fetch('/api/social/config?key=optimisation_report')
        if (!res.ok) return
        interface OptimisationReport { recommendations: Array<{ platform: string; action: string; reason: string; priority: string }>; summary: string }
        const json = await res.json() as { data: OptimisationReport | null }
        if (!json.data?.recommendations) return
        const icons: Record<string, string> = { high: '🔥', medium: '📌', low: '💡' }
        setAiInsights(
          json.data.recommendations.slice(0, 4).map(r => ({
            icon: icons[r.priority] ?? '💡',
            text: `[${r.platform}] ${r.action} — ${r.reason}`,
          }))
        )
      } catch { /* silent */ }
    }
    void loadInsights()
  }, [])

  // Merge DB stats (real) over demo fallbacks
  const platforms: Platform[] = PLATFORM_META.map(meta => {
    const real = dbStats[meta.id]
    const demo = { followers: 0, followerDelta: 0, engagement: 0, reach: 0, leads: 0 }
    return {
      ...meta,
      followers:    real?.followers    ?? demo.followers,
      followerDelta: real?.followerDelta ?? demo.followerDelta,
      engagement:   real?.engagement   ?? demo.engagement,
      reach:        real?.reach        ?? demo.reach,
      leads:        real?.leads        ?? demo.leads,
      connected:    real?.connected    ?? false,
    }
  })

  const hasRealData = Object.keys(dbStats).length > 0
  const totalFollowers = platforms.reduce((s, p) => s + p.followers, 0)
  const totalLeads = platforms.reduce((s, p) => s + p.leads, 0)
  const totalReach = platforms.reduce((s, p) => s + p.reach, 0)
  const avgEngagement = (platforms.reduce((s, p) => s + p.engagement, 0) / platforms.length).toFixed(1)

  // Map UI task IDs to autopilot engine task names
  const TASK_API_MAP: Record<string, string> = {
    generate: 'generate',
    schedule: 'schedule',
    hashtags: 'hashtags',
    reply:    'generate',   // AI reply drafts — uses generate pipeline
    leads:    'generate',   // Auto-DM warm leads — uses generate pipeline
  }

  const [taskLog, setTaskLog] = useState<string[]>([])

  async function runTask(id: string) {
    setRunningTask(id)
    setTaskLog([])

    if (mode === 'autopilot') {
      // Call the real autopilot engine
      try {
        const apiTask = TASK_API_MAP[id] ?? id
        const res = await fetch('/api/social/autopilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task: apiTask }),
        })
        const data = await res.json() as { ok: boolean; log: string[] }
        setTaskLog(data.log ?? [])
        if (data.ok) {
          setDoneTask(prev => new Set([...prev, id]))
        }
      } catch {
        setTaskLog(['❌ Connection error — check your API configuration'])
      }
    } else {
      // Co-pilot mode: generate a draft for human review
      try {
        const res = await fetch('/api/social/autopilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task: 'generate' }),
        })
        const data = await res.json() as { ok: boolean; log: string[] }
        setTaskLog(data.log ?? [])
      } catch {
        setTaskLog(['❌ Connection error — check your API configuration'])
      }
      setApprovals(prev => ({ ...prev, [id]: 'pending' }))
    }

    setRunningTask(null)
  }

  function approveTask(id: string) {
    setApprovals(prev => ({ ...prev, [id]: 'approved' }))
    setDoneTask(prev => new Set([...prev, id]))
  }

  function toggleTask(id: string) {
    setTaskStates(prev => {
      const next = { ...prev, [id]: prev[id] === 'active' ? 'paused' : 'active' }
      savePrefs(mode, next)
      return next
    })
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#818cf8]" />
            Social Media AI Hub
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">AI generates, schedules, posts, and optimises all your social content</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* AI MODE TOGGLE */}
          <div className="flex items-center gap-1 rounded-xl border border-zinc-700 bg-zinc-900 p-1">
            <button type="button"
              onClick={() => setModeAndSave('copilot')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${mode === 'copilot' ? 'bg-[#6366f1] text-white shadow-lg shadow-[#6366f1]/20' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <User className="h-3.5 w-3.5" /> Co-pilot
            </button>
            <button type="button"
              onClick={() => setModeAndSave('autopilot')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${mode === 'autopilot' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Bot className="h-3.5 w-3.5" /> Autopilot
            </button>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
            {(['7d', '30d'] as const).map(p => (
              <button type="button" key={p} onClick={() => setPeriod(p)} className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${period === p ? 'bg-[#6366f1] text-white' : 'text-zinc-500 hover:text-zinc-200'}`}>
                {p === '7d' ? '7 days' : '30 days'}
              </button>
            ))}
          </div>
          <Link href="/social-hub/create" className="flex items-center gap-2 rounded-lg bg-[#6366f1] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#5558e3] transition-colors">
            <Plus className="h-3.5 w-3.5" />
            Create Content
          </Link>
        </div>
      </div>

      {/* Mode banner */}
      {mode === 'autopilot' ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-4 flex items-center gap-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
            <Bot className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-400">Autopilot Mode — AI runs your social media end-to-end</p>
            <p className="text-xs text-zinc-400 mt-0.5">AI generates content, schedules at peak times, posts automatically, and optimises based on performance. No approval needed.</p>
          </div>
          <button type="button" onClick={() => setModeAndSave('copilot')} className="flex-shrink-0 text-xs text-zinc-500 hover:text-zinc-300 transition-colors underline">Switch to Co-pilot</button>
        </div>
      ) : (
        <div className="rounded-xl border border-[#6366f1]/30 bg-[#6366f1]/5 px-5 py-4 flex items-center gap-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#6366f1]/20">
            <User className="h-5 w-5 text-[#818cf8]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#818cf8]">Co-pilot Mode — AI assists, you approve before anything goes live</p>
            <p className="text-xs text-zinc-400 mt-0.5">AI drafts content and suggests actions. You review and approve each step before it\u2019s published or sent.</p>
          </div>
          <button type="button" onClick={() => setModeAndSave('autopilot')} className="flex-shrink-0 text-xs text-zinc-500 hover:text-zinc-300 transition-colors underline">Switch to Autopilot</button>
        </div>
      )}

      {/* Top stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total Followers', value: totalFollowers.toLocaleString(), icon: Users, color: 'text-[#818cf8]', bg: 'bg-[#6366f1]/5 border-[#6366f1]/20', delta: '+268 this week' },
          { label: 'Total Reach', value: totalReach.toLocaleString(), icon: Eye, color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/20', delta: 'unique accounts' },
          { label: 'Avg Engagement', value: `${avgEngagement}%`, icon: Heart, color: 'text-pink-400', bg: 'bg-pink-500/5 border-pink-500/20', delta: 'industry avg 2.1%' },
          { label: 'Leads from Social', value: String(totalLeads), icon: Target, color: 'text-amber-400', bg: 'bg-amber-500/5 border-amber-500/20', delta: 'this week' },
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

      {/* AI Task Control Panel */}
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#818cf8]" />
            <h2 className="text-sm font-semibold text-zinc-200">AI Automation Tasks</h2>
          </div>
          <ModeBadge mode={mode} />
        </div>
        {/* Autopilot Activity Log */}
        {taskLog.length > 0 && (
          <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/60 p-3 space-y-1">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-2">AI Activity Log</p>
            {taskLog.map((line, i) => (
              <p key={i} className="text-xs text-zinc-300 font-mono leading-relaxed">{line}</p>
            ))}
          </div>
        )}
        <div className="space-y-2">
          {AUTOPILOT_TASKS.map(task => {
            const isRunning = runningTask === task.id
            const isDone = doneTask.has(task.id)
            const approval = approvals[task.id]
            const isActive = taskStates[task.id] === 'active'

            return (
              <div key={task.id} className={`rounded-xl border px-4 py-3 transition-all ${isDone ? 'border-emerald-500/30 bg-emerald-500/5' : isActive ? 'border-zinc-700/60 bg-zinc-800/30' : 'border-zinc-800/40 bg-zinc-900/20 opacity-60'}`}>
                <div className="flex items-center gap-3">
                  {/* Toggle */}
                  <button type="button"
                    onClick={() => toggleTask(task.id)}
                    className={`relative flex-shrink-0 h-5 w-9 rounded-full overflow-hidden transition-colors ${isActive ? 'bg-[#6366f1]' : 'bg-zinc-700'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-[18px]' : 'translate-x-0'}`} />
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-zinc-200">{task.label}</p>
                    <p className="text-[10px] text-zinc-500">{task.desc}</p>
                  </div>

                  {/* Status / Action */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isDone ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Done
                      </span>
                    ) : approval === 'pending' ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-amber-400 font-semibold">Review ready</span>
                        <button type="button" onClick={() => approveTask(task.id)} className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                          <CheckCircle2 className="h-3 w-3" /> Approve
                        </button>
                        <button type="button" onClick={() => setApprovals(prev => ({ ...prev, [task.id]: 'rejected' }))} className="rounded-lg border border-zinc-700 px-2.5 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors">
                          Skip
                        </button>
                      </div>
                    ) : isRunning ? (
                      <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {mode === 'autopilot' ? 'Running...' : 'Preparing...'}
                      </span>
                    ) : isActive ? (
                      <button type="button"
                        onClick={() => runTask(task.id)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                          mode === 'autopilot'
                            ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30'
                            : 'bg-[#6366f1]/10 border border-[#6366f1]/30 text-[#818cf8] hover:bg-[#6366f1]/20'
                        }`}
                      >
                        {mode === 'autopilot' ? <><Play className="h-3 w-3" /> Run Now</> : <><Bot className="h-3 w-3" /> Generate Draft</>}
                      </button>
                    ) : (
                      <span className="text-[10px] text-zinc-600">Paused</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Envicion Visibility Booster */}
      <VisibilityBooster />

      {/* Platform cards */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Connected Platforms</h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          {platforms.map(p => (
            <div key={p.id} className={`rounded-xl border ${p.border} ${p.bg} p-4 space-y-3 ${!p.connected ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{p.emoji}</span>
                  <p className={`text-sm font-semibold ${p.color}`}>{p.name}</p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${p.connected ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-zinc-500 border-zinc-700'}`}>
                  {p.connected ? 'Live' : 'Connect'}
                </span>
              </div>
              <div>
                <p className={`text-xl font-bold ${p.color}`}>{p.followers.toLocaleString()}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  {p.followerDelta >= 0
                    ? <TrendingUp className="h-3 w-3 text-emerald-400" />
                    : <TrendingDown className="h-3 w-3 text-red-400" />
                  }
                  <span className={`text-[10px] font-medium ${p.followerDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {p.followerDelta >= 0 ? '+' : ''}{p.followerDelta} this week
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-zinc-800/40">
                {[
                  { label: 'Eng', value: `${p.engagement}%` },
                  { label: 'Reach', value: p.reach >= 1000 ? `${(p.reach / 1000).toFixed(1)}k` : String(p.reach) },
                  { label: 'Leads', value: String(p.leads) },
                ].map(m => (
                  <div key={m.label} className="text-center">
                    <p className="text-xs font-bold text-zinc-200">{m.value}</p>
                    <p className="text-[9px] text-zinc-600">{m.label}</p>
                  </div>
                ))}
              </div>
              {p.connected && (
                <button
                  type="button"
                  onClick={() => {
                    if (mode === 'autopilot') {
                      setRunningTask('post_now')
                      fetch('/api/social/autopilot', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ task: 'post_now' }),
                      })
                        .then(r => r.json())
                        .then((data: { ok: boolean; log: string[] }) => { setTaskLog(data.log ?? []); setRunningTask(null) })
                        .catch(() => setRunningTask(null))
                    }
                  }}
                  className={`cursor-pointer w-full rounded-lg border py-1.5 text-[10px] font-semibold transition-colors ${
                    mode === 'autopilot'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      : 'border-[#6366f1]/30 bg-[#6366f1]/10 text-[#818cf8] hover:bg-[#6366f1]/20'
                  }`}>
                  {runningTask === 'post_now' ? '⏳ Posting...' : mode === 'autopilot' ? '⚡ Auto-Post Now' : '✏️ Draft Post'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* AI Insights */}
        <div className="rounded-xl border border-[#6366f1]/20 bg-[#6366f1]/5 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#818cf8]" />
              <h2 className="text-sm font-semibold text-zinc-200">AI Insights & Recommendations</h2>
            </div>
            <ModeBadge mode={mode} />
          </div>
          <div className="space-y-2">
            {aiInsights.length === 0 ? (
              <p className="text-xs text-zinc-500 py-2">No insights yet — run the autopilot optimiser to generate recommendations.</p>
            ) : aiInsights.map((insight, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-lg border border-zinc-800/30 bg-zinc-900/50 px-3 py-2.5">
                <span className="text-base flex-shrink-0">{insight.icon}</span>
                <p className="text-xs text-zinc-300 leading-relaxed flex-1">{insight.text}</p>
                <button type="button" className={`cursor-pointer flex-shrink-0 rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                  mode === 'autopilot'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                    : 'border-[#6366f1]/30 bg-[#6366f1]/10 text-[#818cf8] hover:bg-[#6366f1]/20'
                }`}>
                  {mode === 'autopilot' ? 'Apply' : 'Review'}
                </button>
              </div>
            ))}
          </div>
          <Link href="/social-hub/analytics" className="flex items-center gap-1.5 text-xs text-[#818cf8] hover:text-[#a5b4fc] transition-colors mt-1">
            View full analysis <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Quick actions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Quick Actions</h2>
            <ModeBadge mode={mode} />
          </div>
          {[
            {
              href: '/social-hub/create',
              icon: Sparkles,
              color: 'text-[#818cf8] bg-[#6366f1]/10 border-[#6366f1]/20',
              label: mode === 'autopilot' ? 'Auto-Generate & Post' : 'AI Draft Content',
              desc: mode === 'autopilot' ? 'AI creates, schedules, and posts without review' : 'AI generates content for your review before posting',
            },
            {
              href: '/social-hub/calendar',
              icon: Calendar,
              color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
              label: mode === 'autopilot' ? 'Auto-Fill This Week' : 'Plan This Week',
              desc: mode === 'autopilot' ? 'AI schedules all 7 posts for optimal reach' : 'Review and approve AI\u2019s suggested weekly plan',
            },
            {
              href: '/social-hub/analytics',
              icon: BarChart3,
              color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
              label: mode === 'autopilot' ? 'Auto-Apply Optimisations' : 'Review Performance',
              desc: mode === 'autopilot' ? 'AI applies all recommendations to the content plan' : 'See AI insights and choose which to apply',
            },
          ].map(action => {
            const Icon = action.icon
            return (
              <Link key={action.href} href={action.href} className={`flex items-center gap-3 rounded-xl border ${action.color} p-4 hover:opacity-80 transition-opacity`}>
                <Icon className="h-5 w-5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-200">{action.label}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{action.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-600 flex-shrink-0" />
              </Link>
            )
          })}
        </div>
      </div>

      {/* Recent posts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Recent Post Performance</h2>
          <Link href="/social-hub/analytics" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">View all</Link>
        </div>
        <div className="space-y-2">
          {recentPosts.length === 0 ? (
            <p className="text-xs text-zinc-500 py-2 text-center rounded-xl border border-zinc-800/40 bg-zinc-900/30 py-6">No posts yet — generate content with the autopilot to see performance here.</p>
          ) : recentPosts.map(post => (
            <div key={post.id} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3 flex items-center gap-4">
              <span className="text-base flex-shrink-0">{PLATFORM_ICONS[post.platform]}</span>
              <p className="text-xs text-zinc-300 flex-1 min-w-0 line-clamp-1">{post.content}</p>
              <div className="flex items-center gap-3 flex-shrink-0 text-xs text-zinc-500">
                <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {post.likes}</span>
                <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {post.comments}</span>
                <span className="flex items-center gap-1 text-amber-400"><Flame className="h-3 w-3" /> {post.leads} leads</span>
                <span className="text-zinc-600">{post.postedAt}</span>
                {post.score > 0 && <SocialScoreBadge score={post.score} />}
                <button type="button" className={`cursor-pointer rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                  mode === 'autopilot'
                    ? 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10'
                    : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
                }`}>
                  {mode === 'autopilot' ? '↺ Repost' : '✏️ Repurpose'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
