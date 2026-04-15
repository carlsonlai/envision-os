'use client'

import { useState } from 'react'
import { CheckCircle2, X, Download } from 'lucide-react'

export interface FileVersionItem {
  id: string
  version: number
  filename: string
  url: string
  fileSize?: number | null
  createdAt: string
  uploadedBy?: { name: string }
  isApproved?: boolean
  isCurrent?: boolean
}

interface Props {
  versions: FileVersionItem[]
  className?: string
}

export default function FileVersionGallery({ versions, className = '' }: Props) {
  const [previewing, setPreviewing] = useState<FileVersionItem | null>(null)

  if (versions.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-dashed border-zinc-800 p-8 ${className}`}
      >
        <p className="text-xs text-zinc-600">No versions uploaded yet</p>
      </div>
    )
  }

  function isImage(filename: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp|svg|avif)$/i.test(filename)
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {versions.map((v) => (
          <button
            key={v.id}
            onClick={() => setPreviewing(v)}
            className={`group relative rounded-lg overflow-hidden border text-left transition-all duration-150 hover:border-[#6366f1]/60 ${
              v.isApproved
                ? 'border-emerald-500/40 bg-emerald-500/5'
                : v.isCurrent
                ? 'border-[#6366f1]/40 bg-[#6366f1]/5'
                : 'border-zinc-800/60 bg-zinc-900/40'
            }`}
          >
            {/* Thumbnail */}
            <div className="aspect-square bg-zinc-800/60 overflow-hidden relative">
              {isImage(v.filename) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={v.url}
                  alt={v.filename}
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <span className="text-2xl">
                    {v.filename.match(/\.pdf$/i) ? '📄' : '📁'}
                  </span>
                </div>
              )}

              {/* Approved checkmark */}
              {v.isApproved && (
                <div className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500">
                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-2 space-y-0.5">
              <div className="flex items-center justify-between gap-1">
                <span
                  className={`text-[10px] font-semibold ${
                    v.isApproved ? 'text-emerald-400' : v.isCurrent ? 'text-[#818cf8]' : 'text-zinc-400'
                  }`}
                >
                  {v.isApproved ? 'FINAL' : `v${v.version}`}
                </span>
                {v.isCurrent && !v.isApproved && (
                  <span className="text-[9px] text-[#818cf8] font-medium">Latest</span>
                )}
              </div>
              <p className="text-[10px] text-zinc-500 truncate" title={v.filename}>
                {v.filename}
              </p>
              <p className="text-[9px] text-zinc-700">
                {new Date(v.createdAt).toLocaleDateString('en-MY', {
                  day: 'numeric',
                  month: 'short',
                })}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Preview modal */}
      {previewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setPreviewing(null)}
        >
          <div
            className="relative max-w-5xl w-full rounded-xl overflow-hidden border border-zinc-700 shadow-2xl bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-[#818cf8]">
                    v{previewing.version}
                  </span>
                  {previewing.isApproved && (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                      <CheckCircle2 className="h-3 w-3" /> FINAL APPROVED
                    </span>
                  )}
                  <span className="text-xs text-zinc-400">{previewing.filename}</span>
                </div>
                {previewing.uploadedBy && (
                  <p className="text-[10px] text-zinc-600 mt-0.5">
                    Uploaded by {previewing.uploadedBy.name} &middot;{' '}
                    {new Date(previewing.createdAt).toLocaleString('en-MY', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewing.url}
                  download={previewing.filename}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-zinc-700 transition-all"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
                <button
                  onClick={() => setPreviewing(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="max-h-[75vh] overflow-auto p-4 flex items-center justify-center bg-zinc-950/50">
              {isImage(previewing.filename) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewing.url}
                  alt={previewing.filename}
                  className="max-w-full h-auto rounded"
                />
              ) : previewing.filename.match(/\.pdf$/i) ? (
                <iframe
                  src={previewing.url}
                  className="w-full h-[70vh] rounded"
                  title={previewing.filename}
                />
              ) : (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4">📁</div>
                  <p className="text-sm text-zinc-400">{previewing.filename}</p>
                  <a
                    href={previewing.url}
                    download={previewing.filename}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-medium text-white hover:bg-[#5558e3] transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
