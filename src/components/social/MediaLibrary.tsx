'use client'

/**
 * MediaLibrary — Drive-backed asset picker for the Social Hub composer.
 *
 * Uploads go through /api/assets/upload (Google Drive + Postgres pointer).
 * Listing comes from /api/assets/list. Selected assets are passed back to the
 * parent via onSelect so the composer can attach them to scheduled posts.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, Loader2, Trash2, ImageIcon, Video, FileText, CheckCircle2 } from 'lucide-react'

export interface MediaAsset {
  id: string
  driveFileId: string
  name: string
  mimeType: string
  sizeBytes: number
  kind: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO' | 'OTHER'
  webViewLink: string | null
  webContentLink: string | null
  thumbnailLink: string | null
  platform: string | null
  createdAt: string
}

interface Props {
  platform?: string
  selectedIds?: string[]
  onSelect?: (asset: MediaAsset) => void
  onDeselect?: (asset: MediaAsset) => void
  /** When false, clicking a tile just previews via webViewLink instead of selecting. */
  selectable?: boolean
}

export function MediaLibrary({
  platform,
  selectedIds = [],
  onSelect,
  onDeselect,
  selectable = true,
}: Props) {
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (platform) qs.set('platform', platform)
    qs.set('limit', '60')
    try {
      const res = await fetch(`/api/assets/list?${qs.toString()}`)
      const data = await res.json()
      if (res.ok && data.assets) setAssets(data.assets)
      else setError(data.error ?? `HTTP ${res.status}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load assets')
    } finally {
      setLoading(false)
    }
  }, [platform])

  useEffect(() => {
    load()
  }, [load])

  async function handleUpload(files: FileList | null) {
    if (!files || !files.length) return
    setUploading(true)
    setError(null)
    for (const file of Array.from(files)) {
      const form = new FormData()
      form.append('file', file)
      if (platform) form.append('platform', platform)
      try {
        const res = await fetch('/api/assets/upload', { method: 'POST', body: form })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? `Upload failed (${res.status})`)
        } else if (data.asset) {
          setAssets(prev => [data.asset, ...prev])
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed')
      }
    }
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleDelete(asset: MediaAsset) {
    if (!confirm(`Delete "${asset.name}" from Drive + library?`)) return
    const res = await fetch(`/api/assets/${asset.id}`, { method: 'DELETE' })
    if (res.ok) setAssets(prev => prev.filter(a => a.id !== asset.id))
  }

  function handleTileClick(asset: MediaAsset) {
    if (!selectable) {
      if (asset.webViewLink) window.open(asset.webViewLink, '_blank', 'noopener,noreferrer')
      return
    }
    if (selectedIds.includes(asset.id)) onDeselect?.(asset)
    else onSelect?.(asset)
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">
          Media Library
          {platform && <span className="ml-2 text-xs text-white/50">· {platform}</span>}
        </h3>
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/*,application/pdf"
            onChange={e => handleUpload(e.target.files)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/90 hover:bg-amber-500 text-black text-xs font-semibold px-3 py-1.5 disabled:opacity-60"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? 'Uploading…' : 'Upload to Drive'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10 text-white/50 text-sm">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading library…
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-10 text-white/40 text-sm">
          No media yet. Upload images or videos to start building the Envicion content library.
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {assets.map(a => {
            const isSelected = selectedIds.includes(a.id)
            const Icon = a.kind === 'IMAGE' ? ImageIcon : a.kind === 'VIDEO' ? Video : FileText
            return (
              <div
                key={a.id}
                className={`group relative aspect-square rounded-lg overflow-hidden border cursor-pointer transition
                  ${isSelected ? 'border-amber-400 ring-2 ring-amber-400/50' : 'border-white/10 hover:border-white/30'}`}
                onClick={() => handleTileClick(a)}
                title={a.name}
              >
                {a.kind === 'IMAGE' && a.thumbnailLink ? (
                  // Drive thumbs are fine as-is; no need to use next/image for ephemeral lib
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.thumbnailLink} alt={a.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-white/5">
                    <Icon className="w-6 h-6 text-white/40" />
                  </div>
                )}
                {isSelected && (
                  <div className="absolute top-1 right-1 rounded-full bg-amber-400 text-black p-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    handleDelete(a)
                  }}
                  className="absolute bottom-1 right-1 rounded-md bg-black/70 text-white/80 p-1 opacity-0 group-hover:opacity-100 transition"
                  aria-label="Delete asset"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
