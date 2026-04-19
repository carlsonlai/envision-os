'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Zap,
  Sparkles,
  Bot,
  Loader2,
  CheckCircle2,
  Calendar,
  BarChart3,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Play,
  Clock,
  TrendingUp,
  Users,
  Eye,
  Target,
  ArrowRight,
  Plus,
} from 'lucide-react'
import Link from 'next/link'
import { PostPreviewCard, PostCompactRow, type SocialPost } from '@/components/social/PostPreviewCard'

// ─── Envicion Brand Header ────────────────────────────────────────────────────

function BrandHeader() {
  return (
    <div className="flex items-center gap-3">
      {/* Logo mark */}
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] shadow-lg shadow-[#6366f1]/30">
        <Zap className="h-5 w-5 text-white" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-zinc-100 leading-tight tracking-tight">
          Content Factory
        </h1>
        <p className="text-xs text-zinc-500">
          AI generates · You approve · We publish
        </p>
      </div>
    </div>
  )
}

// ─── Pipeline KPI bar ─────────────────────────────────────────────────────────

function PipelineBar({
  pending, approved, scheduled, posted,
}: {
  pending: number; approved: number; scheduled: number; posted: number
}) {
  const stats = [
    { label: 'Awaiting Approval', value: pending, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400' },
    { label: 'Approved', value: approved, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400' },
    { label: 'Scheduled', value: scheduled, color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20', dot: 'bg-sky-400' },
    { label: 'Posted This Week', value: posted, color: 'text-zinc-300', bg: 'bg-zinc-800/40 border-zinc-700/40', dot: 'bg-zinc-400' },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map(s => (
        <div key={s.label} className={`rounded-xl border ${s.bg} px-4 py-3 flex items-center gap-3`}>
          <div className={`h-2 w-2 rounded-full flex-shrink-0 ${s.dot}`} />
          <div>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-zinc-500">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Generate batch button ────────────────────────────────────────────────────

function GenerateButton({
  loading,
  onGenerate,
}: {
  loading: boolean
  onGenerate: () => void
}) {
  return (
    <button
      type="button"
      onClick={onGenerate}
      disabled={loading}
      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#6366f1]/25 hover:opacity-90 disabled:opacity-60 transition-all"
    >
      {loading
        ? <Loader2 className="h-4 w-4 animate-spin" />
        : <Sparkles className="h-4 w-4" />}
      {loading ? 'Generating…' : 'Generate This Week'}
    </button>
  )
}

// ─── Section toggle header ────────────────────────────────────────────────────

function SectionHeader({
  label,
  count,
  open,
  onToggle,
  color = 'text-zinc-400',
}: {
  label: string; count: number; open: boolean; onToggle: () => void; color?: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-2 w-full text-left group"
    >
      <span className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{label}</span>
      <span className="rounded-full bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400 font-bold">{count}</span>
      <div className="flex-1 h-px bg-zinc-800/60" />
      {open
        ? <ChevronUp className="h-3.5 w-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
        : <ChevronDown className="h-3.5 w-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />}
    </button>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyQueue({ onGenerate, loading }: { onGenerate: () => void; loading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 py-16 px-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6366f1]/20 to-[#8b5cf6]/20 border border-[#6366f1]/20 mb-4">
        <Bot className="h-7 w-7 text-[#818cf8]" />
      </div>
      <p className="text-sm font-semibold text-zinc-200 mb-1">No posts waiting for approval</p>
      <p className="text-xs text-zinc-500 mb-6 max-w-xs">
        Hit Generate and AI will create a full week of branded content for all your platforms — ready for your review.
      </p>
      <button
        type="button"
        onClick={onGenerate}
        disabled={loading}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 transition-all"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? 'Generating…' : 'Generate This Week\'s Content'}
      </button>
    </div>
  )
}

// ─── Activity log ─────────────────────────────────────────────────────────────

function ActivityLog({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null
  return (
    <div className="rounded-xl border border-[#6366f1]/20 bg-[#6366f1]/5 p-4 space-y-1">
      <p className="text-[10px] font-semibold text-[#818cf8] uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Bot className="h-3 w-3" /> AI Activity Log
      </p>
      {lines.map((line, i) => (
        <p key={i} className="text-xs text-zinc-300 font-mono leading-relaxed">{line}</p>
      ))}
    </div>
  )
}

// ─── Approve-all banner ───────────────────────────────────────────────────────

function ApproveAllBanner({ count, onApproveAll, loading }: { count: number; onApproveAll: () => void; loading: boolean }) {
  if (count < 2) return null
  return (
    <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
      <p className="text-xs text-zinc-300">
        <span className="text-emerald-400 font-semibold">{count} posts</span> waiting — approve them all at once?
      </p>
      <button
        type="button"
        onClick={onApproveAll}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60 transition-colors"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
        Approve All
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SocialHubPage() {
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [approvingAll, setApprovingAll] = useState(false)
  const [activityLog, setActivityLog] = useState<string[]>([])

  const [showApproved, setShowApproved] = useState(true)
  const [showScheduled, setShowScheduled] = useState(true)
  const [showPosted, setShowPosted] = useState(false)

  // ── Load posts ──────────────────────────────────────────────────────────────
  const loadPosts = useCallback(async () => {
    try {
      const res = await fetch('/api/social/autopilot')
      if (!res.ok) return
      const json = await res.json() as { data: SocialPost[] }
      setPosts(json.data)
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadPosts() }, [loadPosts])

  // ── Generate week ───────────────────────────────────────────────────────────
  async function handleGenerate() {
    setGenerating(true)
    setActivityLog([])
    try {
      const res = await fetch('/api/social/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'generate' }),
      })
      const data = await res.json() as { ok: boolean; log?: string[] }
      setActivityLog(data.log ?? [])
      if (data.ok) await loadPosts()
    } catch {
      setActivityLog(['❌ Could not reach the AI engine — check ANTHROPIC_API_KEY is set in Vercel'])
    } finally {
      setGenerating(false)
    }
  }

  // ── Approve single ──────────────────────────────────────────────────────────
  async function handleApprove(id: string) {
    await fetch('/api/social/autopilot', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'approved' }),
    })
    setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'approved' } : p))
  }

  // ── Edit + save ─────────────────────────────────────────────────────────────
  async function handleEdit(id: string, caption: string, hashtags: string[]) {
    await fetch('/api/social/autopilot', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, caption, hashtags }),
    })
    setPosts(prev => prev.map(p => p.id === id ? { ...p, caption, hashtags, status: 'approved' } : p))
  }

  // ── Reject (delete) ─────────────────────────────────────────────────────────
  async function handleReject(id: string) {
    await fetch(`/api/social/autopilot?id=${id}`, { method: 'DELETE' })
    setPosts(prev => prev.filter(p => p.id !== id))
  }

  // ── Approve all pending ─────────────────────────────────────────────────────
  async function handleApproveAll() {
    setApprovingAll(true)
    const pending = posts.filter(p => p.status === 'pending')
    await Promise.all(pending.map(p =>
      fetch('/api/social/autopilot', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, status: 'approved' }),
      })
    ))
    setPosts(prev => prev.map(p => p.status === 'pending' ? { ...p, status: 'approved' } : p))
    setApprovingAll(false)
  }

  // ── Derived lists ────────────────────────────────────────────────────────────
  const pendingPosts   = posts.filter(p => p.status === 'pending')
  const approvedPosts  = posts.filter(p => p.status === 'approved')
  const scheduledPosts = posts.filter(p => p.status === 'scheduled' || p.status === 'draft')
  const postedPosts    = posts.filter(p => p.status === 'posted')

  // ── Week label ───────────────────────────────────────────────────────────────
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay() + 1)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  const weekLabel = `${weekStart.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}`

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <BrandHeader />
          <p className="text-xs text-zinc-600 pl-[52px]">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/social-hub/analytics"
            className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-all"
          >
            <BarChart3 className="h-3.5 w-3.5" /> Analytics
          </Link>
          <Link
            href="/social-hub/calendar"
            className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-all"
          >
            <Calendar className="h-3.5 w-3.5" /> Calendar
          </Link>
          <Link
            href="/social-hub/create"
            className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-all"
          >
            <Plus className="h-3.5 w-3.5" /> Manual Post
          </Link>
          <GenerateButton loading={generating} onGenerate={handleGenerate} />
        </div>
      </div>

      {/* ── Pipeline KPIs ── */}
      <PipelineBar
        pending={pendingPosts.length}
        approved={approvedPosts.length}
        scheduled={scheduledPosts.length}
        posted={postedPosts.length}
      />

      {/* ── AI Activity Log ── */}
      <ActivityLog lines={activityLog} />

      {/* ═══════════════════════════════════════════════════════════════════════
          APPROVAL QUEUE — the main section
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20">
            <span className="text-[10px] font-bold text-amber-400">{pendingPosts.length}</span>
          </div>
          <h2 className="text-sm font-semibold text-zinc-200">Approval Queue</h2>
          <div className="flex-1 h-px bg-zinc-800/60" />
          {pendingPosts.length > 0 && (
            <button
              type="button"
              onClick={loadPosts}
              className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          )}
        </div>

        <ApproveAllBanner count={pendingPosts.length} onApproveAll={handleApproveAll} loading={approvingAll} />

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#818cf8]" />
          </div>
        ) : pendingPosts.length === 0 ? (
          <EmptyQueue onGenerate={handleGenerate} loading={generating} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pendingPosts.map(post => (
              <PostPreviewCard
                key={post.id}
                post={post}
                onApprove={handleApprove}
                onEdit={handleEdit}
                onReject={handleReject}
              />
            ))}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          APPROVED — ready to schedule
      ════════════════════════════════════════════════════════════════════════ */}
      {approvedPosts.length > 0 && (
        <div className="space-y-3">
          <SectionHeader
            label="Approved — Ready to Schedule"
            count={approvedPosts.length}
            open={showApproved}
            onToggle={() => setShowApproved(v => !v)}
            color="text-emerald-400"
          />
          {showApproved && (
            <>
              <div className="space-y-2">
                {approvedPosts.map(post => (
                  <PostCompactRow key={post.id} post={post} />
                ))}
              </div>
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    await fetch('/api/social/autopilot', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ task: 'schedule' }),
                    })
                    await loadPosts()
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-400 hover:bg-sky-500/20 transition-colors"
                >
                  <Play className="h-3 w-3" /> Schedule All Approved Posts
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          SCHEDULED
      ════════════════════════════════════════════════════════════════════════ */}
      {scheduledPosts.length > 0 && (
        <div className="space-y-3">
          <SectionHeader
            label="Scheduled"
            count={scheduledPosts.length}
            open={showScheduled}
            onToggle={() => setShowScheduled(v => !v)}
            color="text-sky-400"
          />
          {showScheduled && (
            <div className="space-y-2">
              {scheduledPosts.map(post => (
                <PostCompactRow key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          POSTED — performance archive
      ════════════════════════════════════════════════════════════════════════ */}
      {postedPosts.length > 0 && (
        <div className="space-y-3">
          <SectionHeader
            label="Posted"
            count={postedPosts.length}
            open={showPosted}
            onToggle={() => setShowPosted(v => !v)}
            color="text-zinc-500"
          />
          {showPosted && (
            <div className="space-y-2">
              {postedPosts.map(post => (
                <PostCompactRow key={post.id} post={post} />
              ))}
            </div>
          )}
          {!showPosted && (
            <button
              type="button"
              onClick={() => setShowPosted(true)}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1"
            >
              <ChevronDown className="h-3 w-3" /> Show {postedPosts.length} posted posts
            </button>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          QUICK LINKS strip
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-2">
        {[
          {
            href: '/social-hub/create',
            icon: Sparkles,
            color: 'text-[#818cf8] bg-[#6366f1]/10 border-[#6366f1]/20',
            label: 'Manual Content Studio',
            desc: 'Write a specific post with custom topic, goal, and platform',
          },
          {
            href: '/social-hub/calendar',
            icon: Calendar,
            color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
            label: 'Publishing Calendar',
            desc: 'See your full posting schedule by day and platform',
          },
          {
            href: '/social-hub/analytics',
            icon: BarChart3,
            color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
            label: 'Performance Analytics',
            desc: 'Follower growth, engagement, reach and lead data',
          },
        ].map(action => {
          const Icon = action.icon
          return (
            <Link
              key={action.href}
              href={action.href}
              className={`flex items-center gap-3 rounded-xl border ${action.color} p-4 hover:opacity-80 transition-opacity`}
            >
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
  )
}
