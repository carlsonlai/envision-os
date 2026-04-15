'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Image as ImageIcon,
  Video,
  Download,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Film,
  Music2,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  ExternalLink,
  Search,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = 'kling' | 'envato'
type EnvatoSite = 'videohive.net' | 'audiojungle.net' | 'graphicriver.net' | 'photodune.net'

interface KlingTask {
  task_id: string
  task_status: 'submitted' | 'processing' | 'succeed' | 'failed'
  task_status_msg?: string
  task_result?: {
    videos?: { url: string; duration: string }[]
  }
}

interface EnvatoItem {
  id: number
  item: string
  description: string
  previews: {
    landscape_preview?: { landscape_url: string }
    icon_with_landscape_preview?: { landscape_url: string }
  }
  url: string
  rating: { rating: number; count: number }
  cost: number
  site: string
}

// ── Kling ─────────────────────────────────────────────────────────────────────

function KlingGenerator() {
  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [duration, setDuration] = useState('5')
  const [mode, setMode] = useState<'std' | 'pro'>('std')
  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [task, setTask] = useState<KlingTask | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    setPolling(false)
  }, [])

  const pollTask = useCallback(async (taskId: string) => {
    try {
      const res = await fetch(`/api/media/kling?task_id=${taskId}`)
      const json = (await res.json()) as { success: boolean; data?: { data: KlingTask }; error?: string }
      if (!json.success) { stopPolling(); return }
      const t = json.data?.data
      if (!t) return
      setTask(t)
      if (t.task_status === 'succeed' || t.task_status === 'failed') stopPolling()
    } catch {
      stopPolling()
    }
  }, [stopPolling])

  useEffect(() => () => stopPolling(), [stopPolling])

  async function generate() {
    if (!prompt.trim()) return
    stopPolling()
    setLoading(true)
    setError(null)
    setTask(null)
    try {
      const res = await fetch('/api/media/kling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, negative_prompt: negativePrompt, aspect_ratio: aspectRatio, duration, mode }),
      })
      const json = (await res.json()) as {
        success: boolean
        error?: string
        data?: { data: { task_id: string; task_status: string } }
      }
      if (!json.success) throw new Error(json.error ?? 'Failed to create task')
      const taskId = json.data?.data?.task_id
      if (!taskId) throw new Error('No task ID returned')
      setTask({ task_id: taskId, task_status: 'submitted' })
      setPolling(true)
      pollRef.current = setInterval(() => void pollTask(taskId), 5000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const statusColor: Record<string, string> = {
    submitted: 'text-zinc-400',
    processing: 'text-amber-400',
    succeed: 'text-emerald-400',
    failed: 'text-red-400',
  }
  const StatusIcon = task?.task_status === 'succeed' ? CheckCircle2
    : task?.task_status === 'failed' ? AlertCircle
    : task?.task_status === 'processing' ? Loader2
    : Clock

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
        <div className="flex items-center gap-2 text-emerald-400">
          <Film className="h-4 w-4" />
          <span className="text-sm font-semibold">Kling AI Video Generator</span>
          <span className="ml-auto text-[10px] text-emerald-500/70 bg-emerald-500/10 rounded-full px-2 py-0.5">Text → Video</span>
        </div>

        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Describe the video you want to generate…"
          rows={3}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-emerald-500/50 resize-none"
        />
        <input
          type="text"
          value={negativePrompt}
          onChange={e => setNegativePrompt(e.target.value)}
          placeholder="Negative prompt (optional) — what to avoid"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-400 placeholder-zinc-600 outline-none focus:border-emerald-500/50"
        />

        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Aspect ratio</label>
            <select
              value={aspectRatio}
              onChange={e => setAspectRatio(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300 outline-none"
            >
              <option value="16:9">16:9 Landscape</option>
              <option value="9:16">9:16 Portrait</option>
              <option value="1:1">1:1 Square</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Duration</label>
            <select
              value={duration}
              onChange={e => setDuration(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300 outline-none"
            >
              <option value="5">5 seconds</option>
              <option value="10">10 seconds</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Mode</label>
            <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
              {(['std', 'pro'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`px-3 py-1.5 text-xs font-medium uppercase transition-colors ${mode === m ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={loading || polling || !prompt.trim()}
            className="mt-4 rounded-lg bg-emerald-600 px-5 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : <><Video className="h-4 w-4" /> Generate</>}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      {task && (
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-4 w-4 ${statusColor[task.task_status]} ${task.task_status === 'processing' ? 'animate-spin' : ''}`} />
            <span className={`text-sm font-medium capitalize ${statusColor[task.task_status]}`}>
              {task.task_status === 'submitted' ? 'In queue…'
                : task.task_status === 'processing' ? 'Rendering video…'
                : task.task_status === 'succeed' ? 'Video ready!'
                : `Failed: ${task.task_status_msg ?? 'Unknown error'}`}
            </span>
            {polling && (
              <span className="ml-auto text-[10px] text-zinc-600 flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" /> Polling every 5s
              </span>
            )}
          </div>

          <p className="text-[10px] text-zinc-600 font-mono">Task ID: {task.task_id}</p>

          {task.task_status === 'succeed' && task.task_result?.videos?.map((v, i) => (
            <div key={i} className="rounded-lg overflow-hidden border border-zinc-800">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video controls className="w-full max-h-64 bg-black" src={v.url}>
                Your browser does not support video.
              </video>
              <div className="flex items-center justify-between px-3 py-2 border-t border-zinc-800">
                <span className="text-xs text-zinc-500">{v.duration}s</span>
                <a
                  href={v.url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600/20 border border-emerald-600/30 px-3 py-1.5 text-xs text-emerald-400 hover:bg-emerald-600/30 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {!task && !loading && (
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 py-16 text-center">
          <Video className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">Generate AI videos from text using Kling</p>
          <p className="text-xs text-zinc-600 mt-1">Generation typically takes 2–5 minutes</p>
        </div>
      )}
    </div>
  )
}

// ── Envato ────────────────────────────────────────────────────────────────────

function EnvatoSearch() {
  const [query, setQuery] = useState('')
  const [site, setSite] = useState<EnvatoSite>('videohive.net')
  const [page, setPage] = useState(1)
  const [results, setResults] = useState<EnvatoItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(async (p = 1) => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ q: query, site, page: String(p) })
      const res = await fetch(`/api/media/envato?${params.toString()}`)
      const json = (await res.json()) as {
        success: boolean
        error?: string
        data?: { matches: EnvatoItem[]; total_hits: number }
      }
      if (!json.success) throw new Error(json.error ?? 'Failed')
      setResults(json.data?.matches ?? [])
      setTotal(json.data?.total_hits ?? 0)
      setPage(p)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [query, site])

  const SITE_LABELS: Record<EnvatoSite, { label: string; icon: React.ElementType }> = {
    'videohive.net':   { label: 'VideoHive',    icon: Film },
    'audiojungle.net': { label: 'AudioJungle',  icon: Music2 },
    'graphicriver.net':{ label: 'GraphicRiver', icon: Layers },
    'photodune.net':   { label: 'PhotoDune',    icon: ImageIcon },
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <div className="flex-1 min-w-48 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && void search(1)}
            placeholder="Search Envato stock…"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-amber-500/50"
          />
        </div>
        <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
          {(Object.entries(SITE_LABELS) as [EnvatoSite, { label: string; icon: React.ElementType }][]).map(([s, { label }]) => (
            <button
              key={s}
              type="button"
              onClick={() => setSite(s)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${site === s ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void search(1)}
          disabled={loading || !query.trim()}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {results.map(item => {
              const thumb = item.previews?.landscape_preview?.landscape_url
                ?? item.previews?.icon_with_landscape_preview?.landscape_url
                ?? ''
              return (
                <div key={item.id} className="group relative rounded-xl overflow-hidden border border-zinc-800/60 bg-zinc-900/40">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt={item.item} className="w-full aspect-video object-cover" />
                  ) : (
                    <div className="w-full aspect-video bg-zinc-800 flex items-center justify-center">
                      <Film className="h-8 w-8 text-zinc-700" />
                    </div>
                  )}
                  {site === 'videohive.net' && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="rounded-full bg-white/20 backdrop-blur-sm p-3">
                        <Play className="h-5 w-5 text-white fill-white" />
                      </div>
                    </div>
                  )}
                  <div className="p-3 space-y-1.5">
                    <p className="text-xs font-medium text-zinc-200 truncate">{item.item}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-amber-400 font-semibold">${item.cost}</span>
                      <span className="text-[10px] text-zinc-500">★ {item.rating?.rating?.toFixed(1) ?? '—'}</span>
                    </div>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-amber-500/30 bg-amber-500/10 py-1.5 text-xs text-amber-400 hover:bg-amber-500/20 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> View on Envato
                    </a>
                  </div>
                </div>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => void search(page - 1)}
                disabled={page <= 1 || loading}
                className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-zinc-500">Page {page} of {totalPages}</span>
              <button
                type="button"
                onClick={() => void search(page + 1)}
                disabled={page >= totalPages || loading}
                className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {results.length === 0 && !loading && !error && (
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 py-16 text-center">
          <Film className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">Search VideoHive, AudioJungle, GraphicRiver & PhotoDune</p>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'kling',  label: 'Kling AI Video', icon: Film,   color: 'text-emerald-400' },
  { id: 'envato', label: 'Envato Stock',   icon: Layers, color: 'text-amber-400' },
]

export default function MediaLibraryPage() {
  const [tab, setTab] = useState<Tab>('kling')

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-[#818cf8]" />
          Media Library
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Generate AI videos with Kling and browse stock assets from Envato
        </p>
      </div>

      <div className="flex gap-1 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-1 w-fit">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                tab === t.id ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${tab === t.id ? t.color : ''}`} />
              {t.label}
            </button>
          )
        })}
      </div>

      <div>
        {tab === 'kling'  && <KlingGenerator />}
        {tab === 'envato' && <EnvatoSearch />}
      </div>
    </div>
  )
}
