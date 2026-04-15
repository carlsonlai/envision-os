'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Star,
  Shield,
  TrendingUp,
  Loader2,
  Copy,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Globe,
  Zap,
  RefreshCw,
  BarChart3,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Clock,
} from 'lucide-react'

type RepTab = 'score' | 'reviews' | 'mentions' | 'report'

interface ReviewItem {
  id: string
  platform: 'google' | 'facebook' | 'trustpilot'
  author: string
  rating: number
  text: string
  date: string
  replied: boolean
  aiDraft?: string
  showing?: boolean
}

interface MentionItem {
  id: string
  platform: 'instagram' | 'twitter' | 'linkedin' | 'news'
  author: string
  text: string
  sentiment: 'positive' | 'neutral' | 'negative'
  date: string
  url: string
  aiDraft?: string
  showing?: boolean
}

interface WeeklyReport {
  generatedAt: string
  overallScore: number
  trend: 'up' | 'down' | 'stable'
  googleRating: number
  totalReviews: number
  newReviews: number
  positiveCount: number
  negativeCount: number
  mentionVolume: number
  sentimentBreakdown: { positive: number; neutral: number; negative: number }
  topPlatform: string
  urgentAction: string
  keyStrengths: string[]
  areasToWatch: string[]
  recommendedActions: string[]
}

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'xs' }) {
  const h = size === 'sm' ? 'h-3.5 w-3.5' : 'h-3 w-3'
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} className={`${h} ${n <= rating ? 'text-amber-400 fill-amber-400' : 'text-zinc-700'}`} />
      ))}
    </div>
  )
}

const PLATFORM_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  google: { icon: '🔍', label: 'Google', color: 'text-blue-400' },
  facebook: { icon: '📘', label: 'Facebook', color: 'text-blue-500' },
  trustpilot: { icon: '⭐', label: 'Trustpilot', color: 'text-emerald-400' },
  instagram: { icon: '📸', label: 'Instagram', color: 'text-pink-400' },
  twitter: { icon: '🐦', label: 'X / Twitter', color: 'text-zinc-400' },
  linkedin: { icon: '💼', label: 'LinkedIn', color: 'text-blue-400' },
  news: { icon: '📰', label: 'Media', color: 'text-amber-400' },
}

const SENTIMENT_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  positive: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', icon: '↑' },
  neutral: { color: 'text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/30', icon: '→' },
  negative: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', icon: '↓' },
}

async function generateAIResponse(type: 'review' | 'mention', content: string, author: string, isNegative: boolean): Promise<string> {
  try {
    const prompt = type === 'review'
      ? `Draft a professional, warm reply to this ${isNegative ? 'negative' : 'positive'} Google review from "${author}": "${content}". Reply as Envicion Studios Malaysia. Keep it under 80 words, empathetic and on-brand.`
      : `Draft a social media response to this ${isNegative ? 'critical' : 'positive'} mention from "${author}": "${content}". Reply as Envicion Studios Malaysia. Keep it under 60 words, professional and genuine.`

    const res = await fetch('/api/ai/sales-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'DRAFT_PROSPECT_CONVERSATION', customPrompt: prompt, leadName: author }),
    })
    if (!res.ok) throw new Error('API error')
    const data = (await res.json()) as { data: { openingMessage?: string } }
    return data.data?.openingMessage ?? generateFallback(isNegative, author, type)
  } catch {
    return generateFallback(isNegative, author, type)
  }
}

function generateFallback(isNegative: boolean, author: string, type: 'review' | 'mention'): string {
  if (isNegative && type === 'review') {
    return `Dear ${author}, thank you for your honest feedback. We sincerely apologise for the experience and take this seriously. Our director would like to speak with you directly to understand what happened and make it right. Please reach out to us at hello@envicionstudio.com.my — we are committed to doing better.`
  }
  if (!isNegative && type === 'review') {
    return `Thank you so much, ${author}! 🙏 Your kind words truly mean the world to our team. It was a pleasure working with you and we look forward to creating more amazing work together in the future. Please don't hesitate to refer us to anyone who needs creative excellence!`
  }
  if (type === 'mention') {
    return isNegative
      ? `Thank you for sharing your experience. We'd love to chat directly and understand more — please DM us or email hello@envicionstudio.com.my. We're always looking to improve.`
      : `Thank you so much for the kind mention! 🔥 We loved working on this project. Excited to see the new brand in action! ✨`
  }
  return 'Thank you for your feedback! We appreciate you taking the time to share your thoughts.'
}

