'use client'

import { useState, useMemo } from 'react'
import {
  Library,
  Upload,
  DownloadCloud,
  Eye,
  Trash2,
  Copy,
  X,
  Search,
  Grid as GridIcon,
  List as ListIcon,
  ImageIcon,
  Video,
  FileText,
  Layers,
  FolderOpen,
  Sparkles,
  ArrowRight,
  Check,
} from 'lucide-react'

interface MediaAsset {
  id: string
  name: string
  type: 'image' | 'video' | 'document' | 'template' | 'ai-generated'
  size: string
  date: string
  category: 'brand' | 'social' | 'client' | 'template' | 'ai'
  platform?: string
  usageCount: number
  gradient: string
  tags: string[]
}

const MOCK_ASSETS: MediaAsset[] = [
  {
    id: '1',
    name: 'Primary Logo',
    type: 'image',
    size: '2.4 MB',
    date: '2026-04-15',
    category: 'brand',
    usageCount: 12,
    gradient: 'from-violet-900 to-indigo-900',
    tags: ['logo', 'primary', 'brand'],
  },
  {
    id: '2',
    name: 'Color Palette Guidelines',
    type: 'document',
    size: '1.8 MB',
    date: '2026-04-14',
    category: 'brand',
    usageCount: 8,
    gradient: 'from-pink-900 to-rose-900',
    tags: ['colors', 'guidelines', 'brand'],
  },
  {
    id: '3',
    name: 'Instagram Post Template',
    type: 'template',
    size: '5.2 MB',
    date: '2026-04-18',
    category: 'template',
    usageCount: 24,
    gradient: 'from-sky-900 to-blue-900',
    tags: ['instagram', 'social', 'template'],
  },
  {
    id: '4',
    name: 'TikTok Thumbnail v1',
    type: 'image',
    size: '0.8 MB',
    date: '2026-04-12',
    category: 'social',
    platform: 'TikTok',
    usageCount: 15,
    gradient: 'from-emerald-900 to-teal-900',
    tags: ['tiktok', 'thumbnail', 'video'],
  },
  {
    id: '5',
    name: 'Brand Showcase Video',
    type: 'video',
    size: '45.3 MB',
    date: '2026-04-10',
    category: 'brand',
    usageCount: 5,
    gradient: 'from-amber-900 to-orange-900',
    tags: ['brand', 'video', 'showcase'],
  },
  {
    id: '6',
    name: 'LinkedIn Banner 2026',
    type: 'image',
    size: '3.1 MB',
    date: '2026-04-16',
    category: 'social',
    platform: 'LinkedIn',
    usageCount: 6,
    gradient: 'from-blue-900 to-cyan-900',
    tags: ['linkedin', 'banner', 'professional'],
  },
  {
    id: '7',
    name: 'Client Proposal Template',
    type: 'document',
    size: '2.7 MB',
    date: '2026-04-13',
    category: 'client',
    usageCount: 3,
    gradient: 'from-purple-900 to-violet-900',
    tags: ['proposal', 'client', 'template'],
  },
  {
    id: '8',
    name: 'AI Generated Background',
    type: 'image',
    size: '4.2 MB',
    date: '2026-04-18',
    category: 'ai',
    usageCount: 2,
    gradient: 'from-rose-900 to-pink-900',
    tags: ['ai', 'background', 'generated'],
  },
  {
    id: '9',
    name: 'Story Template Design',
    type: 'template',
    size: '3.6 MB',
    date: '2026-04-17',
    category: 'template',
    usageCount: 18,
    gradient: 'from-fuchsia-900 to-purple-900',
    tags: ['story', 'instagram', 'template'],
  },
  {
    id: '10',
    name: 'Presentation Deck Q2',
    type: 'document',
    size: '8.9 MB',
    date: '2026-04-11',
    category: 'client',
    usageCount: 4,
    gradient: 'from-slate-800 to-zinc-900',
    tags: ['presentation', 'q2', 'business'],
  },
  {
    id: '11',
    name: 'Product Showcase Reel',
    type: 'video',
    size: '52.1 MB',
    date: '2026-04-09',
    category: 'social',
    platform: 'Instagram',
    usageCount: 9,
    gradient: 'from-orange-900 to-red-900',
    tags: ['instagram', 'reel', 'product'],
  },
  {
    id: '12',
    name: 'Brand Font Guide',
    type: 'document',
    size: '1.2 MB',
    date: '2026-04-14',
    category: 'brand',
    usageCount: 7,
    gradient: 'from-indigo-900 to-blue-900',
    tags: ['typography', 'fonts', 'brand'],
  },
  {
    id: '13',
    name: 'Twitter Banner Design',
    type: 'image',
    size: '1.5 MB',
    date: '2026-04-15',
    category: 'social',
    platform: 'X',
    usageCount: 4,
    gradient: 'from-gray-900 to-black',
    tags: ['twitter', 'x', 'banner'],
  },
  {
    id: '14',
    name: 'AI Generated Avatar',
    type: 'image',
    size: '0.6 MB',
    date: '2026-04-18',
    category: 'ai',
    usageCount: 1,
    gradient: 'from-cyan-900 to-blue-900',
    tags: ['ai', 'avatar', 'portrait'],
  },
  {
    id: '15',
    name: 'Carousel Template Pack',
    type: 'template',
    size: '6.8 MB',
    date: '2026-04-16',
    category: 'template',
    usageCount: 14,
    gradient: 'from-lime-900 to-green-900',
    tags: ['carousel', 'instagram', 'template'],
  },
  {
    id: '16',
    name: 'Client Case Study',
    type: 'document',
    size: '4.3 MB',
    date: '2026-04-12',
    category: 'client',
    usageCount: 5,
    gradient: 'from-teal-900 to-cyan-900',
    tags: ['case', 'study', 'client'],
  },
  {
    id: '17',
    name: 'YouTube Thumbnail Collection',
    type: 'image',
    size: '2.9 MB',
    date: '2026-04-17',
    category: 'social',
    platform: 'YouTube',
    usageCount: 11,
    gradient: 'from-red-900 to-rose-900',
    tags: ['youtube', 'thumbnail', 'video'],
  },
  {
    id: '18',
    name: 'Seasonal Campaign Mockup',
    type: 'image',
    size: '7.4 MB',
    date: '2026-04-13',
    category: 'brand',
    usageCount: 3,
    gradient: 'from-emerald-900 to-green-900',
    tags: ['campaign', 'seasonal', 'mockup'],
  },
  {
    id: '19',
    name: 'AI Generated Pattern',
    type: 'image',
    size: '2.1 MB',
    date: '2026-04-18',
    category: 'ai',
    usageCount: 2,
    gradient: 'from-orange-900 to-amber-900',
    tags: ['ai', 'pattern', 'texture'],
  },
  {
    id: '20',
    name: 'Email Template System',
    type: 'template',
    size: '4.5 MB',
    date: '2026-04-15',
    category: 'template',
    usageCount: 8,
    gradient: 'from-sky-900 to-cyan-900',
    tags: ['email', 'template', 'system'],
  },
  {
    id: '21',
    name: 'Client Invoice Format',
    type: 'document',
    size: '0.9 MB',
    date: '2026-04-14',
    category: 'client',
    usageCount: 2,
    gradient: 'from-purple-900 to-indigo-900',
    tags: ['invoice', 'client', 'format'],
  },
  {
    id: '22',
    name: 'Pinterest Pin Design',
    type: 'image',
    size: '3.3 MB',
    date: '2026-04-16',
    category: 'social',
    platform: 'Pinterest',
    usageCount: 7,
    gradient: 'from-red-900 to-pink-900',
    tags: ['pinterest', 'pin', 'design'],
  },
  {
    id: '23',
    name: 'Product Demo Video',
    type: 'video',
    size: '38.7 MB',
    date: '2026-04-11',
    category: 'brand',
    usageCount: 6,
    gradient: 'from-blue-900 to-indigo-900',
    tags: ['demo', 'product', 'video'],
  },
  {
    id: '24',
    name: 'AI Generated Illustration',
    type: 'image',
    size: '5.8 MB',
    date: '2026-04-18',
    category: 'ai',
    usageCount: 3,
    gradient: 'from-violet-900 to-fuchsia-900',
    tags: ['ai', 'illustration', 'art'],
  },
  {
    id: '25',
    name: 'Webinar Template',
    type: 'template',
    size: '5.1 MB',
    date: '2026-04-17',
    category: 'template',
    usageCount: 5,
    gradient: 'from-slate-900 to-gray-900',
    tags: ['webinar', 'template', 'event'],
  },
  {
    id: '26',
    name: 'Client Brand Book',
    type: 'document',
    size: '12.4 MB',
    date: '2026-04-10',
    category: 'client',
    usageCount: 2,
    gradient: 'from-amber-900 to-orange-900',
    tags: ['brand', 'book', 'guidelines'],
  },
  {
    id: '27',
    name: 'TikTok Trending Sound',
    type: 'video',
    size: '8.2 MB',
    date: '2026-04-18',
    category: 'social',
    platform: 'TikTok',
    usageCount: 13,
    gradient: 'from-pink-900 to-rose-900',
    tags: ['tiktok', 'sound', 'trending'],
  },
  {
    id: '28',
    name: 'AI Generated Logo Concept',
    type: 'image',
    size: '3.7 MB',
    date: '2026-04-18',
    category: 'ai',
    usageCount: 1,
    gradient: 'from-emerald-900 to-teal-900',
    tags: ['ai', 'logo', 'concept'],
  },
  {
    id: '29',
    name: 'Social Media Calendar',
    type: 'document',
    size: '2.3 MB',
    date: '2026-04-16',
    category: 'template',
    usageCount: 4,
    gradient: 'from-cyan-900 to-blue-900',
    tags: ['calendar', 'social', 'planning'],
  },
  {
    id: '30',
    name: 'Brand Color Variations',
    type: 'image',
    size: '1.9 MB',
    date: '2026-04-15',
    category: 'brand',
    usageCount: 9,
    gradient: 'from-purple-900 to-pink-900',
    tags: ['colors', 'brand', 'variations'],
  },
]

