'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  Pencil,
  X,
  Clock,
  Hash,
  Zap,
  ImageIcon,
  Video,
  FileText,
  Loader2,
  Eye,
} from 'lucide-react'

export interface SocialPost {
  id: string
  platform: string
  caption: string
  hashtags: string[]
  imagePrompt: string | null
  bestTime: string | null
  contentType?: string
  status: string
  createdAt: string
}

interface PostPreviewCardProps {
  post: SocialPost
  onApprove: (id: string) => Promise<void>
  onEdit: (id: string, caption: string, hashtags: string[]) => Promise<void>
  onReject: (id: string) => Promise<void>
}

const PLATFORM_CONFIG: Record<string, {
  name: string
  handle: string
  emoji: string
  color: string
  textColor: string
  bg: string
  border: string
  gradient: string
}> = {
  instagram: {
    name: 'Instagram',
    handle: '@envicionstudio',
    emoji: '📸',
    color: '#e1306c',
    textColor: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/30',
    gradient: 'from-purple-600 via-pink-500 to-orange-400',
  },
  tiktok: {
    name: 'TikTok',
    handle: '@envicionstudio',
    emoji: '🎵',
    color: '#ff0050',
    textColor: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    gradient: 'from-zinc-900 via-rose-900 to-zinc-900',
  },
  linkedin: {
    name: 'LinkedIn',
    handle: 'Envicion Studios',
    emoji: '💼',
    color: '#0a66c2',
    textColor: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    gradient: 'from-sky-900 via-sky-800 to-sky-900',
  },
  facebook: {
    name: 'Facebook',
    handle: 'Envicion Studios',
    emoji: '📘',
    color: '#1877f2',
    textColor: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    gradient: 'from-blue-900 via-blue-800 to-blue-900',
  },
  youtube: {
    name: 'YouTube',
    handle: '@EnvicionStudios',
    emoji: '▶️',
    color: '#ff0000',
    textColor: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    gradient: 'from-zinc-900 via-red-950 to-zinc-900',
  },
  rednote: {
    name: '小红书',
    handle: '@envicionstudio',
    emoji: '📕',
    color: '#fe2c55',
    textColor: 'text-red-300',
    bg: 'bg-red-500/5',
    border: 'border-red-400/20',
    gradient: 'from-red-950 via-red-900 to-red-950',
  },
  mailchimp: {
    name: 'Newsletter',
    handle: 'Envicion Studios',
    emoji: '✉️',
    color: '#ffe01b',
    textColor: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    gradient: 'from-amber-950 via-amber-900 to-amber-950',
  },
}

const FALLBACK_PLATFORM = {
  name: 'Social',
  handle: '@envicionstudio',
  emoji: '📱',
  color: '#6366f1',
  textColor: 'text-indigo-400',
  bg: 'bg-indigo-500/10',
  border: 'border-indigo-500/30',
  gradient: 'from-indigo-900 via-violet-900 to-indigo-900',
}

function ContentTypeIcon({ type }: { type?: string }) {
  if (type === 'reel' || type === 'video') return <Video className="h-5 w-5 text-white/70" />
  if (type === 'article') return <FileText className="h-5 w-5 text-white/70" />
  return <ImageIcon className="h-5 w-5 text-white/70" />
}

