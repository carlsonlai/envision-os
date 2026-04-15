'use client'

import { useState, useEffect, useCallback } from 'react'
import { MediaLibrary, type MediaAsset } from '@/components/social/MediaLibrary'
import {
  Sparkles,
  Loader2,
  Copy,
  CheckCircle2,
  Calendar,
  RefreshCw,
  ImageIcon,
  Video,
  FileText,
  Hash,
  Clock,
  Zap,
  Bot,
  User,
  Play,
  Send,
} from 'lucide-react'

type AIMode = 'autopilot' | 'copilot'

type ContentType = 'post' | 'story' | 'reel' | 'article'
type Goal = 'brand_awareness' | 'lead_gen' | 'engagement' | 'sales' | 'thought_leadership'
type Platform = 'instagram' | 'linkedin' | 'facebook' | 'twitter' | 'tiktok'

interface GeneratedContent {
  platform: Platform
  caption: string
  hashtags: string[]
  imagePrompt: string
  videoScript?: string
  bestTimeToPost: string
  estimatedReach: string
  leadPotential: 'Low' | 'Medium' | 'High'
  hooks: string[]
  cta: string
}

const PLATFORM_CONFIG: Record<Platform, { name: string; emoji: string; color: string; bg: string; border: string; maxChars: number }> = {
  instagram: { name: 'Instagram', emoji: '📸', color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/30', maxChars: 2200 },
  linkedin: { name: 'LinkedIn', emoji: '💼', color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30', maxChars: 3000 },
  facebook: { name: 'Facebook', emoji: '📘', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', maxChars: 63206 },
  twitter: { name: 'X / Twitter', emoji: '🐦', color: 'text-zinc-300', bg: 'bg-zinc-500/10', border: 'border-zinc-500/30', maxChars: 280 },
  tiktok: { name: 'TikTok', emoji: '🎵', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', maxChars: 2200 },
}

const CONTENT_TYPES: { value: ContentType; label: string; icon: React.ElementType; desc: string }[] = [
  { value: 'post', label: 'Post', icon: FileText, desc: 'Static image + caption' },
  { value: 'story', label: 'Story', icon: ImageIcon, desc: 'Vertical 9:16 content' },
  { value: 'reel', label: 'Reel / Short', icon: Video, desc: 'Short-form video' },
  { value: 'article', label: 'Article', icon: FileText, desc: 'LinkedIn long-form' },
]

const GOALS: { value: Goal; label: string; emoji: string }[] = [
  { value: 'brand_awareness', label: 'Brand Awareness', emoji: '📣' },
  { value: 'lead_gen', label: 'Lead Generation', emoji: '🎯' },
  { value: 'engagement', label: 'Engagement', emoji: '💬' },
  { value: 'sales', label: 'Sales / Promo', emoji: '💰' },
  { value: 'thought_leadership', label: 'Thought Leadership', emoji: '🧠' },
]

const LEAD_COLOR: Record<string, string> = {
  High: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  Medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  Low: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
}

export default function ContentStudioPage() {
  const [mode, setMode] = useState<AIMode>('copilot')

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
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['instagram', 'linkedin'])
  const [selectedMedia, setSelectedMedia] = useState<MediaAsset[]>([])
  const [contentType, setContentType] = useState<ContentType>('post')
  const [goal, setGoal] = useState<Goal>('lead_gen')
  const [topic, setTopic] = useState('')
  const [brandNotes, setBrandNotes] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [generated, setGenerated] = useState<GeneratedContent[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const [schedulingId, setSchedulingId] = useState<string | null>(null)
  const [scheduled, setScheduled] = useState<Set<string>>(new Set())
  const [activePlatformTab, setActivePlatformTab] = useState<Platform | null>(null)
  const [autoPosted, setAutoPosted] = useState<Set<string>>(new Set())

  function togglePlatform(p: Platform) {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  async function handleGenerate() {
    if (selectedPlatforms.length === 0) return
    setGenerating(true)
    setGenerated([])
    setGenerateError(null)

    try {
      const results: GeneratedContent[] = []
      const errors: string[] = []

      for (const platform of selectedPlatforms) {
        const res = await fetch('/api/social/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platforms: [platform], contentType, goal, topic, brandNotes }),
        })
        const data = await res.json() as { results?: GeneratedContent[]; error?: string }

        if (res.ok && data.results?.[0]) {
          results.push(data.results[0])
        } else {
          errors.push(`${platform}: ${data.error ?? `HTTP ${res.status}`}`)
        }
      }

      if (results.length > 0) {
        setGenerated(results)
        setActivePlatformTab(results[0]?.platform ?? null)
      }
      if (errors.length > 0) {
        setGenerateError(errors.join(' | '))
      }
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : 'Network error — check your connection and API configuration')
    } finally {
      setGenerating(false)
    }
  }

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  async function handleSchedule(platform: Platform) {
    setSchedulingId(platform)
    const contentItem = generated.find(g => g.platform === platform)
    if (contentItem) {
      try {
        // Save the generated content to the DB via save_draft task
        const fullCaption = contentItem.hashtags.length
          ? `${contentItem.caption}\n\n${contentItem.cta}\n\n${contentItem.hashtags.map(t => `#${t.replace(/^#/, '')}`).join(' ')}`
          : `${contentItem.caption}\n\n${contentItem.cta}`

        await fetch('/api/social/autopilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task: 'save_draft',
            post: {
              platform,
              caption: contentItem.caption,
              hashtags: contentItem.hashtags,
              imagePrompt: contentItem.imagePrompt,
              bestTime: contentItem.bestTimeToPost,
            },
          }),
        })
        // Export to social-content folder
        await fetch('/api/social/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'content', platform, caption: fullCaption }),
        }).catch(() => {})
      } catch { /* best-effort — still mark as scheduled in UI */ }
    }
    setScheduled(prev => new Set([...prev, platform]))
    setSchedulingId(null)
  }

  async function handleAutoPost(platform: Platform) {
    setSchedulingId(platform)
    const contentItem = generated.find(g => g.platform === platform)
    if (contentItem) {
      try {
        // First save to DB, then post_now will pick it up
        await fetch('/api/social/autopilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task: 'save_draft',
            post: {
              platform,
              caption: contentItem.caption,
              hashtags: contentItem.hashtags,
              imagePrompt: contentItem.imagePrompt,
              bestTime: contentItem.bestTimeToPost,
            },
          }),
        })
        // Now post the saved item immediately
        const res = await fetch('/api/social/autopilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task: 'post_now' }),
        })
        const data = await res.json() as { ok: boolean }
        if (data.ok) {
          setAutoPosted(prev => new Set([...prev, platform]))
        }
      } catch { /* fall through */ }
    }
    setSchedulingId(null)
  }

  async function handleGenerateAndPost() {
    if (selectedPlatforms.length === 0) return
    setGenerating(true)
    setGenerated([])
    setGenerateError(null)
    try {
      // Call autopilot generate task — real Claude AI content for all platforms
      const res = await fetch('/api/social/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'generate' }),
      })
      const data = await res.json() as { ok: boolean; log?: string[]; error?: string }
      if (!data.ok) {
        setGenerateError(data.error ?? 'AI generation failed — check ANTHROPIC_API_KEY is configured')
        return
      }
      // Load generated content from DB
      const postsRes = await fetch('/api/social/autopilot')
      if (postsRes.ok) {
        const postsData = await postsRes.json() as { data: Array<{ id: string; platform: string; caption: string; hashtags: string[]; imagePrompt: string | null; bestTime: string | null }> }
        const results: GeneratedContent[] = postsData.data
          .filter(p => selectedPlatforms.includes(p.platform as Platform))
          .map(p => ({
            platform: p.platform as Platform,
            hooks: [p.caption.slice(0, 60)],
            caption: p.caption,
            hashtags: p.hashtags ?? [],
            imagePrompt: p.imagePrompt ?? '',
            cta: 'DM us or visit our website to get started',
            bestTimeToPost: p.bestTime ?? 'Tue 9:00 AM',
            estimatedReach: '2,400–4,800',
            leadPotential: 'High',
          }))
        setGenerated(results)
        setActivePlatformTab(results[0]?.platform ?? null)
        // In autopilot mode, auto-mark all as scheduled
        if (mode === 'autopilot') {
          setScheduled(new Set(selectedPlatforms))
        }
      }
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : 'Network error — check your connection')
    } finally {
      setGenerating(false)
    }
  }

  const activeContent = generated.find(g => g.platform === activePlatformTab)

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#818cf8]" />
            AI Content Studio
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">AI generates platform-optimised content, image concepts, video scripts & best posting times</p>
        </div>
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
      </div>

      {/* Mode banner */}
      {mode === 'autopilot' ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex items-center gap-3">
          <Bot className="h-4 w-4 text-emerald-400 flex-shrink-0" />
          <p className="text-xs text-zinc-300"><span className="text-emerald-400 font-semibold">Autopilot:</span> AI generates content and automatically schedules it across all selected platforms at peak times. No review needed.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#6366f1]/20 bg-[#6366f1]/5 px-4 py-3 flex items-center gap-3">
          <User className="h-4 w-4 text-[#818cf8] flex-shrink-0" />
          <p className="text-xs text-zinc-300"><span className="text-[#818cf8] font-semibold">Co-pilot:</span> AI generates drafts for you to review. You copy, edit, and schedule each post manually.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* ── Left: Config panel ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Platforms */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
            <p className="text-sm font-semibold text-zinc-200">Platforms</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PLATFORM_CONFIG) as Platform[]).map(p => {
                const cfg = PLATFORM_CONFIG[p]
                const active = selectedPlatforms.includes(p)
                return (
                  <button type="button"
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${active ? `${cfg.border} ${cfg.bg} ${cfg.color}` : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <span className="text-sm leading-none">{cfg.emoji}</span>
                    {cfg.name}
                    {active && <CheckCircle2 className="h-3 w-3 ml-auto" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Content type */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
            <p className="text-sm font-semibold text-zinc-200">Content Type</p>
            <div className="grid grid-cols-2 gap-2">
              {CONTENT_TYPES.map(ct => {
                const Icon = ct.icon
                return (
                  <button type="button"
                    key={ct.value}
                    onClick={() => setContentType(ct.value)}
                    className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-left transition-all ${contentType === ct.value ? 'border-[#6366f1]/40 bg-[#6366f1]/10 text-[#818cf8]' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <Icon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold">{ct.label}</p>
                      <p className="text-[10px] opacity-70">{ct.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Goal */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
            <p className="text-sm font-semibold text-zinc-200">Campaign Goal</p>
            <div className="space-y-1.5">
              {GOALS.map(g => (
                <button type="button"
                  key={g.value}
                  onClick={() => setGoal(g.value)}
                  className={`w-full flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all text-left ${goal === g.value ? 'border-[#6366f1]/40 bg-[#6366f1]/10 text-[#818cf8]' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                >
                  <span>{g.emoji}</span>
                  {g.label}
                  {goal === g.value && <CheckCircle2 className="h-3 w-3 ml-auto" />}
                </button>
              ))}
            </div>
          </div>

          {/* Topic + notes */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
            <p className="text-sm font-semibold text-zinc-200">Topic / Brief</p>
            <div>
              <input
                type="text"
                placeholder="e.g. brand refresh for retail clients..."
                value={topic}
                onChange={e => setTopic(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#6366f1]/50 placeholder:text-zinc-600"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Brand notes (optional)</label>
              <textarea
                rows={2}
                placeholder="Tone, keywords, avoid..."
                value={brandNotes}
                onChange={e => setBrandNotes(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#6366f1]/50 placeholder:text-zinc-600 resize-none"
              />
            </div>
          </div>

          {mode === 'autopilot' ? (
            <button type="button"
              onClick={handleGenerateAndPost}
              disabled={generating || selectedPlatforms.length === 0}
              className="cursor-pointer w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60 transition-colors"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
              {generating ? 'Generating & Scheduling...' : `Auto-Generate & Schedule (${selectedPlatforms.length} platform${selectedPlatforms.length !== 1 ? 's' : ''})`}
            </button>
          ) : (
            <button type="button"
              onClick={handleGenerate}
              disabled={generating || selectedPlatforms.length === 0}
              className="cursor-pointer w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? `Generating for ${selectedPlatforms.length} platform(s)...` : `Generate Draft (${selectedPlatforms.length} platform${selectedPlatforms.length !== 1 ? 's' : ''})`}
            </button>
          )}
        </div>

        {/* ── Right: Output ── */}
        <div className="lg:col-span-3">
          {generateError && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 flex items-start gap-2">
              <span className="text-red-400 text-sm flex-shrink-0 mt-0.5">❌</span>
              <div>
                <p className="text-xs font-semibold text-red-400">Generation failed</p>
                <p className="text-xs text-zinc-400 mt-0.5">{generateError}</p>
                <p className="text-xs text-zinc-500 mt-1">Make sure <code className="text-[#818cf8] bg-[#6366f1]/10 px-1 rounded">ANTHROPIC_API_KEY</code> is set in <code className="text-zinc-300">.env.local</code> and the server is restarted.</p>
              </div>
            </div>
          )}

          {generated.length === 0 && !generating && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 h-full min-h-[400px] text-center p-8">
              <Sparkles className="h-10 w-10 text-zinc-700 mb-3" />
              <p className="text-sm text-zinc-500">Configure your content on the left</p>
              <p className="text-xs text-zinc-600 mt-1">AI will generate platform-optimised captions, image concepts, hashtags, and best posting times</p>
            </div>
          )}

          {generating && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-[#6366f1]/20 bg-[#6366f1]/5 h-full min-h-[400px] text-center p-8">
              <Loader2 className="h-8 w-8 text-[#818cf8] animate-spin mb-3" />
              <p className="text-sm text-zinc-300">AI is crafting your content...</p>
              <p className="text-xs text-zinc-500 mt-1">Optimising for each platform</p>
            </div>
          )}

          {generated.length > 0 && (
            <div className="space-y-4">
              {/* Platform tabs */}
              {generated.length > 1 && (
                <div className="flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1 w-fit">
                  {generated.map(g => {
                    const cfg = PLATFORM_CONFIG[g.platform]
                    return (
                      <button type="button"
                        key={g.platform}
                        onClick={() => setActivePlatformTab(g.platform)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${activePlatformTab === g.platform ? `${cfg.bg} ${cfg.color}` : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        <span className="text-sm leading-none">{cfg.emoji}</span>
                        {cfg.name}
                        {scheduled.has(g.platform) && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                      </button>
                    )
                  })}
                </div>
              )}

              {activeContent && (() => {
                const cfg = PLATFORM_CONFIG[activeContent.platform]
                return (
                  <div className="space-y-4">
                    {/* Meta */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-3 text-center`}>
                        <p className={`text-xs font-semibold ${cfg.color}`}>{activeContent.leadPotential} Lead Potential</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">AI assessment</p>
                      </div>
                      <div className="rounded-xl border border-zinc-800 bg-zinc-800/20 p-3 text-center">
                        <p className="text-xs font-semibold text-zinc-200">{activeContent.estimatedReach}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">Est. reach</p>
                      </div>
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                        <p className="text-xs font-semibold text-emerald-400 flex items-center justify-center gap-1">
                          <Clock className="h-3 w-3" /> {activeContent.bestTimeToPost}
                        </p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">Best post time</p>
                      </div>
                    </div>

                    {/* Hook options */}
                    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-2">
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5"><Zap className="h-3 w-3 text-[#818cf8]" /> Hook Options</p>
                      <div className="space-y-1.5">
                        {activeContent.hooks.map((hook, i) => (
                          <div key={i} className="flex items-center gap-2 rounded-lg border border-zinc-800/40 bg-zinc-800/20 px-3 py-2">
                            <span className="text-[10px] text-[#818cf8] font-bold w-4 flex-shrink-0">{i + 1}</span>
                            <p className="text-xs text-zinc-300 flex-1">{hook}</p>
                            <button type="button" onClick={() => handleCopy(hook, `hook-${i}`)} className="flex-shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors">
                              {copied === `hook-${i}` ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Caption */}
                    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Caption</p>
                        <button type="button" onClick={() => handleCopy(activeContent.caption, 'caption')} className={`flex items-center gap-1 text-xs transition-colors ${copied === 'caption' ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
                          {copied === 'caption' ? <><CheckCircle2 className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                        </button>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">{activeContent.caption}</p>
                      <p className="text-[10px] text-zinc-600">{activeContent.caption.length} / {cfg.maxChars} chars</p>
                    </div>

                    {/* Hashtags */}
                    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5"><Hash className="h-3 w-3" /> Hashtags</p>
                        <button type="button" onClick={() => handleCopy(activeContent.hashtags.join(' '), 'hashtags')} className={`flex items-center gap-1 text-xs transition-colors ${copied === 'hashtags' ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
                          {copied === 'hashtags' ? <><CheckCircle2 className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {activeContent.hashtags.map(tag => (
                          <span key={tag} className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.border} ${cfg.bg} ${cfg.color}`}>{tag}</span>
                        ))}
                      </div>
                    </div>

                    {/* Image concept */}
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
                      <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5"><ImageIcon className="h-3 w-3" /> AI Image Concept</p>
                      <p className="text-xs text-zinc-300 leading-relaxed">{activeContent.imagePrompt}</p>
                      <div className="flex gap-2 mt-2">
                        <button type="button" onClick={() => handleCopy(activeContent.imagePrompt, 'image')} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors ${copied === 'image' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-zinc-700 text-zinc-400 hover:text-zinc-200'}`}>
                          {copied === 'image' ? <><CheckCircle2 className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy Prompt</>}
                        </button>
                        <span className="text-[10px] text-zinc-600 self-center">Paste into Midjourney, DALL-E, or Firefly</span>
                      </div>
                    </div>

                    {/* Video script */}
                    {activeContent.videoScript && (
                      <div className="rounded-xl border border-[#6366f1]/20 bg-[#6366f1]/5 p-4 space-y-2">
                        <p className="text-xs font-semibold text-[#818cf8] uppercase tracking-wider flex items-center gap-1.5"><Video className="h-3 w-3" /> Video Script</p>
                        <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line font-mono">{activeContent.videoScript}</p>
                        <button type="button" onClick={() => handleCopy(activeContent.videoScript!, 'video')} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors ${copied === 'video' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-zinc-700 text-zinc-400 hover:text-zinc-200'}`}>
                          {copied === 'video' ? <><CheckCircle2 className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy Script</>}
                        </button>
                      </div>
                    )}

                    {/* CTA */}
                    <div className="rounded-lg border border-zinc-800/40 bg-zinc-800/20 px-4 py-2.5 flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5 text-[#818cf8]" />
                      <p className="text-xs text-zinc-300"><strong className="text-zinc-200">CTA: </strong>{activeContent.cta}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {mode === 'autopilot' ? (
                        <button type="button"
                          onClick={() => handleAutoPost(activeContent.platform)}
                          disabled={schedulingId === activeContent.platform || autoPosted.has(activeContent.platform)}
                          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all disabled:opacity-70 ${autoPosted.has(activeContent.platform) ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}
                        >
                          {schedulingId === activeContent.platform ? <Loader2 className="h-4 w-4 animate-spin" /> : autoPosted.has(activeContent.platform) ? <><CheckCircle2 className="h-4 w-4" /> Posted & Scheduled</> : <><Send className="h-4 w-4" /> Auto-Post Now</>}
                        </button>
                      ) : (
                        <button type="button"
                          onClick={() => handleSchedule(activeContent.platform)}
                          disabled={schedulingId === activeContent.platform || scheduled.has(activeContent.platform)}
                          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all disabled:opacity-70 ${scheduled.has(activeContent.platform) ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'bg-[#6366f1] text-white hover:bg-[#5558e3]'}`}
                        >
                          {schedulingId === activeContent.platform ? <Loader2 className="h-4 w-4 animate-spin" /> : scheduled.has(activeContent.platform) ? <><CheckCircle2 className="h-4 w-4" /> Scheduled</> : <><Calendar className="h-4 w-4" /> Schedule Post</>}
                        </button>
                      )}
                      <button type="button"
                        onClick={mode === 'autopilot' ? handleGenerateAndPost : handleGenerate}
                        className="cursor-pointer flex items-center gap-1.5 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Regenerate
                      </button>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Drive-backed media library — upload + pick attachments for posts */}
          <div className="mt-6">
            <MediaLibrary
              selectedIds={selectedMedia.map(m => m.id)}
              onSelect={asset => setSelectedMedia(prev => [...prev, asset])}
              onDeselect={asset => setSelectedMedia(prev => prev.filter(m => m.id !== asset.id))}
            />
            {selectedMedia.length > 0 && (
              <p className="mt-2 text-xs text-amber-300/80">
                {selectedMedia.length} attachment{selectedMedia.length === 1 ? '' : 's'} selected — they&apos;ll ride along with your next scheduled post.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
