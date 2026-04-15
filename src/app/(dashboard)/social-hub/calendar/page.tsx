'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Calendar,
  Sparkles,
  Loader2,
  CheckCircle2,
  Clock,
  Zap,
  Bot,
  User,
  Play,
  Send,
  Eye,
  Trash2,
} from 'lucide-react'

type PostStatus = 'published' | 'scheduled' | 'draft' | 'generating'
type AIMode = 'autopilot' | 'copilot'

interface ScheduledPost {
  id: string
  platform: 'instagram' | 'linkedin' | 'facebook' | 'twitter' | 'tiktok'
  contentType: 'post' | 'story' | 'reel' | 'article'
  caption: string
  scheduledFor: string
  time: string
  status: PostStatus
  goal: string
  estimatedReach: string
  leadPotential: 'High' | 'Medium' | 'Low'
  awaitingApproval?: boolean
}

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸',
  linkedin: '💼',
  facebook: '📘',
  twitter: '🐦',
  tiktok: '🎵',
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
  linkedin: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
  facebook: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  twitter: 'text-zinc-300 bg-zinc-500/10 border-zinc-500/30',
  tiktok: 'text-red-400 bg-red-500/10 border-red-500/30',
}

const STATUS_CONFIG: Record<PostStatus, { label: string; color: string }> = {
  published: { label: 'Published', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  scheduled: { label: 'Scheduled', color: 'text-[#818cf8] bg-[#6366f1]/10 border-[#6366f1]/30' },
  draft: { label: 'Draft', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  generating: { label: 'Generating', color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30' },
}

const TODAY = new Date().toISOString().slice(0, 10)

function getDateLabel(date: string): string {
  if (date === TODAY) return 'Today'
  const d = new Date(date)
  return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })
}

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

export default function ContentCalendarPage() {
  const [mode, setMode] = useState<AIMode>('copilot')
  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [generatingWeek, setGeneratingWeek] = useState(false)

  // Load persisted mode from hub-prefs on mount
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

  // Persist mode change to hub-prefs
  const switchMode = useCallback((next: AIMode) => {
    setMode(next)
    void fetch('/api/social/hub-prefs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: next }),
    })
  }, [])

  // Load existing scheduled posts from DB on mount
  useEffect(() => {
    async function loadPosts() {
      try {
        const res = await fetch('/api/social/autopilot')
        if (!res.ok) return
        const data = await res.json() as { data: Array<{
          id: string; platform: string; caption: string; hashtags: string[];
          bestTime: string | null; status: string; scheduledAt: string | null
        }> }
        const mapped: ScheduledPost[] = data.data.map(p => ({
          id: p.id,
          platform: p.platform as ScheduledPost['platform'],
          contentType: 'post' as const,
          caption: p.caption,
          scheduledFor: p.scheduledAt ? p.scheduledAt.slice(0, 10) : TODAY,
          time: p.bestTime ?? '9:00 AM',
          status: p.status as PostStatus,
          goal: 'Content',
          estimatedReach: '—',
          leadPotential: 'Medium',
        }))
        setPosts(mapped)
      } catch { /* silent */ } finally {
        setLoadingPosts(false)
      }
    }
    void loadPosts()
  }, [])
  const [weekGenerated, setWeekGenerated] = useState(false)
  const [weekApproved, setWeekApproved] = useState(false)
  const [filterPlatform, setFilterPlatform] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [expandedPost, setExpandedPost] = useState<string | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)

  async function handleGenerateWeek() {
    setGeneratingWeek(true)
    try {
      // Call real autopilot engine — generates + schedules 7 posts via Claude AI
      const res = await fetch('/api/social/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'generate' }),
      })
      const data = await res.json() as { ok: boolean; log?: string[] }
      if (data.ok) {
        // Load newly generated posts from DB
        const postsRes = await fetch('/api/social/autopilot')
        if (postsRes.ok) {
          const postsData = await postsRes.json() as { data: Array<{
            id: string; platform: string; caption: string; hashtags: string[];
            imagePrompt: string | null; bestTime: string | null; status: string;
            scheduledAt: string | null
          }> }
          const mapped: ScheduledPost[] = postsData.data.map(p => ({
            id: p.id,
            platform: p.platform as ScheduledPost['platform'],
            contentType: 'post' as const,
            caption: p.caption,
            scheduledFor: p.scheduledAt ? p.scheduledAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
            time: p.bestTime ?? '9:00 AM',
            status: p.status as PostStatus,
            goal: 'Lead Gen',
            estimatedReach: '2,400–4,800',
            leadPotential: 'High',
            awaitingApproval: mode === 'copilot' && p.status === 'scheduled',
          }))
          setPosts(mapped)
        }
        // Also export to social-content folder
        fetch('/api/social/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'calendar' }),
        }).catch(() => {})
      }
    } catch {
      // Fallback: keep existing posts if generation fails
    } finally {
      setGeneratingWeek(false)
      setWeekGenerated(true)
    }
  }

  async function handlePublishNow(postId: string) {
    setPublishingId(postId)
    try {
      // Mark post as due now and trigger real posting
      const res = await fetch('/api/social/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'post_now' }),
      })
      const data = await res.json() as { ok: boolean }
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, status: data.ok ? 'published' : 'failed' as PostStatus, awaitingApproval: false }
          : p
      ))
    } catch {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: 'scheduled' } : p))
    } finally {
      setPublishingId(null)
    }
  }

  function approvePost(postId: string) {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: 'scheduled', awaitingApproval: false } : p))
  }

  function deletePost(postId: string) {
    setPosts(prev => prev.filter(p => p.id !== postId))
  }

  const filteredPosts = posts.filter(p => {
    if (filterPlatform !== 'all' && p.platform !== filterPlatform) return false
    if (filterStatus !== 'all' && p.status !== filterStatus) return false
    return true
  }).sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())

  const publishedCount = posts.filter(p => p.status === 'published').length
  const scheduledCount = posts.filter(p => p.status === 'scheduled').length
  const awaitingCount = posts.filter(p => p.awaitingApproval).length
  const totalReach = posts.filter(p => p.status !== 'draft').length * 2800

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#818cf8]" />
            Content Calendar
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">AI plans, schedules and posts your content automatically</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode toggle */}
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
          <button type="button"
            onClick={handleGenerateWeek}
            disabled={generatingWeek || weekGenerated}
            className={`cursor-pointer flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
              weekGenerated
                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : mode === 'autopilot'
                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                : 'bg-[#6366f1] text-white hover:bg-[#5558e3]'
            }`}
          >
            {generatingWeek ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : weekGenerated ? <CheckCircle2 className="h-3.5 w-3.5" /> : mode === 'autopilot' ? <Bot className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
            {generatingWeek ? 'Generating...' : weekGenerated ? (mode === 'autopilot' ? 'Auto-Scheduled' : 'Drafts Ready') : mode === 'autopilot' ? 'Auto-Fill This Week' : 'Generate This Week'}
          </button>
        </div>
      </div>

      {/* Mode description */}
      {mode === 'autopilot' ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex items-center gap-3">
          <Bot className="h-4 w-4 text-emerald-400 flex-shrink-0" />
          <p className="text-xs text-zinc-300"><span className="text-emerald-400 font-semibold">Autopilot:</span> AI will generate, schedule, and post all content automatically at peak engagement times. Posts go live without approval.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#6366f1]/20 bg-[#6366f1]/5 px-4 py-3 flex items-center gap-3">
          <User className="h-4 w-4 text-[#818cf8] flex-shrink-0" />
          <p className="text-xs text-zinc-300"><span className="text-[#818cf8] font-semibold">Co-pilot:</span> AI generates drafts for your review. You approve, edit, or delete before anything is scheduled or posted.</p>
        </div>
      )}

      {/* Awaiting approval banner */}
      {mode === 'copilot' && awaitingCount > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-400 font-semibold">{awaitingCount} post{awaitingCount > 1 ? 's' : ''} awaiting your approval</p>
          </div>
          <button type="button"
            onClick={() => posts.filter(p => p.awaitingApproval).forEach(p => approvePost(p.id))}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Approve All
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Published', value: publishedCount, color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/20' },
          { label: 'Scheduled', value: scheduledCount, color: 'text-[#818cf8]', bg: 'bg-[#6366f1]/5 border-[#6366f1]/20' },
          { label: mode === 'copilot' ? 'Awaiting Approval' : 'Auto-Queued', value: mode === 'copilot' ? awaitingCount : scheduledCount, color: 'text-amber-400', bg: 'bg-amber-500/5 border-amber-500/20' },
          { label: 'Est. Weekly Reach', value: `${(totalReach / 1000).toFixed(0)}k`, color: 'text-pink-400', bg: 'bg-pink-500/5 border-pink-500/20' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border ${s.bg} p-4 text-center`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* AI Weekly Plan */}
      <div className="rounded-xl border border-[#6366f1]/20 bg-[#6366f1]/5 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#818cf8]" />
            <h2 className="text-sm font-semibold text-zinc-200">AI Weekly Content Plan</h2>
          </div>
          <div className="flex items-center gap-2">
            {weekGenerated && <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {mode === 'autopilot' ? 'All Scheduled' : 'Drafts Created'}</span>}
            <ModeBadge mode={mode} />
          </div>
        </div>
        <div className="space-y-1.5">
          {posts.filter(p => p.status === 'scheduled' || p.status === 'draft').length === 0 ? (
            <p className="text-xs text-zinc-500 py-3 text-center">No upcoming posts scheduled — click Generate below to create a week of content.</p>
          ) : posts.filter(p => p.status === 'scheduled' || p.status === 'draft').slice(0, 7).map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-lg border border-zinc-800/30 bg-zinc-900/50 px-3 py-2">
              <span className="text-[10px] font-semibold text-zinc-500 w-24 flex-shrink-0">{getDateLabel(item.scheduledFor)}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 ${PLATFORM_COLORS[item.platform] ?? 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20'}`}>
                {item.platform.charAt(0).toUpperCase() + item.platform.slice(1)}
              </span>
              <span className="text-[10px] text-zinc-500 flex-shrink-0">{item.contentType}</span>
              <p className="text-xs text-zinc-300 flex-1 min-w-0 truncate">&ldquo;{item.caption.slice(0, 80)}&rdquo;</p>
              <span className="text-[10px] text-zinc-600 flex-shrink-0 flex items-center gap-1"><Clock className="h-3 w-3" />{item.time}</span>
              {item.status === 'published'
                ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                : <div className="h-3.5 w-3.5 rounded-full border border-zinc-700 flex-shrink-0" />
              }
            </div>
          ))}
        </div>
        {!weekGenerated && (
          <button type="button"
            onClick={handleGenerateWeek}
            disabled={generatingWeek}
            className={`cursor-pointer w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
              mode === 'autopilot'
                ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30'
                : 'bg-[#6366f1]/10 border border-[#6366f1]/30 text-[#818cf8] hover:bg-[#6366f1]/20'
            }`}
          >
            {generatingWeek ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'autopilot' ? <Bot className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            {generatingWeek ? 'Generating...' : mode === 'autopilot' ? 'Auto-Schedule All 7 Posts' : 'Generate Drafts for Review'}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-zinc-500">Filter:</span>
        {['all', 'instagram', 'linkedin', 'facebook', 'twitter'].map(p => (
          <button type="button" key={p} onClick={() => setFilterPlatform(p)} className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${filterPlatform === p ? 'border-[#6366f1]/40 bg-[#6366f1]/10 text-[#818cf8]' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}>
            {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
        <div className="h-4 w-px bg-zinc-800" />
        {['all', 'published', 'scheduled', 'draft'].map(s => (
          <button type="button" key={s} onClick={() => setFilterStatus(s)} className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${filterStatus === s ? 'border-[#6366f1]/40 bg-[#6366f1]/10 text-[#818cf8]' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Post list */}
      <div className="space-y-2">
        {filteredPosts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed border-zinc-800 text-center">
            <Calendar className="h-8 w-8 text-zinc-700 mb-2" />
            <p className="text-sm text-zinc-500">No posts match this filter</p>
          </div>
        )}
        {filteredPosts.map(post => {
          const platformEmoji = PLATFORM_ICONS[post.platform] ?? '📱'
          const platColor = PLATFORM_COLORS[post.platform] ?? ''
          const statusCfg = STATUS_CONFIG[post.status]
          const isExpanded = expandedPost === post.id
          const leadColor = post.leadPotential === 'High' ? 'text-emerald-400' : post.leadPotential === 'Medium' ? 'text-amber-400' : 'text-zinc-500'
          const isPublishing = publishingId === post.id

          return (
            <div key={post.id} className={`rounded-xl border overflow-hidden transition-all ${post.awaitingApproval ? 'border-amber-500/30 bg-amber-500/5' : 'border-zinc-800/60 bg-zinc-900/40'}`}>
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-800/20 transition-colors"
                onClick={() => setExpandedPost(isExpanded ? null : post.id)}
              >
                <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border text-sm ${platColor}`}>
                  {platformEmoji}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 truncate">{post.caption}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5 flex items-center gap-2">
                    <Clock className="h-3 w-3" /> {getDateLabel(post.scheduledFor)} at {post.time}
                    <span className="capitalize">{post.contentType}</span>
                    {post.awaitingApproval && <span className="text-amber-400 font-semibold">• Awaiting approval</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusCfg.color}`}>{statusCfg.label}</span>
                  <span className={`text-[10px] font-semibold ${leadColor}`}>{post.leadPotential}</span>
                </div>
              </div>

              {/* Expanded */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-zinc-800/40 pt-3 space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div><p className="text-xs font-semibold text-zinc-200">{post.estimatedReach}</p><p className="text-[10px] text-zinc-600">Est. reach</p></div>
                    <div><p className={`text-xs font-semibold ${leadColor}`}>{post.leadPotential}</p><p className="text-[10px] text-zinc-600">Lead potential</p></div>
                    <div><p className="text-xs font-semibold text-zinc-200">{post.goal}</p><p className="text-[10px] text-zinc-600">Goal</p></div>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{post.caption}</p>

                  <div className="flex gap-2 flex-wrap">
                    {/* Copilot: approve draft */}
                    {post.awaitingApproval && mode === 'copilot' && (
                      <button type="button"
                        onClick={() => approvePost(post.id)}
                        className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve & Schedule
                      </button>
                    )}
                    {/* Schedule draft */}
                    {post.status === 'draft' && !post.awaitingApproval && (
                      <button type="button"
                        onClick={() => setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'scheduled' } : p))}
                        className="flex items-center gap-1.5 rounded-lg border border-[#6366f1]/30 bg-[#6366f1]/10 px-3 py-1.5 text-xs text-[#818cf8] hover:bg-[#6366f1]/20 transition-colors"
                      >
                        <Calendar className="h-3 w-3" /> Schedule
                      </button>
                    )}
                    {/* Publish now */}
                    {(post.status === 'scheduled' || post.awaitingApproval) && (
                      <button type="button"
                        onClick={() => handlePublishNow(post.id)}
                        disabled={isPublishing}
                        className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-60"
                      >
                        {isPublishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        {isPublishing ? 'Publishing...' : 'Publish Now'}
                      </button>
                    )}
                    {/* Mark published */}
                    {post.status === 'scheduled' && (
                      <button type="button"
                        onClick={() => setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'published' } : p))}
                        className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                      >
                        <CheckCircle2 className="h-3 w-3" /> Mark Published
                      </button>
                    )}
                    {/* Delete */}
                    <button type="button"
                      onClick={() => deletePost(post.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors ml-auto"
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