export default function ReputationPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<RepTab>('score')
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [mentions, setMentions] = useState<MentionItem[]>([])
  const [draftingId, setDraftingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState('2 min ago')
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') router.push('/command')
  }, [status, session, router])

  // Fetch real reviews and mentions; fall back to demo data if DB is empty
  useEffect(() => {
    if (status !== 'authenticated') return
    async function loadData() {
      setDataLoading(true)
      try {
        const [rvRes, mnRes] = await Promise.all([
          fetch('/api/reputation/reviews'),
          fetch('/api/reputation/mentions'),
        ])
        if (rvRes.ok) {
          const { data } = (await rvRes.json()) as { data: Array<{ id: string; platform: string; author: string; rating: number; text: string; replied: boolean; aiDraft: string | null; reviewedAt: string }> }
          setReviews(
            data.length > 0
              ? data.map(r => ({ ...r, date: r.reviewedAt.slice(0, 10), platform: r.platform as ReviewItem['platform'], aiDraft: r.aiDraft ?? undefined }))
              : []
          )
        } else {
          setReviews([])
        }
        if (mnRes.ok) {
          const { data } = (await mnRes.json()) as { data: Array<{ id: string; platform: string; author: string; text: string; sentiment: string; aiDraft: string | null; mentionedAt: string }> }
          setMentions(
            data.length > 0
              ? data.map(m => ({ ...m, date: m.mentionedAt.slice(0, 10), platform: m.platform as MentionItem['platform'], sentiment: m.sentiment as MentionItem['sentiment'], url: '#', aiDraft: m.aiDraft ?? undefined }))
              : []
          )
        } else {
          setMentions([])
        }
      } catch {
        setReviews([])
        setMentions([])
      } finally {
        setDataLoading(false)
        setLastRefreshed('just now')
      }
    }
    void loadData()
  }, [status])

  // Reputation score calculation
  const avgRating = reviews
    .filter(r => r.rating)
    .reduce((s, r) => s + r.rating, 0) / Math.max(reviews.filter(r => r.rating).length, 1)

  const positiveRatio = reviews.filter(r => r.rating >= 4).length / Math.max(reviews.length, 1)
  const repliedRatio = reviews.filter(r => r.replied).length / Math.max(reviews.length, 1)
  const mentionSentimentScore = mentions.filter(m => m.sentiment === 'positive').length / Math.max(mentions.length, 1)
  const unrepliedNegative = reviews.filter(r => r.rating <= 2 && !r.replied).length

  const reputationScore = Math.round(
    (avgRating / 5) * 40 +
    positiveRatio * 25 +
    repliedRatio * 20 +
    mentionSentimentScore * 15
  )

  const scoreColor =
    reputationScore >= 80 ? 'text-emerald-400' :
    reputationScore >= 60 ? 'text-amber-400' : 'text-red-400'

  const scoreBg =
    reputationScore >= 80 ? 'border-emerald-500/30 bg-emerald-500/5' :
    reputationScore >= 60 ? 'border-amber-500/30 bg-amber-500/5' : 'border-red-500/30 bg-red-500/5'

  async function handleDraftReply(id: string, type: 'review' | 'mention') {
    setDraftingId(id)
    if (type === 'review') {
      const rev = reviews.find(r => r.id === id)
      if (!rev) return
      const draft = await generateAIResponse('review', rev.text, rev.author, rev.rating <= 2)
      setReviews(prev => prev.map(r => r.id === id ? { ...r, aiDraft: draft, showing: true } : r))
      fetch(`/api/reputation/reviews?id=${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aiDraft: draft }) }).catch(() => {})
    } else {
      const men = mentions.find(m => m.id === id)
      if (!men) return
      const draft = await generateAIResponse('mention', men.text, men.author, men.sentiment === 'negative')
      setMentions(prev => prev.map(m => m.id === id ? { ...m, aiDraft: draft, showing: true } : m))
      fetch(`/api/reputation/mentions?id=${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aiDraft: draft }) }).catch(() => {})
    }
    setDraftingId(null)
  }

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function handleMarkReplied(id: string) {
    setReviews(prev => prev.map(r => r.id === id ? { ...r, replied: true, showing: false } : r))
    fetch(`/api/reputation/reviews?id=${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ replied: true }) }).catch(() => {})
  }

  function handleGenerateReport() {
    setGeneratingReport(true)
    setReport({
      generatedAt: new Date().toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' }),
      overallScore: reputationScore,
      trend: 'up',
      googleRating: parseFloat(avgRating.toFixed(1)),
      totalReviews: reviews.length,
      newReviews: 3,
      positiveCount: reviews.filter(r => r.rating >= 4).length,
      negativeCount: reviews.filter(r => r.rating <= 2).length,
      mentionVolume: mentions.length,
      sentimentBreakdown: {
        positive: mentions.filter(m => m.sentiment === 'positive').length,
        neutral: mentions.filter(m => m.sentiment === 'neutral').length,
        negative: mentions.filter(m => m.sentiment === 'negative').length,
      },
      topPlatform: 'Google',
      urgentAction: unrepliedNegative > 0
        ? `${unrepliedNegative} negative review(s) need an urgent AI-drafted reply to protect your rating.`
        : 'All critical reviews addressed. Continue monitoring weekly.',
      keyStrengths: [
        'Consistently high ratings from enterprise clients',
        'Award-winning recognition boosting media mentions',
        'Strong LinkedIn presence among B2B decision makers',
      ],
      areasToWatch: [
        'Response time to negative reviews (target: < 24h)',
        'Neutral social mentions that could shift negative',
        'Pricing perception among SME segment',
      ],
      recommendedActions: [
        `Reply to ${unrepliedNegative} pending negative reviews today using AI drafts`,
        'Request reviews from 3 recently delivered projects (Sunway, TM, Eco Brand)',
        'Post award win on all social channels for reputation amplification',
        'Set up Google Alerts for "Envicion Studios" to catch new mentions faster',
      ],
    })
    setGeneratingReport(false)
  }

  if (status === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#818cf8]" />
            AI Reputation Manager
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">AI monitors and manages your entire online reputation — Google, social, media</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-600 flex items-center gap-1">
            <Clock className="h-3 w-3" /> Updated {lastRefreshed}
          </span>
          <button type="button"
            onClick={() => setLastRefreshed('Just now')}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>
      </div>

      {/* Urgent alert */}
      {unrepliedNegative > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">
            <strong>{unrepliedNegative} negative review(s)</strong> need a reply — AI can draft a professional response immediately.
          </p>
          <button type="button"
            onClick={() => setActiveTab('reviews')}
            className="ml-auto flex-shrink-0 text-xs text-red-400 hover:text-red-300 underline transition-colors"
          >
            Address now
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex rounded-xl border border-zinc-800 bg-zinc-900 p-1 gap-1 flex-wrap">
        {(
          [
            { key: 'score' as RepTab, label: 'Reputation Score', icon: BarChart3 },
            { key: 'reviews' as RepTab, label: 'Reviews', icon: Star },
            { key: 'mentions' as RepTab, label: 'Social Mentions', icon: Globe },
            { key: 'report' as RepTab, label: 'MD Report', icon: Eye },
          ] as const
        ).map(tab => {
          const Icon = tab.icon
          return (
            <button type="button"
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                activeTab === tab.key ? 'bg-[#6366f1] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ─── REPUTATION SCORE TAB ──────────────────────────────────────────── */}
      {activeTab === 'score' && (
        <div className="space-y-5">
          {/* Main score */}
          <div className={`rounded-xl border ${scoreBg} p-6 flex items-center gap-8`}>
            <div className="text-center flex-shrink-0">
              <p className={`text-6xl font-black ${scoreColor}`}>{reputationScore}</p>
              <p className="text-xs text-zinc-500 mt-1">/ 100</p>
              <p className={`text-sm font-semibold mt-1 ${scoreColor}`}>
                {reputationScore >= 80 ? 'Excellent' : reputationScore >= 60 ? 'Good' : 'Needs Attention'}
              </p>
            </div>
            <div className="flex-1 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Google Rating', value: `${avgRating.toFixed(1)} ★`, weight: '40%' },
                  { label: 'Positive Reviews', value: `${Math.round(positiveRatio * 100)}%`, weight: '25%' },
                  { label: 'Reply Rate', value: `${Math.round(repliedRatio * 100)}%`, weight: '20%' },
                  { label: 'Mention Sentiment', value: `${Math.round(mentionSentimentScore * 100)}%`, weight: '15%' },
                ].map(metric => (
                  <div key={metric.label} className="rounded-lg border border-zinc-800/40 bg-zinc-800/20 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-zinc-500">{metric.label}</p>
                      <span className="text-[10px] text-zinc-600">weight {metric.weight}</span>
                    </div>
                    <p className="text-sm font-bold text-zinc-200 mt-0.5">{metric.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Platform breakdown */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {[
              {
                platform: 'Google Reviews',
                icon: '🔍',
                rating: avgRating.toFixed(1),
                count: reviews.filter(r => r.platform === 'google').length,
                status: avgRating >= 4 ? 'Strong' : 'Needs work',
                color: avgRating >= 4 ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5',
              },
              {
                platform: 'Social Mentions',
                icon: '📱',
                rating: `${mentions.filter(m => m.sentiment === 'positive').length}/${mentions.length}`,
                count: mentions.length,
                status: 'Positive',
                color: 'border-[#6366f1]/20 bg-[#6366f1]/5',
              },
              {
                platform: 'Media Coverage',
                icon: '📰',
                rating: mentions.filter(m => m.platform === 'news').length.toString(),
                count: mentions.filter(m => m.platform === 'news').length,
                status: 'Featured',
                color: 'border-amber-500/20 bg-amber-500/5',
              },
            ].map(p => (
              <div key={p.platform} className={`rounded-xl border ${p.color} p-4`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{p.icon}</span>
                  <p className="text-sm font-semibold text-zinc-200">{p.platform}</p>
                </div>
                <p className="text-2xl font-bold text-zinc-100">{p.rating}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-zinc-500">{p.count} total</p>
                  <span className="text-xs font-medium text-emerald-400">{p.status}</span>
                </div>
              </div>
            ))}
          </div>

          {/* AI recommendations */}
          <div className="rounded-xl border border-[#6366f1]/20 bg-[#6366f1]/5 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#818cf8]" />
              <h3 className="text-sm font-semibold text-zinc-200">AI Recommendations</h3>
            </div>
            <div className="space-y-2">
              {[
                { icon: unrepliedNegative > 0 ? '🚨' : '✅', text: unrepliedNegative > 0 ? `Reply to ${unrepliedNegative} negative reviews urgently — AI has drafts ready` : 'All negative reviews addressed — great reputation hygiene' },
                { icon: '📣', text: 'Request reviews from 3 recently completed projects to increase volume' },
                { icon: '💡', text: 'Amplify the award win coverage — share across LinkedIn, IG, website' },
                { icon: '🔍', text: 'Set up alerts for "Envicion Studios Malaysia" — AI will notify you of new mentions' },
              ].map((rec, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800/30 px-3 py-2">
                  <span className="text-sm flex-shrink-0">{rec.icon}</span>
                  <p className="text-xs text-zinc-300 leading-relaxed">{rec.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── REVIEWS TAB ───────────────────────────────────────────────────── */}
      {activeTab === 'reviews' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {[
                { label: 'All', count: reviews.length, color: 'text-zinc-300' },
                { label: '⭐ 4-5★', count: reviews.filter(r => r.rating >= 4).length, color: 'text-emerald-400' },
                { label: '⚠️ 1-2★', count: reviews.filter(r => r.rating <= 2).length, color: 'text-red-400' },
                { label: '💬 Unreplied', count: reviews.filter(r => !r.replied).length, color: 'text-amber-400' },
              ].map(f => (
                <span key={f.label} className={`text-xs font-semibold ${f.color}`}>
                  {f.label}: {f.count}
                </span>
              ))}
            </div>
          </div>

          {reviews.map(review => (
            <div
              key={review.id}
              className={`rounded-xl border p-4 space-y-3 transition-all ${
                review.rating <= 2 && !review.replied
                  ? 'border-red-500/30 bg-red-500/5'
                  : review.replied
                  ? 'border-zinc-800/30 bg-zinc-900/20 opacity-70'
                  : 'border-zinc-800/60 bg-zinc-900/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#6366f1]/15 text-[#818cf8] text-xs font-semibold">
                    {review.author[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-zinc-100">{review.author}</p>
                      <span className="text-xs text-zinc-500">{PLATFORM_CONFIG[review.platform]?.icon} {PLATFORM_CONFIG[review.platform]?.label}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StarRating rating={review.rating} />
                      <span className="text-[10px] text-zinc-600">{review.date}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {review.replied ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> Replied
                    </span>
                  ) : (
                    <button type="button"
                      onClick={() => handleDraftReply(review.id, 'review')}
                      disabled={draftingId === review.id}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                        review.rating <= 2
                          ? 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                          : 'border-[#6366f1]/30 bg-[#6366f1]/10 text-[#818cf8] hover:bg-[#6366f1]/20'
                      }`}
                    >
                      {draftingId === review.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                      AI Reply
                    </button>
                  )}
                </div>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">&quot;{review.text}&quot;</p>

              {review.aiDraft && review.showing && (
                <div className="rounded-lg border border-[#6366f1]/20 bg-[#6366f1]/5 p-3 space-y-2">
                  <p className="text-[10px] font-semibold text-[#818cf8] uppercase tracking-wider">AI Draft Reply</p>
                  <p className="text-xs text-zinc-300 leading-relaxed">{review.aiDraft}</p>
                  <div className="flex gap-2">
                    <button type="button"
                      onClick={() => handleCopy(review.aiDraft!, review.id)}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                        copiedId === review.id
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                          : 'border-zinc-700 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {copiedId === review.id ? <><CheckCircle2 className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                    </button>
                    <button type="button"
                      onClick={() => handleMarkReplied(review.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    >
                      <CheckCircle2 className="h-3 w-3" /> Mark Replied
                    </button>
                    <button type="button"
                      onClick={() => handleDraftReply(review.id, 'review')}
                      className="ml-auto flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      <RefreshCw className="h-3 w-3" /> Regenerate
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── SOCIAL MENTIONS TAB ───────────────────────────────────────────── */}
      {activeTab === 'mentions' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="text-emerald-400">✅ Positive: {mentions.filter(m => m.sentiment === 'positive').length}</span>
            <span className="text-zinc-400">→ Neutral: {mentions.filter(m => m.sentiment === 'neutral').length}</span>
            <span className="text-red-400">⚠️ Negative: {mentions.filter(m => m.sentiment === 'negative').length}</span>
          </div>

          {mentions.map(mention => {
            const sentCfg = SENTIMENT_CONFIG[mention.sentiment]
            const platCfg = PLATFORM_CONFIG[mention.platform]
            return (
              <div
                key={mention.id}
                className={`rounded-xl border p-4 space-y-3 ${
                  mention.sentiment === 'negative'
                    ? 'border-red-500/30 bg-red-500/5'
                    : 'border-zinc-800/60 bg-zinc-900/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm ${
                      mention.sentiment === 'positive' ? 'bg-emerald-500/15' :
                      mention.sentiment === 'negative' ? 'bg-red-500/15' : 'bg-zinc-700/30'
                    }`}>
                      {platCfg?.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-zinc-100">{mention.author}</p>
                        <span className={`text-xs font-medium ${platCfg?.color}`}>{platCfg?.label}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${sentCfg.bg} ${sentCfg.color}`}>
                          {sentCfg.icon} {mention.sentiment}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-600 mt-0.5">{mention.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {mention.sentiment !== 'positive' && (
                      <button type="button"
                        onClick={() => handleDraftReply(mention.id, 'mention')}
                        disabled={draftingId === mention.id}
                        className="flex items-center gap-1.5 rounded-lg border border-[#6366f1]/30 bg-[#6366f1]/10 px-3 py-1.5 text-xs font-semibold text-[#818cf8] hover:bg-[#6366f1]/20 disabled:opacity-60 transition-colors"
                      >
                        {draftingId === mention.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                        AI Response
                      </button>
                    )}
                    {mention.sentiment === 'positive' && (
                      <button type="button"
                        onClick={() => handleDraftReply(mention.id, 'mention')}
                        disabled={draftingId === mention.id}
                        className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-60 transition-colors"
                      >
                        {draftingId === mention.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
                        Reply
                      </button>
                    )}
                    {mention.sentiment === 'positive' && (
                      <div className="flex items-center gap-1 text-emerald-400">
                        <ThumbsUp className="h-3 w-3" />
                      </div>
                    )}
                    {mention.sentiment === 'negative' && (
                      <div className="flex items-center gap-1 text-red-400">
                        <ThumbsDown className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed">{mention.text}</p>

                {mention.aiDraft && mention.showing && (
                  <div className="rounded-lg border border-[#6366f1]/20 bg-[#6366f1]/5 p-3 space-y-2">
                    <p className="text-[10px] font-semibold text-[#818cf8] uppercase tracking-wider">AI Draft Response</p>
                    <p className="text-xs text-zinc-300 leading-relaxed">{mention.aiDraft}</p>
                    <div className="flex gap-2">
                      <button type="button"
                        onClick={() => handleCopy(mention.aiDraft!, mention.id)}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                          copiedId === mention.id
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                            : 'border-zinc-700 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {copiedId === mention.id ? <><CheckCircle2 className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                      </button>
                      <button type="button"
                        onClick={() => handleDraftReply(mention.id, 'mention')}
                        className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                      >
                        <RefreshCw className="h-3 w-3" /> Regenerate
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ─── MD WEEKLY REPORT TAB ──────────────────────────────────────────── */}
      {activeTab === 'report' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">AI generates a comprehensive reputation briefing for you as MD.</p>
            <button type="button"
              onClick={handleGenerateReport}
              disabled={generatingReport}
              className="cursor-pointer flex items-center gap-2 rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-medium text-white hover:bg-[#5558e3] disabled:opacity-60 transition-colors"
            >
              {generatingReport ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
              ) : (
                <><Zap className="h-4 w-4" /> Generate Report</>
              )}
            </button>
          </div>

          {!report && !generatingReport && (
            <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-zinc-800 bg-zinc-900/30">
              <BarChart3 className="h-10 w-10 text-zinc-700 mb-3" />
              <p className="text-sm text-zinc-500">No report generated yet</p>
              <p className="text-xs text-zinc-600 mt-1">Click "Generate Report" to create your MD reputation briefing</p>
            </div>
          )}

          {generatingReport && (
            <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-[#6366f1]/20 bg-[#6366f1]/5">
              <Loader2 className="h-8 w-8 text-[#818cf8] animate-spin mb-3" />
              <p className="text-sm text-zinc-300">AI is analysing all platforms...</p>
              <p className="text-xs text-zinc-500 mt-1">Google Reviews · Social Mentions · Media Coverage</p>
            </div>
          )}

          {report && !generatingReport && (
            <div className="space-y-5">
              {/* Report header */}
              <div className="rounded-xl border border-[#6366f1]/20 bg-[#6366f1]/5 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-zinc-100">Reputation MD Report</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">Generated: {report.generatedAt}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-black ${scoreColor}`}>{report.overallScore}</p>
                    <p className="text-[10px] text-zinc-500">Reputation Score</p>
                    <p className="text-xs text-emerald-400 flex items-center gap-1 justify-end mt-0.5">
                      <TrendingUp className="h-3 w-3" /> Improving
                    </p>
                  </div>
                </div>

                {/* Urgent action */}
                <div className={`rounded-lg border px-4 py-3 flex items-start gap-2 ${
                  unrepliedNegative > 0 ? 'border-red-500/30 bg-red-500/10' : 'border-emerald-500/30 bg-emerald-500/10'
                }`}>
                  {unrepliedNegative > 0
                    ? <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                    : <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  }
                  <p className={`text-sm font-medium ${unrepliedNegative > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                    {report.urgentAction}
                  </p>
                </div>
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { label: 'Google Rating', value: `${report.googleRating} ★`, color: 'text-amber-400' },
                  { label: 'Total Reviews', value: String(report.totalReviews), color: 'text-zinc-100' },
                  { label: 'Positive', value: String(report.positiveCount), color: 'text-emerald-400' },
                  { label: 'Mentions Volume', value: String(report.mentionVolume), color: 'text-[#818cf8]' },
                ].map(m => (
                  <div key={m.label} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 text-center">
                    <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>

              {/* Sentiment breakdown */}
              <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5">
                <h3 className="text-sm font-semibold text-zinc-200 mb-4">Social Sentiment Breakdown</h3>
                <div className="flex gap-3">
                  {[
                    { label: 'Positive', count: report.sentimentBreakdown.positive, total: mentions.length, color: 'bg-emerald-500' },
                    { label: 'Neutral', count: report.sentimentBreakdown.neutral, total: mentions.length, color: 'bg-zinc-500' },
                    { label: 'Negative', count: report.sentimentBreakdown.negative, total: mentions.length, color: 'bg-red-500' },
                  ].map(s => (
                    <div key={s.label} className="flex-1">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-zinc-500">{s.label}</span>
                        <span className="text-zinc-300 font-semibold">{s.count}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className={`h-full ${s.color} rounded-full`}
                          style={{ width: `${(s.count / s.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key strengths & areas to watch */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Key Strengths
                  </h3>
                  <ul className="space-y-2">
                    {report.keyStrengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                        <span className="text-emerald-400 flex-shrink-0">✓</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Areas to Watch
                  </h3>
                  <ul className="space-y-2">
                    {report.areasToWatch.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                        <span className="text-amber-400 flex-shrink-0">⚠</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Recommended actions */}
              <div className="rounded-xl border border-[#6366f1]/20 bg-[#6366f1]/5 p-5">
                <h3 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[#818cf8]" /> Recommended Actions
                </h3>
                <ol className="space-y-2">
                  {report.recommendedActions.map((action, i) => (
                    <li key={i} className="flex items-start gap-3 text-xs text-zinc-300">
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#6366f1]/20 text-[#818cf8] font-bold text-[10px]">
                        {i + 1}
                      </span>
                      {action}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Copy report */}
              <div className="flex justify-end">
                <button type="button"
                  onClick={() => handleCopy(
                    `REPUTATION REPORT — ${report.generatedAt}\n\nOverall Score: ${report.overallScore}/100\nGoogle Rating: ${report.googleRating} ★\nPositive Reviews: ${report.positiveCount}/${report.totalReviews}\n\nKey Strengths:\n${report.keyStrengths.map(s => `• ${s}`).join('\n')}\n\nAreas to Watch:\n${report.areasToWatch.map(s => `• ${s}`).join('\n')}\n\nActions:\n${report.recommendedActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}`,
                    'report'
                  )}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors ${
                    copiedId === 'report'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'border-zinc-700 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {copiedId === 'report' ? <><CheckCircle2 className="h-3 w-3" /> Copied Report</> : <><Copy className="h-3 w-3" /> Copy Report</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
