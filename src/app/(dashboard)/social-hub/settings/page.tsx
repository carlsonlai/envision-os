'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  Loader2,
  RefreshCw,
  AlertCircle,
  Info,
} from 'lucide-react'

interface PlatformRow {
  id: string
  name: string
  emoji: string
  color: string
  // editable fields
  followers: string
  followerGrowth: string
  reach: string
  engagement: string
  leads: string
  posts: string
  likes: string
  comments: string
  score: string
  bestTime: string
}

const PLATFORM_META: Record<string, { emoji: string; color: string; hint: string }> = {
  instagram: { emoji: '📸', color: 'text-pink-400',   hint: 'Check Instagram Insights → Overview → Accounts Reached' },
  tiktok:    { emoji: '🎵', color: 'text-rose-400',   hint: 'TikTok Studio → Analytics → Overview' },
  linkedin:  { emoji: '💼', color: 'text-sky-400',    hint: 'LinkedIn Company Page → Analytics → Followers' },
  facebook:  { emoji: '📘', color: 'text-blue-400',   hint: 'Meta Business Suite → Insights → Overview' },
  youtube:   { emoji: '▶️', color: 'text-red-400',    hint: 'YouTube Studio → Analytics → Overview' },
  rednote:   { emoji: '📕', color: 'text-red-300',    hint: '小红书 Creator Center → Data Center' },
  mailchimp: { emoji: '✉️', color: 'text-amber-400',  hint: 'Mailchimp → Audience → Overview (subscribers = followers)' },
}

const DEFAULT_PLATFORMS: PlatformRow[] = [
  { id: 'instagram', name: 'Instagram',       ...PLATFORM_META.instagram, followers: '', followerGrowth: '', reach: '', engagement: '', leads: '', posts: '', likes: '', comments: '', score: '', bestTime: 'Tue & Thu 8–9 AM' },
  { id: 'tiktok',    name: 'TikTok',           ...PLATFORM_META.tiktok,    followers: '', followerGrowth: '', reach: '', engagement: '', leads: '', posts: '', likes: '', comments: '', score: '', bestTime: 'Fri & Sat 7–9 PM' },
  { id: 'linkedin',  name: 'LinkedIn',         ...PLATFORM_META.linkedin,  followers: '', followerGrowth: '', reach: '', engagement: '', leads: '', posts: '', likes: '', comments: '', score: '', bestTime: 'Mon & Wed 9 AM' },
  { id: 'facebook',  name: 'Facebook',         ...PLATFORM_META.facebook,  followers: '', followerGrowth: '', reach: '', engagement: '', leads: '', posts: '', likes: '', comments: '', score: '', bestTime: 'Wed 12 PM' },
  { id: 'youtube',   name: 'YouTube',          ...PLATFORM_META.youtube,   followers: '', followerGrowth: '', reach: '', engagement: '', leads: '', posts: '', likes: '', comments: '', score: '', bestTime: 'Sat & Sun 10 AM' },
  { id: 'rednote',   name: '小红书 (RedNote)', ...PLATFORM_META.rednote,   followers: '', followerGrowth: '', reach: '', engagement: '', leads: '', posts: '', likes: '', comments: '', score: '', bestTime: 'Wed & Sun 8 PM' },
  { id: 'mailchimp', name: 'Mailchimp',        ...PLATFORM_META.mailchimp, followers: '', followerGrowth: '', reach: '', engagement: '', leads: '', posts: '', likes: '', comments: '', score: '', bestTime: 'Tue 10 AM' },
]

