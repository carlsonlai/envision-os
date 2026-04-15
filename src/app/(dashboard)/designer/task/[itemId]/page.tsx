'use client'

import { use, useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Upload,
  Clock,
  RotateCcw,
  Play,
  Pause,
  CheckCircle2,
  Flag,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import type { TimelineEvent } from '@/components/project/RevisionTimeline'

const AnnotationViewer = dynamic(
  () => import('@/components/annotation/AnnotationViewer'),
  { ssr: false }
)
const RevisionTimeline = dynamic(
  () => import('@/components/project/RevisionTimeline'),
  { ssr: false }
)

type ItemStatus = 'PENDING' | 'IN_PROGRESS' | 'WIP_UPLOADED' | 'QC_REVIEW' | 'APPROVED' | 'DELIVERED' | 'FA_SIGNED'
type ItemType = 'BANNER' | 'BROCHURE' | 'LOGO' | 'SOCIAL' | 'PRINT' | 'THREE_D' | 'VIDEO' | 'OTHER'

interface FileVersion {
  id: string
  version: number
  filename: string
  url: string
  fileSize: number | null
  createdAt: string
  uploadedBy?: { name: string }
}

interface Revision {
  id: string
  revisionNumber: number
  feedback: string
  annotationData: unknown
  status: string
  requestedBy: { id: string; name: string; role: string }
  createdAt: string
}

interface DeliverableItem {
  id: string
  itemType: ItemType
  description: string | null
  quantity: number
  status: ItemStatus
  revisionCount: number
  revisionLimit: number
  estimatedMinutes: number | null
  deadline: string | null
  projectId: string
  fileVersions?: FileVersion[]
  revisions?: Revision[]
}

interface Project {
  id: string
  code: string
  brief?: { specialInstructions: string | null; styleNotes: string | null; packageType: string | null; priority: string }
}

const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  BANNER: 'Banner',
  BROCHURE: 'Brochure',
  LOGO: 'Logo',
  SOCIAL: 'Social Media',
  PRINT: 'Print',
  THREE_D: '3D',
  VIDEO: 'Video',
  OTHER: 'Other',
}

const PRIORITY_COLORS: Record<string, string> = {
  RUSH: 'text-red-400 bg-red-500/10 border-red-500/20',
  HIGH: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  NORMAL: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  LOW: 'text-zinc-400 bg-zinc-800/60 border-zinc-700/40',
}