type FilterType = 'all' | 'image' | 'video' | 'document' | 'template' | 'ai-generated'
type SortOption = 'newest' | 'oldest' | 'name' | 'size'

export default function MediaPage() {
  const [activeType, setActiveType] = useState<FilterType>('all')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Filter and sort assets
  const filteredAssets = useMemo(() => {
    let assets = MOCK_ASSETS

    // Filter by type
    if (activeType !== 'all') {
      assets = assets.filter((asset) => asset.type === activeType)
    }

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase()
      assets = assets.filter(
        (asset) =>
          asset.name.toLowerCase().includes(searchLower) ||
          asset.tags.some((tag) => tag.toLowerCase().includes(searchLower))
      )
    }

    // Sort
    const sorted = [...assets]
    switch (sortBy) {
      case 'newest':
        sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        break
      case 'oldest':
        sorted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        break
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'size':
        sorted.sort(
          (a, b) =>
            parseFloat(b.size.split(' ')[0]) - parseFloat(a.size.split(' ')[0])
        )
        break
    }

    return sorted
  }, [activeType, search, sortBy])

  // Group assets by category
  const groupedAssets = useMemo(() => {
    if (activeType !== 'all') return []

    const groups: Record<string, MediaAsset[]> = {
      brand: [],
      social: [],
      client: [],
      template: [],
      ai: [],
    }

    filteredAssets.forEach((asset) => {
      groups[asset.category].push(asset)
    })

    return Object.entries(groups).filter(([, assets]) => assets.length > 0)
  }, [filteredAssets, activeType])

  // Count statistics
  const stats = {
    images: MOCK_ASSETS.filter((a) => a.type === 'image').length,
    videos: MOCK_ASSETS.filter((a) => a.type === 'video').length,
    documents: MOCK_ASSETS.filter((a) => a.type === 'document').length,
    aiGenerated: MOCK_ASSETS.filter((a) => a.type === 'ai-generated').length,
  }

  const getTypeIcon = (type: MediaAsset['type']) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="h-3 w-3" />
      case 'video':
        return <Video className="h-3 w-3" />
      case 'document':
        return <FileText className="h-3 w-3" />
      case 'template':
        return <Layers className="h-3 w-3" />
      case 'ai-generated':
        return <Sparkles className="h-3 w-3" />
    }
  }

  const getTypeLabel = (type: MediaAsset['type']) => {
    switch (type) {
      case 'image':
        return 'IMAGE'
      case 'video':
        return 'VIDEO'
      case 'document':
        return 'PDF'
      case 'template':
        return 'TMPL'
      case 'ai-generated':
        return 'AI'
    }
  }

  const getCategoryLabel = (category: MediaAsset['category']) => {
    switch (category) {
      case 'brand':
        return 'Brand Assets'
      case 'social':
        return 'Social Media'
      case 'client':
        return 'Client Work'
      case 'template':
        return 'Templates'
      case 'ai':
        return 'AI-Generated'
    }
  }

  const handleCopyLink = (assetId: string) => {
    setCopiedId(assetId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDelete = () => {
    setSelectedAsset(null)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/30">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <div className="rounded-lg bg-indigo-900/30 p-2">
                  <Library className="h-6 w-6 text-indigo-400" />
                </div>
                <h1 className="text-3xl font-semibold text-white">Media Library</h1>
              </div>
              <p className="text-sm text-zinc-400">
                Brand assets, social media files & templates
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowUpload(!showUpload)}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              >
                <Upload className="h-4 w-4" />
                Upload Assets
              </button>
              <a
                href="/social-hub/create"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/50 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                <Sparkles className="h-4 w-4" />
                Generate with AI
              </a>
            </div>
          </div>

          {/* Stats Row */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-zinc-900/50 px-3 py-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-xs text-zinc-300">
                <span className="font-semibold text-white">{stats.images}</span> images
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-zinc-900/50 px-3 py-1.5">
              <Video className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-xs text-zinc-300">
                <span className="font-semibold text-white">{stats.videos}</span> videos
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-zinc-900/50 px-3 py-1.5">
              <FileText className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-xs text-zinc-300">
                <span className="font-semibold text-white">{stats.documents}</span> documents
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-zinc-900/50 px-3 py-1.5">
              <Sparkles className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-xs text-zinc-300">
                <span className="font-semibold text-white">{stats.aiGenerated}</span>{' '}
                AI-generated
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Upload Zone */}
        {showUpload && (
          <div className="mb-8">
            <div className="rounded-2xl border-2 border-dashed border-zinc-700 bg-zinc-900/30 p-8">
              <div className="flex flex-col items-center gap-4">
                <div className="rounded-lg bg-indigo-900/20 p-4">
                  <Upload className="h-8 w-8 text-indigo-400" />
                </div>
                <div className="text-center">
                  <p className="text-base font-medium text-white">Drag & drop files here</p>
                  <p className="mt-1 text-sm text-zinc-400">or</p>
                </div>
                <button className="rounded-lg bg-indigo-600/10 px-4 py-2 text-sm font-medium text-indigo-400 transition-colors hover:bg-indigo-600/20">
                  Browse
                </button>
                <p className="text-xs text-zinc-500">
                  Supports JPG, PNG, MP4, GIF, PDF, SVG • Max 50MB per file
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="mb-8 space-y-4">
          {/* Search and View Toggle */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search assets by name or tag..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`rounded-lg p-2 transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-indigo-600/20 text-indigo-400'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
                }`}
              >
                <GridIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`rounded-lg p-2 transition-colors ${
                  viewMode === 'list'
                    ? 'bg-indigo-600/20 text-indigo-400'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
                }`}
              >
                <ListIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Type Filter Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-4">
            {(['all', 'image', 'video', 'document', 'template', 'ai-generated'] as FilterType[]).map((type) => (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeType === type
                    ? 'bg-indigo-600/20 text-indigo-400'
                    : 'text-zinc-400 hover:text-zinc-300'
                }`}
              >
                {type === 'all' && 'All'}
                {type === 'image' && 'Images'}
                {type === 'video' && 'Videos'}
                {type === 'document' && 'Documents'}
                {type === 'template' && 'Templates'}
                {type === 'ai-generated' && 'AI-Generated'}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs text-zinc-400">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-white transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name</option>
              <option value="size">Size</option>
            </select>
          </div>
        </div>

        {/* Assets Display */}
        {filteredAssets.length === 0 ? (
          // Empty State
          <div className="flex flex-col items-center justify-center py-16">
            <FolderOpen className="mb-4 h-12 w-12 text-zinc-600" />
            <h3 className="mb-2 text-lg font-medium text-white">No assets found</h3>
            <p className="mb-6 text-sm text-zinc-400">
              {search
                ? 'Try adjusting your search terms'
                : 'Upload your first asset to get started'}
            </p>
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            >
              <Upload className="h-4 w-4" />
              Upload Assets
            </button>
          </div>
        ) : activeType === 'all' && groupedAssets.length > 0 ? (
          // Grouped View by Category
          <div className="space-y-8">
            {groupedAssets.map(([category, assets]) => (
              <div key={category}>
                <h2 className="mb-4 text-sm font-semibold text-zinc-300">
                  {getCategoryLabel(category as MediaAsset['category'])}
                </h2>
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                      : 'space-y-2'
                  }
                >
                  {assets.map((asset) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      viewMode={viewMode}
                      isSelected={selectedAsset?.id === asset.id}
                      onSelect={setSelectedAsset}
                      getTypeIcon={getTypeIcon}
                      getTypeLabel={getTypeLabel}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Flat Grid/List View
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                : 'space-y-2'
            }
          >
            {filteredAssets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                viewMode={viewMode}
                isSelected={selectedAsset?.id === asset.id}
                onSelect={setSelectedAsset}
                getTypeIcon={getTypeIcon}
                getTypeLabel={getTypeLabel}
              />
            ))}
          </div>
        )}
      </div>

      {/* Asset Detail Panel */}
      {selectedAsset && (
        <AssetDetailPanel
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
          onCopyLink={() => handleCopyLink(selectedAsset.id)}
          onDelete={handleDelete}
          isCopied={copiedId === selectedAsset.id}
          getTypeIcon={getTypeIcon}
          getTypeLabel={getTypeLabel}
        />
      )}
    </div>
  )
}

interface AssetCardProps {
  asset: MediaAsset
  viewMode: 'grid' | 'list'
  isSelected: boolean
  onSelect: (asset: MediaAsset) => void
  getTypeIcon: (type: MediaAsset['type']) => React.ReactNode
  getTypeLabel: (type: MediaAsset['type']) => string
}

function AssetCard({
  asset,
  viewMode,
  isSelected,
  onSelect,
  getTypeIcon,
  getTypeLabel,
}: AssetCardProps) {
  if (viewMode === 'list') {
    return (
      <button
        onClick={() => onSelect(asset)}
        className={`flex w-full items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-left transition-all hover:border-zinc-700 hover:bg-zinc-900 ${
          isSelected ? 'border-indigo-500 bg-indigo-900/20' : ''
        }`}
      >
        {/* Thumbnail */}
        <div
          className={`h-16 w-16 flex-shrink-0 rounded-lg bg-gradient-to-br ${asset.gradient}`}
        />
        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-white">{asset.name}</p>
          <p className="text-xs text-zinc-500">{asset.size}</p>
        </div>
        {/* Type Badge */}
        <div className="flex-shrink-0">
          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
            {getTypeIcon(asset.type)}
            {getTypeLabel(asset.type)}
          </span>
        </div>
      </button>
    )
  }

  return (
    <button
      onClick={() => onSelect(asset)}
      className={`group rounded-xl border border-zinc-800 bg-zinc-900/50 transition-all hover:border-zinc-700 hover:bg-zinc-900 ${
        isSelected ? 'border-indigo-500 bg-indigo-900/20' : ''
      }`}
    >
      {/* Thumbnail */}
      <div className={`relative aspect-square overflow-hidden rounded-t-xl bg-gradient-to-br ${asset.gradient}`}>
        {/* Type Badge */}
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/40 px-2 py-1 backdrop-blur-sm">
          {getTypeIcon(asset.type)}
          <span className="text-xs font-semibold text-white">{getTypeLabel(asset.type)}</span>
        </div>

        {/* Hover Overlay */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 backdrop-blur-sm">
          <button className="rounded-lg bg-white/10 p-2 text-white backdrop-blur transition-colors hover:bg-white/20">
            <Eye className="h-4 w-4" />
          </button>
          <button className="rounded-lg bg-white/10 p-2 text-white backdrop-blur transition-colors hover:bg-white/20">
            <DownloadCloud className="h-4 w-4" />
          </button>
          <button className="rounded-lg bg-white/10 p-2 text-white backdrop-blur transition-colors hover:bg-white/20">
            <Layers className="h-4 w-4" />
          </button>
        </div>

        {/* Platform Tag */}
        {asset.platform && (
          <div className="absolute bottom-2 right-2 rounded-md bg-indigo-600/80 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {asset.platform}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="space-y-2 p-3">
        <p className="truncate text-sm font-medium text-white">{asset.name}</p>
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500">{asset.size}</p>
          <p className="text-xs text-zinc-500">
            {new Date(asset.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>
    </button>
  )
}

interface AssetDetailPanelProps {
  asset: MediaAsset
  onClose: () => void
  onCopyLink: () => void
  onDelete: () => void
  isCopied: boolean
  getTypeIcon: (type: MediaAsset['type']) => React.ReactNode
  getTypeLabel: (type: MediaAsset['type']) => string
}

function AssetDetailPanel({
  asset,
  onClose,
  onCopyLink,
  onDelete,
  isCopied,
  getTypeIcon,
  getTypeLabel,
}: AssetDetailPanelProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 h-screen w-full overflow-y-auto border-l border-zinc-800 bg-zinc-900/95 backdrop-blur sm:w-96">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/95 px-6 py-4 backdrop-blur">
          <h2 className="text-lg font-semibold text-white">Asset Details</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* Preview */}
          <div
            className={`aspect-square rounded-xl bg-gradient-to-br ${asset.gradient}`}
          />

          {/* Details */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium uppercase text-zinc-500">Name</label>
              <p className="mt-1 text-sm text-white">{asset.name}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium uppercase text-zinc-500">Type</label>
                <div className="mt-1 flex items-center gap-2">
                  {getTypeIcon(asset.type)}
                  <span className="text-sm text-white">{getTypeLabel(asset.type)}</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-zinc-500">Size</label>
                <p className="mt-1 text-sm text-white">{asset.size}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium uppercase text-zinc-500">
                  Uploaded
                </label>
                <p className="mt-1 text-sm text-white">
                  {new Date(asset.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-zinc-500">
                  Usage Count
                </label>
                <p className="mt-1 text-sm text-white">{asset.usageCount} uses</p>
              </div>
            </div>

            {asset.platform && (
              <div>
                <label className="text-xs font-medium uppercase text-zinc-500">
                  Platform
                </label>
                <p className="mt-1 text-sm text-white">{asset.platform}</p>
              </div>
            )}

            {asset.tags.length > 0 && (
              <div>
                <label className="text-xs font-medium uppercase text-zinc-500">Tags</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {asset.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex rounded-md bg-indigo-600/20 px-2.5 py-1 text-xs text-indigo-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {asset.usageCount > 0 && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <p className="text-xs font-medium text-white">
                  Used in {asset.usageCount} post{asset.usageCount !== 1 ? 's' : ''}
                </p>
                <button className="mt-2 flex items-center gap-1 text-xs text-indigo-400 transition-colors hover:text-indigo-300">
                  View usage
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2 border-t border-zinc-800 pt-6">
            <button className="flex w-full items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white">
              <DownloadCloud className="h-4 w-4" />
              Download
            </button>
            <button
              onClick={() => {
                onCopyLink()
              }}
              className="flex w-full items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
            >
              {isCopied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Link
                </>
              )}
            </button>
            <button
              onClick={() => {
                onDelete()
              }}
              className="flex w-full items-center gap-3 rounded-lg border border-red-900/50 bg-red-900/10 px-4 py-2.5 text-sm text-red-400 transition-colors hover:bg-red-900/20"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