export function PostPreviewCard({ post, onApprove, onEdit, onReject }: PostPreviewCardProps) {
  const cfg = PLATFORM_CONFIG[post.platform] ?? FALLBACK_PLATFORM
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editCaption, setEditCaption] = useState(post.caption)
  const [editHashtags, setEditHashtags] = useState(post.hashtags.join(' '))
  const [saving, setSaving] = useState(false)
  const [showFull, setShowFull] = useState(false)

  async function handleApprove() {
    setApproving(true)
    await onApprove(post.id)
    setApproving(false)
  }

  async function handleReject() {
    setRejecting(true)
    await onReject(post.id)
    setRejecting(false)
  }

  async function handleSaveEdit() {
    setSaving(true)
    const tags = editHashtags
      .split(/[\s,]+/)
      .map(t => t.replace(/^#/, '').trim())
      .filter(Boolean)
    await onEdit(post.id, editCaption, tags)
    setSaving(false)
    setEditing(false)
  }

  const displayHashtags = post.hashtags.slice(0, 5)
  const extraHashtags = post.hashtags.length - 5

  return (
    <div className={`rounded-2xl border ${cfg.border} bg-zinc-900/60 overflow-hidden flex flex-col shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5`}>

      {/* ── Visual Mockup ── */}
      <div className={`relative bg-gradient-to-br ${cfg.gradient} aspect-[4/3] flex flex-col`}>

        {/* Platform header bar (simulates native app chrome) */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          {/* Envicion logo mark */}
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] shadow-md">
            <Zap className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white leading-tight truncate">Envicion Studios</p>
            <p className="text-[9px] text-white/50 leading-tight truncate">{cfg.handle}</p>
          </div>
          <span className="text-base leading-none flex-shrink-0">{cfg.emoji}</span>
        </div>

        {/* Main visual area */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-3 gap-2">
          {/* Content type indicator */}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
            <ContentTypeIcon type={post.contentType} />
          </div>

          {/* Image prompt teaser */}
          {post.imagePrompt && (
            <p className="text-[10px] text-white/60 text-center line-clamp-2 leading-relaxed max-w-[200px]">
              {post.imagePrompt.slice(0, 80)}…
            </p>
          )}
        </div>

        {/* Envicion watermark / CI stamp */}
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 px-2 py-0.5">
          <Zap className="h-2.5 w-2.5 text-[#818cf8]" />
          <span className="text-[9px] font-semibold text-white/70 tracking-wide">ENVICION</span>
        </div>

        {/* Best time badge */}
        {post.bestTime && (
          <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/15 px-2 py-0.5">
            <Clock className="h-2.5 w-2.5 text-emerald-400" />
            <span className="text-[9px] text-white/80">{post.bestTime}</span>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 p-4 space-y-3">

        {/* Platform badge + date */}
        <div className="flex items-center justify-between">
          <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cfg.border} ${cfg.bg} ${cfg.textColor}`}>
            <span className="text-xs leading-none">{cfg.emoji}</span>
            {cfg.name}
          </span>
          <span className="text-[10px] text-zinc-600">
            {new Date(post.createdAt).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
          </span>
        </div>

        {/* Caption / Edit mode */}
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editCaption}
              onChange={e => setEditCaption(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-[#6366f1]/40 bg-zinc-800 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-[#6366f1] resize-none"
            />
            <input
              value={editHashtags}
              onChange={e => setEditHashtags(e.target.value)}
              placeholder="#hashtag1 #hashtag2"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-[#6366f1]/50"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#6366f1] py-1.5 text-xs font-semibold text-white hover:bg-[#5558e3] disabled:opacity-60 transition-colors"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="relative">
              <p className={`text-xs text-zinc-300 leading-relaxed ${showFull ? '' : 'line-clamp-3'}`}>
                {post.caption}
              </p>
              {post.caption.length > 120 && (
                <button
                  type="button"
                  onClick={() => setShowFull(f => !f)}
                  className="text-[10px] text-[#818cf8] hover:text-[#a5b4fc] transition-colors mt-0.5"
                >
                  {showFull ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>

            {/* Hashtags */}
            {displayHashtags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {displayHashtags.map(tag => (
                  <span key={tag} className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${cfg.border} ${cfg.bg} ${cfg.textColor}`}>
                    <Hash className="h-2 w-2" />{tag.replace(/^#/, '')}
                  </span>
                ))}
                {extraHashtags > 0 && (
                  <span className="rounded-full border border-zinc-700 bg-zinc-800/50 px-1.5 py-0.5 text-[9px] text-zinc-500">
                    +{extraHashtags} more
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Actions ── */}
      {!editing && (
        <div className="border-t border-zinc-800/60 px-4 py-3 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={handleApprove}
            disabled={approving || rejecting}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-all"
          >
            {approving
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <CheckCircle2 className="h-3.5 w-3.5" />}
            Approve
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={approving || rejecting}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-[#6366f1]/30 bg-[#6366f1]/10 py-2 text-xs font-semibold text-[#818cf8] hover:bg-[#6366f1]/20 disabled:opacity-50 transition-all"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={approving || rejecting}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-all"
          >
            {rejecting
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <X className="h-3.5 w-3.5" />}
            Reject
          </button>
        </div>
      )}
    </div>
  )
}

// Compact card for scheduled / posted posts
export function PostCompactRow({ post, onView }: { post: SocialPost; onView?: (post: SocialPost) => void }) {
  const cfg = PLATFORM_CONFIG[post.platform] ?? FALLBACK_PLATFORM

  return (
    <div className={`flex items-center gap-3 rounded-xl border ${cfg.border} ${cfg.bg} px-4 py-3`}>
      <span className="text-base flex-shrink-0 leading-none">{cfg.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-300 line-clamp-1">{post.caption}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {post.bestTime && (
            <span className="flex items-center gap-0.5 text-[10px] text-emerald-400">
              <Clock className="h-2.5 w-2.5" /> {post.bestTime}
            </span>
          )}
          {post.hashtags.slice(0, 2).map(t => (
            <span key={t} className={`text-[9px] ${cfg.textColor}`}>#{t.replace(/^#/, '')}</span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${
          post.status === 'approved' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' :
          post.status === 'scheduled' ? 'border-blue-500/30 bg-blue-500/10 text-blue-400' :
          post.status === 'posted' ? 'border-zinc-600 bg-zinc-800 text-zinc-400' :
          'border-zinc-700 text-zinc-500'
        }`}>
          {post.status === 'approved' ? '✓ Approved' :
           post.status === 'scheduled' ? '⏰ Scheduled' :
           post.status === 'posted' ? '✓ Posted' : post.status}
        </span>
        {onView && (
          <button type="button" onClick={() => onView(post)} className="text-zinc-600 hover:text-zinc-300 transition-colors">
            <Eye className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
