'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Upload,
  Download,
  Trash2,
  Image as ImageIcon,
  FileText,
  Type,
  Palette,
  File,
  Loader2,
  ArrowLeft,
  CheckCircle,
  Paperclip,
} from 'lucide-react'

type BrandAssetType = 'LOGO' | 'COLOUR_PALETTE' | 'FONT' | 'GUIDELINE' | 'OTHER'

interface BrandAsset {
  id: string
  type: BrandAssetType
  filename: string
  url: string
  createdAt: string
  metadata?: Record<string, string>
  uploadedBy?: { name: string }
}

interface ClientInfo {
  id: string
  companyName: string
  tier: string
}

const TIER_COLORS: Record<string, string> = {
  PLATINUM: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  GOLD: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  SILVER: 'text-zinc-300 bg-zinc-500/10 border-zinc-500/20',
  BRONZE: 'text-orange-300 bg-orange-500/10 border-orange-500/20',
}

const SECTION_CONFIG: {
  type: BrandAssetType
  label: string
  icon: React.ElementType
  accepts: string
}[] = [
  { type: 'LOGO', label: 'Logos', icon: ImageIcon, accepts: 'image/*' },
  { type: 'COLOUR_PALETTE', label: 'Colour Palettes', icon: Palette, accepts: 'image/*,.json' },
  { type: 'FONT', label: 'Fonts', icon: Type, accepts: '.ttf,.otf,.woff,.woff2' },
  { type: 'GUIDELINE', label: 'Brand Guidelines', icon: FileText, accepts: '.pdf' },
  { type: 'OTHER', label: 'Other Assets', icon: File, accepts: '*' },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatFileSize(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function isImage(filename: string) {
  return /\.(png|jpg|jpeg|gif|svg|webp|avif)$/i.test(filename)
}

export default function BrandLibraryPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()

  const [client, setClient] = useState<ClientInfo | null>(null)
  const [assets, setAssets] = useState<BrandAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [attached, setAttached] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetchData()
  }, [status, clientId])

  async function fetchData() {
    setLoading(true)
    try {
      const [assetsRes, clientRes] = await Promise.all([
        fetch(`/api/brand-assets/${clientId}`),
        fetch(`/api/crm/clients/${clientId}`),
      ])
      const assetsJson = await assetsRes.json() as { data: BrandAsset[] }
      const clientJson = await clientRes.json() as { data: ClientInfo }
      setAssets(assetsJson.data ?? [])
      setClient(clientJson.data ?? null)
    } catch {
      setError('Failed to load brand assets')
    } finally {
      setLoading(false)
    }
  }

  async function uploadFile(file: File, type: BrandAssetType = 'OTHER') {
    setUploading(true)
    setError(null)
    try {
      // Read file as base64 data URL for storage-agnostic upload
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsDataURL(file)
      })

      const res = await fetch(`/api/brand-assets/${clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          filename: file.name,
          url: dataUrl,
        }),
      })
      if (!res.ok) throw new Error('Upload failed')
      const json = await res.json() as { data: BrandAsset }
      setAssets(prev => [json.data, ...prev])
    } catch {
      setError('Failed to upload file. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  function detectType(file: File): BrandAssetType {
    const name = file.name.toLowerCase()
    if (/\.(ttf|otf|woff|woff2)$/.test(name)) return 'FONT'
    if (/\.pdf$/.test(name)) return 'GUIDELINE'
    if (name.includes('logo')) return 'LOGO'
    if (name.includes('palette') || name.includes('color') || name.includes('colour')) return 'COLOUR_PALETTE'
    return 'OTHER'
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    files.forEach(f => uploadFile(f, detectType(f)))
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    files.forEach(f => uploadFile(f, detectType(f)))
    e.target.value = ''
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this asset?')) return
    setDeletingId(id)
    try {
      await fetch(`/api/brand-assets/${clientId}/${id}`, { method: 'DELETE' })
      setAssets(prev => prev.filter(a => a.id !== id))
    } catch {
      setError('Failed to delete asset')
    } finally {
      setDeletingId(null)
    }
  }

  function handleAttachAll() {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('attachedClientId', clientId)
    }
    setAttached(true)
    setTimeout(() => setAttached(false), 2000)
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
          <span className="text-sm text-zinc-500">Loading brand library...</span>
        </div>
      </div>
    )
  }

  const assetsByType = SECTION_CONFIG.map(section => ({
    ...section,
    items: assets.filter(a => a.type === section.type),
  }))

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button type="button"
            onClick={() => router.back()}
            className="mt-0.5 rounded-md p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-zinc-100">
                {client?.companyName ?? 'Brand Library'}
              </h1>
              {client?.tier && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${TIER_COLORS[client.tier] ?? ''}`}>
                  {client.tier}
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-500 mt-0.5">
              {assets.length} asset{assets.length !== 1 ? 's' : ''} · Brand assets &amp; guidelines
            </p>
          </div>
        </div>
        <button type="button"
          onClick={handleAttachAll}
          disabled={assets.length === 0}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            attached
              ? 'bg-emerald-600 text-white'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed'
          }`}
        >
          {attached ? (
            <><CheckCircle className="h-4 w-4" /> Attached!</>
          ) : (
            <><Paperclip className="h-4 w-4" /> Attach All to Next Brief</>
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Drop Zone */}
      <div
        ref={dropRef}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative rounded-xl border-2 border-dashed transition-all duration-200 ${
          dragOver
            ? 'border-[#6366f1] bg-[#6366f1]/5'
            : 'border-zinc-700 hover:border-zinc-600'
        } p-8 text-center`}
      >
        <input
          type="file"
          multiple
          onChange={handleFileInput}
          className="absolute inset-0 opacity-0 cursor-pointer"
          title="Upload files"
        />
        <div className="flex flex-col items-center gap-2 pointer-events-none">
          {uploading ? (
            <Loader2 className="h-8 w-8 text-[#6366f1] animate-spin" />
          ) : (
            <Upload className="h-8 w-8 text-zinc-600" />
          )}
          <div>
            <p className="text-sm font-medium text-zinc-300">
              {uploading ? 'Uploading...' : 'Drop files here or click to upload'}
            </p>
            <p className="text-xs text-zinc-600 mt-0.5">
              Images, PDFs, fonts — auto-categorised by filename
            </p>
          </div>
        </div>
      </div>

      {/* Asset Sections */}
      {assetsByType.map(section => {
        if (section.items.length === 0) return null
        const Icon = section.icon
        return (
          <div key={section.type} className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-[#818cf8]" />
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                {section.label}
              </h2>
              <span className="ml-1 text-xs text-zinc-600">({section.items.length})</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {section.items.map(asset => (
                <div
                  key={asset.id}
                  className="group relative rounded-xl border border-zinc-800 bg-[#0d0d14] overflow-hidden hover:border-zinc-700 transition-colors"
                >
                  {/* Thumbnail */}
                  {isImage(asset.filename) ? (
                    <div className="aspect-square bg-zinc-900 flex items-center justify-center overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.url}
                        alt={asset.filename}
                        className="w-full h-full object-contain p-2"
                        onError={e => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                        }}
                      />
                    </div>
                  ) : (
                    <div className="aspect-square bg-zinc-900 flex items-center justify-center">
                      {section.type === 'FONT' ? (
                        <Type className="h-10 w-10 text-zinc-700" />
                      ) : section.type === 'GUIDELINE' ? (
                        <FileText className="h-10 w-10 text-zinc-700" />
                      ) : (
                        <File className="h-10 w-10 text-zinc-700" />
                      )}
                    </div>
                  )}

                  {/* Info */}
                  <div className="p-2.5">
                    <p className="text-xs font-medium text-zinc-300 truncate" title={asset.filename}>
                      {asset.filename}
                    </p>
                    <p className="text-xs text-zinc-600 mt-0.5">{formatDate(asset.createdAt)}</p>
                    {asset.uploadedBy && (
                      <p className="text-xs text-zinc-700 truncate">{asset.uploadedBy.name}</p>
                    )}
                  </div>

                  {/* Actions overlay */}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={asset.url}
                      download={asset.filename}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-zinc-800 p-2 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                    <button type="button"
                      onClick={() => handleDelete(asset.id)}
                      disabled={deletingId === asset.id}
                      className="rounded-lg bg-red-900/50 p-2 text-red-400 hover:text-red-300 hover:bg-red-900 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      {deletingId === asset.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Empty state */}
      {assets.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Palette className="h-10 w-10 text-zinc-700 mb-3" />
          <p className="text-zinc-400 font-medium">No brand assets yet</p>
          <p className="text-sm text-zinc-600 mt-1">Upload logos, fonts, guidelines, and colour palettes</p>
        </div>
      )}
    </div>
  )
}
