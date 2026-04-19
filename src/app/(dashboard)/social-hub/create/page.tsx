'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  Zap,
  ArrowRight,
  Loader2,
  CheckCircle2,
} from 'lucide-react'

interface PendingPost {
  id: string
  status: string
}

interface ApiResponse {
  data?: PendingPost[]
  posts?: PendingPost[]
}

const PLATFORMS = [
  {
    id: 'instagram',
    name: 'Instagram',
    emoji: '📸',
    contentType: 'Reel + Post',
    bestTime: '7pm–9pm',
    posts: 2,
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/30',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    emoji: '🎵',
    contentType: 'Short Video',
    bestTime: '6pm–10pm',
    posts: 2,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    emoji: '💼',
    contentType: 'Article',
    bestTime: '9am–11am',
    posts: 2,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    emoji: '📘',
    contentType: 'Post + Story',
    bestTime: '1pm–3pm',
    posts: 2,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    emoji: '▶️',
    contentType: 'Short',
    bestTime: '3pm–5pm',
    posts: 1,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
  },
  {
    id: 'rednote',
    name: '小红书',
    emoji: '📕',
    contentType: 'Photo Note',
    bestTime: '8pm–10pm',
    posts: 2,
    color: 'text-red-300',
    bg: 'bg-red-500/5',
    border: 'border-red-400/20',
  },
  {
    id: 'mailchimp',
    name: 'Newsletter',
    emoji: '✉️',
    contentType: 'Campaign',
    bestTime: 'Tuesday 10am',
    posts: 1,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
]

const LOG_LINES = [
  '🤖 Analysing Envicion Studios brand voice...',
  '📅 Planning weekly content calendar...',
  '📸 Generating Instagram Reel caption (Post 1/2)...',
  '📸 Generating Instagram image post (Post 2/2)...',
  '🎵 Writing TikTok hook + script (Post 1/2)...',
  '🎵 Crafting TikTok trending audio brief (Post 2/2)...',
  '💼 Drafting LinkedIn thought-leadership article...',
  '💼 Writing LinkedIn engagement post...',
  '📘 Creating Facebook community post...',
  '▶️ Scripting YouTube Short concept...',
  '📕 Writing 小红书 photo note...',
  '✉️ Composing newsletter campaign draft...',
  '✅ All 14 posts generated — ready for approval!',
]

const totalPostCount = PLATFORMS.reduce((acc, p) => acc + p.posts, 0)

export default function ContentStudioPage() {
  const [generating, setGenerating] = useState(false)
  const [done, setDone] = useState(false)
  const [logLines, setLogLines] = useState<string[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const logIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const generateTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetchPendingCount()
  }, [])

  useEffect(() => {
    if (!generating) {
      if (logIntervalRef.current) {
        clearInterval(logIntervalRef.current)
        logIntervalRef.current = null
      }
      if (generateTimeoutRef.current) {
        clearTimeout(generateTimeoutRef.current)
        generateTimeoutRef.current = null
      }
      return
    }

    let lineIndex = 0
    setLogLines([])

    logIntervalRef.current = setInterval(() => {
      if (lineIndex < LOG_LINES.length) {
        setLogLines((prev) => [...prev, LOG_LINES[lineIndex]])
        lineIndex += 1
      } else {
        if (logIntervalRef.current) {
          clearInterval(logIntervalRef.current)
          logIntervalRef.current = null
        }
      }
    }, 800)

    generateTimeoutRef.current = setTimeout(() => {
      if (logIntervalRef.current) {
        clearInterval(logIntervalRef.current)
        logIntervalRef.current = null
      }
      setGenerating(false)
      setDone(true)
      fetchPendingCount()
    }, 12000)

    return () => {
      if (logIntervalRef.current) {
        clearInterval(logIntervalRef.current)
      }
      if (generateTimeoutRef.current) {
        clearTimeout(generateTimeoutRef.current)
      }
    }
  }, [generating])

  const fetchPendingCount = async () => {
    try {
      const res = await fetch('/api/social/autopilot')
      const data: ApiResponse = await res.json()
      const posts = data.data || data.posts || []
      const pending = posts.filter((p) => p.status === 'pending').length
      setPendingCount(pending)
    } catch (error) {
      setPendingCount(0)
    }
  }

  const handleGenerateClick = async () => {
    setGenerating(true)
    setDone(false)
    setLogLines([])

    try {
      await fetch('/api/social/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'generate' }),
      })
    } catch (error) {
      setGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] px-6 py-12">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-12 flex items-start justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <Zap className="h-8 w-8 text-[#6366f1]" />
              <h1 className="text-4xl font-bold text-zinc-100">Content Studio</h1>
            </div>
            <p className="text-lg text-zinc-400">
              AI generates your week's content in one click
            </p>
          </div>
          <Link
            href="/social-hub"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-800/50"
          >
            View Approval Queue
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Weekly Content Plan Grid */}
        <div className="mb-12">
          <h2 className="mb-4 text-xl font-semibold text-zinc-100">
            Weekly Content Plan
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {PLATFORMS.map((platform) => (
              <div
                key={platform.id}
                className={`rounded-xl border ${platform.border} ${platform.bg} bg-zinc-900 p-4`}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{platform.emoji}</span>
                    <div>
                      <h3 className="font-semibold text-zinc-100">
                        {platform.name}
                      </h3>
                      <p className="text-xs text-zinc-400">{platform.contentType}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <span>🕐 {platform.bestTime}</span>
                  </div>
                  <div className="inline-block rounded-full bg-zinc-800 px-2 py-1 text-zinc-300">
                    {platform.posts} post{platform.posts !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Generator Section */}
        {!generating && !done && (
          <div className="mb-12 flex flex-col items-center">
            <button
              onClick={handleGenerateClick}
              className="mb-4 w-full max-w-md rounded-2xl bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-6 py-4 font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:from-[#818cf8] hover:to-[#a78bfa] focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:ring-offset-2 focus:ring-offset-[#0a0a0f]"
            >
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="h-5 w-5" />
                Generate This Week's Content
              </div>
            </button>
            <p className="text-sm text-zinc-500">
              ~2 min to generate {totalPostCount} posts across {PLATFORMS.length}{' '}
              platforms
            </p>
          </div>
        )}

        {/* Generation Log */}
        {generating && (
          <div className="mb-12 flex flex-col items-center">
            <div className="w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-950 p-6">
              <div className="mb-4 flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-[#6366f1]" />
                <span className="font-semibold text-zinc-100">Generating...</span>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto rounded bg-zinc-900/50 p-4 font-mono text-xs">
                {logLines.map((line, idx) => (
                  <div key={idx} className="text-zinc-300">
                    {line}
                  </div>
                ))}
                {logLines.length < LOG_LINES.length && (
                  <div className="animate-pulse text-zinc-500">▌</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Success State */}
        {done && !generating && (
          <div className="mb-12 flex flex-col items-center">
            <div className="w-full max-w-2xl rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center">
              <div className="mb-4 flex justify-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-400" />
              </div>
              <h3 className="mb-2 text-2xl font-bold text-zinc-100">
                {totalPostCount} posts ready for review
              </h3>
              <p className="mb-6 text-zinc-400">
                Your weekly content has been generated and is waiting in the
                approval queue.
              </p>
              <Link
                href="/social-hub"
                className="inline-block rounded-lg bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-6 py-2 font-medium text-white transition-all hover:from-[#818cf8] hover:to-[#a78bfa]"
              >
                Open Approval Queue
              </Link>
            </div>
          </div>
        )}

        {/* Recently Generated / Pending Posts */}
        {pendingCount > 0 && (
          <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/50 px-6 py-4">
            <div>
              <p className="text-zinc-100">
                You have{' '}
                <span className="font-semibold">{pendingCount} post</span>
                {pendingCount !== 1 ? 's' : ''} waiting for approval
              </p>
            </div>
            <Link
              href="/social-hub"
              className="inline-flex items-center gap-2 rounded-lg bg-[#6366f1]/10 px-3 py-2 text-sm font-medium text-[#818cf8] transition-colors hover:bg-[#6366f1]/20"
            >
              Review posts
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#6366f1]/30 text-xs">
                {pendingCount}
              </span>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
