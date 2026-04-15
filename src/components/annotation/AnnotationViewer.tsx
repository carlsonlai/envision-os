'use client'

import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import type { AnnotationData, AnnotationComment } from '@/services/annotation'

interface Props {
  imageUrl: string
  annotations: AnnotationData | null
  className?: string
}

export default function AnnotationViewer({ imageUrl, annotations, className = '' }: Props) {
  const [activePin, setActivePin] = useState<AnnotationComment | null>(null)
  const [activePinIndex, setActivePinIndex] = useState<number | null>(null)

  const comments = annotations?.comments ?? []

  function handlePinClick(comment: AnnotationComment, idx: number) {
    if (activePin?.id === comment.id) {
      setActivePin(null)
      setActivePinIndex(null)
    } else {
      setActivePin(comment)
      setActivePinIndex(idx)
    }
  }

  if (!imageUrl) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-900/40 ${className}`}
      >
        <p className="text-xs text-zinc-600">No file uploaded yet</p>
      </div>
    )
  }

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="Artwork"
        className="max-w-full h-auto rounded-lg border border-zinc-800 block"
        draggable={false}
      />

      {/* Comment pins overlay */}
      {comments.map((comment, idx) => (
        <div
          key={comment.id}
          className="absolute group"
          style={{ left: comment.x - 12, top: comment.y - 12 }}
        >
          <button
            onClick={() => handlePinClick(comment, idx)}
            className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg transition-transform ${
              activePin?.id === comment.id ? 'scale-125 ring-2 ring-white/40' : 'hover:scale-110'
            }`}
            style={{ backgroundColor: '#ef4444' }}
          >
            {idx + 1}
          </button>

          {/* Tooltip on hover (when no pin is active) */}
          {activePin?.id !== comment.id && (
            <div className="absolute left-8 top-0 z-10 hidden group-hover:block min-w-max max-w-xs rounded-lg bg-zinc-900 border border-zinc-700 p-2 shadow-xl pointer-events-none">
              <p className="text-[10px] font-medium text-zinc-400 mb-0.5">{comment.authorName}</p>
              <p className="text-xs text-zinc-200">{comment.text}</p>
            </div>
          )}
        </div>
      ))}

      {/* Active pin detail panel */}
      {activePin && activePinIndex !== null && (
        <div
          className="absolute z-20 w-64 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl p-3"
          style={{
            left: Math.min(activePin.x + 16, 9999),
            top: activePin.y - 8,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
              style={{ backgroundColor: '#ef4444' }}
            >
              {activePinIndex + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-zinc-200 truncate">{activePin.authorName}</p>
              <p className="text-[10px] text-zinc-500">
                {new Date(activePin.createdAt).toLocaleString('en-MY', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <button
              onClick={() => { setActivePin(null); setActivePinIndex(null) }}
              className="text-zinc-600 hover:text-zinc-300 transition-colors text-xs"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-zinc-200 leading-relaxed">{activePin.text}</p>
          {activePin.resolved && (
            <span className="mt-2 inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
              ✓ Resolved
            </span>
          )}
        </div>
      )}

      {/* No annotations indicator */}
      {comments.length === 0 && annotations?.objects && annotations.objects.length > 0 && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-zinc-900/80 border border-zinc-700 px-2 py-1">
          <span className="text-[10px] text-zinc-400">Drawings only — no pins</span>
        </div>
      )}

      {/* Pin count badge */}
      {comments.length > 0 && (
        <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-zinc-900/90 border border-zinc-700 px-2 py-1">
          <MessageSquare className="h-3 w-3 text-zinc-400" />
          <span className="text-[10px] text-zinc-400">{comments.length} comment{comments.length !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  )
}