function TimeTracker({ estimatedMinutes }: { estimatedMinutes: number | null }) {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function toggleTimer() {
    if (running) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
      setRunning(false)
    } else {
      intervalRef.current = setInterval(() => {
        setElapsed((e) => e + 1)
      }, 1000)
      setRunning(true)
    }
  }

  function formatTime(secs: number) {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return `${h > 0 ? `${h}h ` : ''}${m}m ${s}s`
  }

  const estimatedSecs = (estimatedMinutes ?? 0) * 60
  const percent = estimatedSecs > 0 ? Math.min(100, (elapsed / estimatedSecs) * 100) : 0

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-zinc-500" />
          <span className="text-sm font-semibold text-zinc-200">Time Tracker</span>
        </div>
        <span className={`text-sm font-mono font-bold ${running ? 'text-[#818cf8]' : 'text-zinc-400'}`}>
          {formatTime(elapsed)}
        </span>
      </div>

      {estimatedMinutes && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-600">
            <span>Estimated: {estimatedMinutes}min</span>
            <span>{Math.round(percent)}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${percent >= 100 ? 'bg-red-500' : 'bg-[#6366f1]'}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button type="button"
          onClick={toggleTimer}
          className={`cursor-pointer flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            running
              ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20'
              : 'text-blue-400 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20'
          }`}
        >
          {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {running ? 'Pause' : 'Start Timer'}
        </button>
        {!running && elapsed > 0 && (
          <button type="button"
            onClick={() => setElapsed(0)}
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 border border-zinc-800 transition-all"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  )
}

export default function DesignerTaskPage({
  params,
}: {
  params: Promise<{ itemId: string }>
}) {
  const { itemId } = use(params)
  const [item, setItem] = useState<DeliverableItem | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      try {
        // Load all projects to find this item
        const projectsRes = await fetch('/api/projects')
        const projectsData = await projectsRes.json()
        const projects: Project[] = projectsData.data ?? []

        let foundItem: DeliverableItem | null = null
        let foundProject: Project | null = null

        for (const proj of projects) {
          const itemsRes = await fetch(`/api/projects/${proj.id}/items`)
          const itemsData = await itemsRes.json()
          const items: DeliverableItem[] = itemsData.data ?? []
          const match = items.find((i) => i.id === itemId)
          if (match) {
            foundItem = match
            foundProject = proj
            break
          }
        }

        if (!foundItem || !foundProject) {
          throw new Error('Task not found')
        }

        // Load revisions
        const revisionsRes = await fetch(`/api/projects/${foundProject.id}/items/${itemId}/revisions`)
        const revisionsData = await revisionsRes.json()

        setItem({ ...foundItem, revisions: revisionsData.data ?? [] })
        setProject(foundProject)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load task')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [itemId])

  async function handleUpload() {
    if (!uploadFile || !item || !project) return

    setIsUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('stage', 'WIP')

      const res = await fetch(`/api/projects/${project.id}/items/${item.id}/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Upload failed')
      }

      setUploadSuccess(true)
      setUploadFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''

      // Refresh item
      const itemsRes = await fetch(`/api/projects/${project.id}/items`)
      const itemsData = await itemsRes.json()
      const refreshed = (itemsData.data ?? []).find((i: DeliverableItem) => i.id === itemId)
      if (refreshed) {
        const revisionsRes = await fetch(`/api/projects/${project.id}/items/${itemId}/revisions`)
        const revisionsData = await revisionsRes.json()
        setItem({ ...refreshed, revisions: revisionsData.data ?? [] })
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  if (error || !item || !project) {
    return (
      <div className="text-center py-16">
        <p className="text-zinc-500 text-sm">{error ?? 'Task not found'}</p>
        <Link href="/designer" className="mt-4 inline-block text-[#818cf8] hover:underline text-sm">
          Back to My Queue
        </Link>
      </div>
    )
  }

  const latestRevision = item.revisions?.[item.revisions.length - 1] ?? null
  const latestFile = item.fileVersions?.[0] ?? null
  const hasAnnotations = latestRevision?.annotationData && typeof latestRevision.annotationData === 'object'
  const annotationRaw = hasAnnotations ? (latestRevision.annotationData as { objects?: object[]; comments?: { id: string; x: number; y: number; width: number; height: number; text: string; authorId: string; authorName: string; createdAt: string; resolved: boolean }[] } | null) : null
  const annotationData = annotationRaw ? { objects: annotationRaw.objects ?? [], comments: annotationRaw.comments ?? [] } : null

  const timelineEvents: TimelineEvent[] = [
    ...(item.fileVersions ?? []).slice().reverse().map((fv) => ({
      id: `upload-${fv.id}`,
      type: 'upload' as const,
      label: `File uploaded — ${fv.filename}`,
      who: fv.uploadedBy?.name ?? 'You',
      timestamp: fv.createdAt,
      versionUrl: fv.url,
      versionLabel: `v${fv.version}`,
    })),
    ...(item.revisions ?? []).map((rev) => ({
      id: `rev-${rev.id}`,
      type: 'revision' as const,
      label: `Revision ${rev.revisionNumber} requested`,
      detail: rev.feedback.length > 80 ? `${rev.feedback.slice(0, 80)}...` : rev.feedback,
      timestamp: rev.createdAt,
    })),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  const isOverdue = item.deadline && new Date(item.deadline) < new Date()
  const priority = project.brief?.priority ?? 'NORMAL'

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Back */}
      <Link
        href="/designer"
        className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-200 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        My Queue
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-semibold text-[#818cf8]">{project.code}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.NORMAL}`}>
              {priority}
            </span>
          </div>
          <h1 className="text-xl font-semibold text-zinc-100">
            {ITEM_TYPE_LABELS[item.itemType]}
            {item.quantity > 1 && <span className="ml-2 text-zinc-400 text-base">×{item.quantity}</span>}
          </h1>
          {item.description && (
            <p className="text-sm text-zinc-500 mt-0.5">{item.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-zinc-800/60 border border-zinc-700/60 px-3 py-1.5 text-xs text-zinc-400">
            <RotateCcw className="h-3 w-3" />
            {item.revisionCount}/{item.revisionLimit} revisions
          </div>
          {item.deadline && (
            <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs border ${isOverdue ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-zinc-400 bg-zinc-800/60 border-zinc-700/60'}`}>
              <Clock className="h-3 w-3" />
              {isOverdue ? 'Overdue' : new Date(item.deadline).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left column: Brief + Feedback */}
        <div className="lg:col-span-2 space-y-5">
          {/* Brief */}
          {project.brief && (
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5">
              <h2 className="text-sm font-semibold text-zinc-200 mb-4">Brief Notes</h2>
              <div className="space-y-3">
                {project.brief.packageType && (
                  <div>
                    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Package Type</p>
                    <p className="text-sm text-zinc-300">{project.brief.packageType}</p>
                  </div>
                )}
                {project.brief.styleNotes && (
                  <div>
                    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Style Notes</p>
                    <p className="text-sm text-zinc-300 leading-relaxed">{project.brief.styleNotes}</p>
                  </div>
                )}
                {project.brief.specialInstructions && (
                  <div>
                    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Special Instructions</p>
                    <p className="text-sm text-zinc-300 leading-relaxed">{project.brief.specialInstructions}</p>
                  </div>
                )}
                {!project.brief.packageType && !project.brief.styleNotes && !project.brief.specialInstructions && (
                  <p className="text-xs text-zinc-600 italic">No brief notes added yet</p>
                )}
              </div>
            </div>
          )}

          {/* Latest revision feedback */}
          {latestRevision && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <h2 className="text-sm font-semibold text-zinc-200">
                  Revision {latestRevision.revisionNumber} Feedback
                </h2>
              </div>

              {/* Annotated image */}
              {latestFile && annotationData && (
                <div className="mb-4">
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                    Annotated Version
                  </p>
                  <AnnotationViewer
                    imageUrl={latestFile.url}
                    annotations={annotationData}
                    className="w-full max-w-lg"
                  />
                </div>
              )}

              {/* Feedback text */}
              <div className="rounded-lg bg-zinc-900/60 border border-zinc-800 p-4">
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-2">
                  Account Manager Note
                </p>
                <p className="text-sm text-zinc-200 leading-relaxed">{latestRevision.feedback}</p>
              </div>

              <p className="text-[10px] text-zinc-600 mt-2">
                Submitted {new Date(latestRevision.createdAt).toLocaleString('en-MY', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          )}

          {/* Upload area */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-200">Upload WIP File</h2>

            <div
              className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
                uploadFile ? 'border-[#6366f1]/60 bg-[#6366f1]/5' : 'border-zinc-700 hover:border-zinc-600'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf,.ai,.psd,.eps,.svg"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) {
                    setUploadFile(f)
                    setUploadSuccess(false)
                    setUploadError(null)
                  }
                }}
              />
              <ImageIcon className={`h-8 w-8 mx-auto mb-3 ${uploadFile ? 'text-[#818cf8]' : 'text-zinc-600'}`} />
              {uploadFile ? (
                <div>
                  <p className="text-sm font-medium text-[#818cf8]">{uploadFile.name}</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-zinc-400">Click to select file</p>
                  <p className="text-xs text-zinc-600 mt-1">JPG, PNG, PDF, AI, PSD, EPS, SVG</p>
                </div>
              )}
            </div>

            {uploadSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-sm text-emerald-400">File uploaded successfully</span>
              </div>
            )}

            {uploadError && (
              <p className="text-xs text-red-400">{uploadError}</p>
            )}

            <div className="flex gap-2">
              <button type="button"
                onClick={handleUpload}
                disabled={!uploadFile || isUploading}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium bg-[#6366f1] text-white hover:bg-[#5558e3] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {isUploading ? 'Uploading...' : 'Upload WIP'}
              </button>

              <button type="button"
                onClick={() => alert('Flag feature: Please message your Creative Director with the issue details.')}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 hover:border-red-500/40 transition-all"
              >
                <Flag className="h-4 w-4" />
                Flag Issue
              </button>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Time tracker */}
          <TimeTracker estimatedMinutes={item.estimatedMinutes} />

          {/* Revision timeline */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
            <h3 className="text-sm font-semibold text-zinc-200 mb-4">Activity</h3>
            <RevisionTimeline
              events={timelineEvents}
              revisionCount={item.revisionCount}
              revisionLimit={item.revisionLimit}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
