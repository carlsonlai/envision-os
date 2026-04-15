'use client'

import { useState } from 'react'
import {
  Upload,
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Eye,
} from 'lucide-react'

export interface TimelineEvent {
  id: string
  type:
    | 'upload'
    | 'revision'
    | 'approved'
    | 'rejected'
    | 'limit_hit'
    | 'qc_passed'
    | 'qc_failed'
    | 'delivered'
    | 'fa_signed'
  label: string
  detail?: string
  who?: string
  timestamp: string
  versionUrl?: string
  versionLabel?: string
}

interface Props {
  events: TimelineEvent[]
  revisionCount: number
  revisionLimit: number
  className?: string
}

const EVENT_STYLES: Record<
  TimelineEvent['type'],
  { icon: React.ElementType; color: string; bg: string; border: string }
> = {
  upload: { icon: Upload, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  revision: { icon: MessageSquare, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  approved: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  rejected: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  limit_hit: { icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  qc_passed: { icon: CheckCircle2, color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },
  qc_failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  delivered: { icon: CheckCircle2, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/30' },
  fa_signed: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
}

function RevisionBar({ used, limit }: { used: number; limit: number }) {
  const percent = Math.min(100, (used / limit) * 100)
  const color =
    percent >= 100 ? 'from-red-500 to-red-600' : percent >= 80 ? 'from-amber-400 to-orange-500' : 'from-[#6366f1] to-[#8b5cf6]'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-zinc-500">
          <RotateCcw className="h-3 w-3" />
          <span>Revisions used</span>
        </div>
        <span
          className={`font-semibold text-xs ${
            percent >= 100 ? 'text-red-400' : percent >= 80 ? 'text-amber-400' : 'text-zinc-300'
          }`}
        >
          {used}/{limit}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {percent >= 100 && (
        <p className="text-[10px] text-red-400 font-medium">Revision limit reached</p>
      )}
    </div>
  )
}

export default function RevisionTimeline({ events, revisionCount, revisionLimit, className = '' }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Revision bar */}
      <RevisionBar used={revisionCount} limit={revisionLimit} />

      {/* Timeline */}
      <div className="space-y-0">
        {events.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center">
            <p className="text-xs text-zinc-600">No activity yet</p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-zinc-800" />

            <div className="space-y-0">
              {events.map((event, idx) => {
                const style = EVENT_STYLES[event.type]
                const Icon = style.icon
                const isLast = idx === events.length - 1

                return (
                  <div key={event.id} className={`relative flex gap-3 ${isLast ? '' : 'pb-4'}`}>
                    {/* Icon bubble */}
                    <div
                      className={`relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border ${style.border} ${style.bg}`}
                    >
                      <Icon className={`h-4 w-4 ${style.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-200">{event.label}</p>
                          {event.who && (
                            <p className="text-xs text-zinc-500 mt-0.5">by {event.who}</p>
                          )}
                          {event.detail && (
                            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{event.detail}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {event.versionUrl && (
                            <button
                              onClick={() => setPreviewUrl(event.versionUrl!)}
                              className="flex items-center gap-0.5 text-[10px] text-zinc-500 hover:text-[#818cf8] transition-colors"
                              title="View this version"
                            >
                              <Eye className="h-3 w-3" />
                              {event.versionLabel}
                            </button>
                          )}
                          <span className="text-[10px] text-zinc-600 whitespace-nowrap">
                            {new Date(event.timestamp).toLocaleString('en-MY', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Version preview modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="relative max-w-4xl w-full rounded-xl overflow-hidden border border-zinc-700 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900/90 text-zinc-300 hover:text-white transition-colors"
            >
              ✕
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Version preview" className="w-full h-auto max-h-[80vh] object-contain" />
          </div>
        </div>
      )}
    </div>
  )
}