export default function SocialHubSettingsPage() {
  const [platforms, setPlatforms] = useState<PlatformRow[]>(DEFAULT_PLATFORMS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeHint, setActiveHint] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/social/platform-stats')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as {
        hasData: boolean
        platforms: Array<{
          id: string; name: string; followers: number; followerGrowth: number
          reach: number; engagement: number; leads: number; posts: number
          likes: number; comments: number; score: number; bestTime: string
        }>
      }
      if (data.hasData && data.platforms.length > 0) {
        setPlatforms(prev => prev.map(p => {
          const live = data.platforms.find(l => l.id === p.id)
          if (!live) return p
          return {
            ...p,
            followers:      live.followers      > 0 ? String(live.followers)      : '',
            followerGrowth: live.followerGrowth !== 0 ? String(live.followerGrowth) : '',
            reach:          live.reach          > 0 ? String(live.reach)          : '',
            engagement:     live.engagement     > 0 ? String(live.engagement)     : '',
            leads:          live.leads          > 0 ? String(live.leads)          : '',
            posts:          live.posts          > 0 ? String(live.posts)          : '',
            likes:          live.likes          > 0 ? String(live.likes)          : '',
            comments:       live.comments       > 0 ? String(live.comments)       : '',
            score:          live.score          > 0 ? String(live.score)          : '',
            bestTime:       live.bestTime || p.bestTime,
          }
        }))
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  function updateField(id: string, field: keyof PlatformRow, value: string) {
    setPlatforms(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
    setSaved(false)
  }

  async function handleSave() {
    try {
      setSaving(true)
      setError(null)
      const payload = platforms.map(p => ({
        id:             p.id,
        name:           p.name,
        followers:      Number(p.followers)      || 0,
        followerGrowth: Number(p.followerGrowth) || 0,
        reach:          Number(p.reach)          || 0,
        engagement:     Number(p.engagement)     || 0,
        leads:          Number(p.leads)          || 0,
        posts:          Number(p.posts)          || 0,
        likes:          Number(p.likes)          || 0,
        comments:       Number(p.comments)       || 0,
        score:          Number(p.score)          || 0,
        bestTime:       p.bestTime,
      }))
      const res = await fetch('/api/social/platform-stats', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platforms: payload }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#6366f1]/60 focus:ring-1 focus:ring-[#6366f1]/30 transition-colors"

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/social-hub/analytics"
            className="flex items-center justify-center h-7 w-7 rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Social Account Stats</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Enter your real numbers — they show instantly on the Analytics dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Reload
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-1.5 rounded-lg bg-[#6366f1] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#4f46e5] transition-colors disabled:opacity-60"
          >
            {saving ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
            ) : saved ? (
              <><CheckCircle2 className="h-3.5 w-3.5" /> Saved!</>
            ) : (
              <><Save className="h-3.5 w-3.5" /> Save All</>
            )}
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-[#6366f1]/20 bg-[#6366f1]/5 px-4 py-3 flex items-start gap-3">
        <Info className="h-4 w-4 text-[#818cf8] flex-shrink-0 mt-0.5" />
        <p className="text-xs text-zinc-400 leading-relaxed">
          Enter your <span className="text-zinc-200 font-medium">current real stats</span> from each platform. Numbers you save here will replace the demo data on the Analytics page immediately.
          Update these weekly — or connect the APIs in <code className="text-[#818cf8] text-[10px] bg-[#6366f1]/10 px-1 rounded">.env</code> for automatic daily sync.
          Hover the <span className="text-amber-400">ⓘ</span> icon next to each platform to see where to find the numbers.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Platform forms */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading saved stats…</span>
        </div>
      ) : (
        <div className="space-y-4">
          {platforms.map(p => (
            <div key={p.id} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5">
              {/* Platform header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{p.emoji}</span>
                  <span className={`text-sm font-semibold ${p.color}`}>{p.name}</span>
                  <button
                    type="button"
                    onClick={() => setActiveHint(activeHint === p.id ? null : p.id)}
                    className="text-amber-400/60 hover:text-amber-400 transition-colors text-xs"
                    title="Where to find these numbers"
                  >
                    ⓘ
                  </button>
                </div>
                {/* Filled indicator */}
                {p.followers && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                    <CheckCircle2 className="h-3 w-3" /> Has data
                  </span>
                )}
              </div>

              {/* Hint */}
              {activeHint === p.id && (
                <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                  <p className="text-[11px] text-amber-300">📍 {PLATFORM_META[p.id]?.hint ?? 'Check the platform analytics dashboard'}</p>
                </div>
              )}

              {/* Fields grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {[
                  { field: 'followers'      as const, label: 'Followers',       placeholder: 'e.g. 4820',   type: 'number' },
                  { field: 'followerGrowth' as const, label: '% Growth',        placeholder: 'e.g. 14.3',   type: 'number' },
                  { field: 'reach'          as const, label: 'Weekly Reach',    placeholder: 'e.g. 18400',  type: 'number' },
                  { field: 'engagement'     as const, label: 'Engagement %',    placeholder: 'e.g. 6.2',    type: 'number' },
                  { field: 'leads'          as const, label: 'Leads This Week', placeholder: 'e.g. 12',     type: 'number' },
                  { field: 'posts'          as const, label: 'Posts This Week', placeholder: 'e.g. 14',     type: 'number' },
                  { field: 'likes'          as const, label: 'Total Likes',     placeholder: 'e.g. 512',    type: 'number' },
                  { field: 'comments'       as const, label: 'Total Comments',  placeholder: 'e.g. 63',     type: 'number' },
                  { field: 'score'          as const, label: 'Health Score',    placeholder: '0–100',       type: 'number' },
                  { field: 'bestTime'       as const, label: 'Best Post Time',  placeholder: 'Tue 8–9 AM',  type: 'text'   },
                ].map(({ field, label, placeholder, type }) => (
                  <div key={field}>
                    <label className="block text-[10px] text-zinc-500 mb-1 font-medium uppercase tracking-wide">{label}</label>
                    <input
                      type={type}
                      min={type === 'number' ? '0' : undefined}
                      step={field === 'engagement' || field === 'followerGrowth' ? '0.1' : '1'}
                      value={p[field]}
                      onChange={e => updateField(p.id, field, e.target.value)}
                      placeholder={placeholder}
                      className={inputCls}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom save */}
      {!loading && (
        <div className="flex items-center justify-between rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-5 py-4">
          <p className="text-xs text-zinc-500">
            Changes save instantly to your database and update the Analytics dashboard in real time.
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-1.5 rounded-lg bg-[#6366f1] px-5 py-2 text-sm font-semibold text-white hover:bg-[#4f46e5] transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save All Stats'}
          </button>
        </div>
      )}
    </div>
  )
}
