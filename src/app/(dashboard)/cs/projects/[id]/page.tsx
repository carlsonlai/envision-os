'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  DollarSign,
  Clock,
  AlertTriangle,
  MessageSquare,
  CheckCircle2,
  Upload,
  RotateCcw,
  Flag,
  FileText,
  Send,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
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
const QCGate = dynamic(
  () => import('@/components/project/QCGate'),
  { ssr: false }
)
const FileVersionGallery = dynamic(
  () => import('@/components/project/FileVersionGallery'),
  { ssr: false }
)

type ProjectStatus = 'PROJECTED' | 'ONGOING' | 'COMPLETED' | 'BILLED' | 'PAID'
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
  deadline: string | null
  fileVersions: FileVersion[]
  revisions: Revision[]
}

interface Project {
  id: string
  code: string
  status: ProjectStatus
  quotedAmount: number
  billedAmount: number
  paidAmount: number
  deadline: string | null
  client?: { companyName: string; contactPerson: string; email: string }
  deliverableItems: DeliverableItem[]
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

const STATUS_COLORS: Record<ItemStatus, string> = {
  PENDING: 'text-zinc-400 bg-zinc-800/60',
  IN_PROGRESS: 'text-blue-400 bg-blue-500/10',
  WIP_UPLOADED: 'text-violet-400 bg-violet-500/10',
  QC_REVIEW: 'text-amber-400 bg-amber-500/10',
  APPROVED: 'text-teal-400 bg-teal-500/10',
  DELIVERED: 'text-emerald-400 bg-emerald-500/10',
  FA_SIGNED: 'text-green-400 bg-green-500/10',
}

const STATUS_LABELS: Record<ItemStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  WIP_UPLOADED: 'WIP Uploaded',
  QC_REVIEW: 'QC Review',
  APPROVED: 'Approved',
  DELIVERED: 'Delivered',
  FA_SIGNED: 'FA Signed',
}

function formatRM(amount: number) {
  return `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 0 })}`
}

function buildTimelineEvents(item: DeliverableItem): TimelineEvent[] {
  const events: TimelineEvent[] = []

  item.fileVersions.slice().reverse().forEach((fv) => {
    events.push({
      id: `upload-${fv.id}`,
      type: 'upload',
      label: `File uploaded — ${fv.filename}`,
      who: fv.uploadedBy?.name,
      timestamp: fv.createdAt,
      versionUrl: fv.url,
      versionLabel: `v${fv.version}`,
    })
  })

  item.revisions.forEach((rev) => {
    const isLimitHit = rev.status === 'REJECTED' || (rev.revisionNumber > item.revisionLimit)
    events.push({
      id: `rev-${rev.id}`,
      type: isLimitHit ? 'limit_hit' : 'revision',
      label: `Revision ${rev.revisionNumber} requested`,
      detail: rev.feedback.length > 100 ? `${rev.feedback.slice(0, 100)}...` : rev.feedback,
      who: rev.requestedBy.name,
      timestamp: rev.createdAt,
    })
  })

  if (item.status === 'DELIVERED') {
    events.push({
      id: `delivered-${item.id}`,
      type: 'delivered',
      label: 'Delivered to client',
      timestamp: new Date().toISOString(),
    })
  }

  return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

function ItemPanel({ item, projectId, onRefresh }: { item: DeliverableItem; projectId: string; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [csNote, setCsNote] = useState('')
  const [isApproving, setIsApproving] = useState(false)
  const [isGeneratingFA, setIsGeneratingFA] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showQC, setShowQC] = useState(false)

  const latestRevision = item.revisions[item.revisions.length - 1] ?? null
  const latestFile = item.fileVersions[0] ?? null
  const hasClientFeedback = latestRevision && latestRevision.annotationData
  const annotationRaw = hasClientFeedback ? (latestRevision.annotationData as { objects?: object[]; comments?: { id: string; x: number; y: number; width: number; height: number; text: string; authorId: string; authorName: string; createdAt: string; resolved: boolean }[] } | null) : null
  const annotationData = annotationRaw ? { objects: annotationRaw.objects ?? [], comments: annotationRaw.comments ?? [] } : null

  const canSendToClient = item.status === 'APPROVED'
  const canQC = item.status === 'WIP_UPLOADED'
  const timelineEvents = buildTimelineEvents(item)

  async function handleSendToClient() {
    setIsApproving(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/items/${item.id}/approve`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to approve item')
      }
      onRefresh()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsApproving(false)
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800/60 overflow-hidden">
      {/* Item header */}
      <div className="px-4 py-3 bg-zinc-900/60 border-b border-zinc-800/60 flex items-center gap-3">
        <div className="flex-1 flex items-center gap-3">
          <span className="text-sm font-semibold text-zinc-200">
            {ITEM_TYPE_LABELS[item.itemType]}
            {item.quantity > 1 && <span className="text-zinc-500 ml-1">×{item.quantity}</span>}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[item.status]}`}>
            {STATUS_LABELS[item.status]}
          </span>
          <span className="flex items-center gap-1 text-xs text-zinc-500">
            <RotateCcw className="h-3 w-3" />
            {item.revisionCount}/{item.revisionLimit}
          </span>
        </div>
        <button type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Side-by-side alignment panel */}
      <div className="grid grid-cols-2 gap-0 border-b border-zinc-800/60">
        {/* CLIENT ASKED */}
        <div className="border-r border-zinc-800/60 p-4">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">Client Asked</p>
          {latestRevision ? (
            <div className="space-y-3">
              {latestFile && annotationData ? (
                <AnnotationViewer
                  imageUrl={latestFile.url}
                  annotations={annotationData}
                  className="w-full"
                />
              ) : (
                <div className="rounded-lg bg-zinc-800/30 border border-zinc-800 p-3 text-xs text-zinc-500">
                  No annotations — text feedback only
                </div>
              )}
              <div className="rounded-lg bg-zinc-800/30 border border-zinc-800 p-3">
                <p className="text-xs text-zinc-400 leading-relaxed">{latestRevision.feedback}</p>
                <p className="text-[10px] text-zinc-600 mt-2">
                  Revision {latestRevision.revisionNumber} —{' '}
                  {new Date(latestRevision.createdAt).toLocaleDateString('en-MY', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-zinc-800">
              <p className="text-xs text-zinc-700">No revision feedback yet</p>
            </div>
          )}
        </div>

        {/* DESIGNER DELIVERED */}
        <div className="p-4">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">Designer Delivered</p>
          {latestFile ? (
            <div className="space-y-2">
              {/\.(jpg|jpeg|png|gif|webp|svg|avif)$/i.test(latestFile.filename) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={latestFile.url}
                  alt={latestFile.filename}
                  className="w-full h-auto rounded-lg border border-zinc-800 max-h-48 object-contain"
                />
              ) : (
                <div className="flex items-center justify-center h-32 rounded-lg border border-zinc-800 bg-zinc-800/30">
                  <span className="text-3xl">📄</span>
                </div>
              )}
              <p className="text-xs text-zinc-500 truncate">{latestFile.filename}</p>
              <p className="text-[10px] text-zinc-600">v{latestFile.version}</p>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-zinc-800">
              <p className="text-xs text-zinc-700">No file uploaded yet</p>
            </div>
          )}
        </div>
      </div>

      {/* CS Note field */}
      <div className="p-4 border-b border-zinc-800/60">
        <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
          CS Translation Note (for design brief)
        </label>
        <textarea
          value={csNote}
          onChange={(e) => setCsNote(e.target.value)}
          placeholder="Translate client feedback into clear instructions for the designer..."
          className="w-full rounded-lg bg-zinc-800/40 border border-zinc-700/60 text-xs text-zinc-300 placeholder-zinc-600 p-2.5 resize-none focus:outline-none focus:border-[#6366f1]/60 transition-colors"
          rows={2}
        />
      </div>

      {/* Action buttons */}
      <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
        {canQC && latestFile && (
          <button type="button"
            onClick={() => setShowQC((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-all"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {showQC ? 'Hide QC' : 'Run QC Check'}
          </button>
        )}

        {canSendToClient && (
          <button type="button"
            onClick={handleSendToClient}
            disabled={isApproving}
            className="cursor-pointer flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all disabled:opacity-50"
          >
            {isApproving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Pass QC &amp; Send to Client
          </button>
        )}

        {!canSendToClient && !canQC && (
          <span className="text-xs text-zinc-600 italic">
            No actions available for current status
          </span>
        )}

        {actionError && (
          <span className="text-xs text-red-400">{actionError}</span>
        )}
      </div>

      {/* QC Gate */}
      {showQC && latestFile && (
        <div className="px-4 pb-4">
          <QCGate
            itemId={item.id}
            projectId={projectId}
            fileVersionId={latestFile.id}
            onResult={(passed) => {
              setShowQC(false)
              if (passed) onRefresh()
            }}
          />
        </div>
      )}

      {/* Expanded section */}
      {expanded && (
        <div className="p-4 border-t border-zinc-800/60 space-y-5">
          {/* File gallery */}
          <div>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">Version History</p>
            <FileVersionGallery
              versions={item.fileVersions.map((fv, idx) => ({
                ...fv,
                isApproved: item.status === 'FA_SIGNED' && idx === 0,
                isCurrent: idx === 0,
                uploadedBy: fv.uploadedBy,
              }))}
            />
          </div>

          {/* Revision timeline */}
          <div>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">Activity Timeline</p>
            <RevisionTimeline
              events={timelineEvents}
              revisionCount={item.revisionCount}
              revisionLimit={item.revisionLimit}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function CSProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isGeneratingFA, setIsGeneratingFA] = useState(false)
  const [faError, setFaError] = useState<string | null>(null)

  async function loadProject() {
    try {
      const [projectRes, itemsRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/projects/${id}/items`),
      ])

      const projectData = await projectRes.json()
      const itemsData = await itemsRes.json()

      const proj = projectData.data
      if (proj) {
        proj.deliverableItems = itemsData.data ?? []
        // Load revisions and file versions for each item
        const enrichedItems = await Promise.all(
          (proj.deliverableItems ?? []).map(async (item: DeliverableItem) => {
            const [revisionsRes] = await Promise.all([
              fetch(`/api/projects/${id}/items/${item.id}/revisions`),
            ])
            const revisionsData = await revisionsRes.json()
            return {
              ...item,
              revisions: revisionsData.data ?? [],
            }
          })
        )
        proj.deliverableItems = enrichedItems
      }
      setProject(proj)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProject()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleGenerateFA() {
    setIsGeneratingFA(true)
    setFaError(null)
    try {
      const res = await fetch(`/api/projects/${id}/fa`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to generate FA')
      }
      alert('FA PDF generated successfully!')
    } catch (err) {
      setFaError(err instanceof Error ? err.message : 'Failed to generate FA')
    } finally {
      setIsGeneratingFA(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="text-center py-16">
        <p className="text-zinc-500 text-sm">{error ?? 'Project not found'}</p>
        <Link href="/cs" className="mt-4 inline-block text-[#818cf8] hover:underline text-sm">
          Back to CS
        </Link>
      </div>
    )
  }

  const balance = project.quotedAmount - project.billedAmount
  const allDelivered =
    project.deliverableItems.length > 0 &&
    project.deliverableItems.every((i) => i.status === 'DELIVERED' || i.status === 'FA_SIGNED')

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Back */}
      <Link
        href="/cs"
        className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-200 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to CS
      </Link>

      {/* Project header */}
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-mono font-semibold text-[#818cf8]">{project.code}</span>
              <span className="rounded-full bg-zinc-800/60 px-2 py-0.5 text-[10px] text-zinc-400">
                {project.status}
              </span>
            </div>
            {project.client && (
              <h1 className="text-lg font-semibold text-zinc-100">{project.client.companyName}</h1>
            )}
            <p className="text-xs text-zinc-500 mt-0.5">
              {project.client?.contactPerson} &middot; {project.client?.email}
            </p>
            {project.deadline && (
              <p className="flex items-center gap-1 text-xs text-zinc-500 mt-1">
                <Clock className="h-3 w-3" />
                Deadline:{' '}
                {new Date(project.deadline).toLocaleDateString('en-MY', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            {allDelivered && (
              <button type="button"
                onClick={handleGenerateFA}
                disabled={isGeneratingFA}
                className="cursor-pointer flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 transition-all disabled:opacity-50"
              >
                {isGeneratingFA ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                Generate FA PDF
              </button>
            )}
            <button type="button" className="cursor-pointer flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-700/50 transition-all">
              <MessageSquare className="h-3.5 w-3.5" />
              Chat with Client
            </button>
            <button type="button" className="cursor-pointer flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-700/50 transition-all">
              <DollarSign className="h-3.5 w-3.5" />
              Generate Invoice
            </button>
            <button type="button" className="cursor-pointer flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 transition-all">
              <Flag className="h-3.5 w-3.5" />
              Flag to Carlson
            </button>
          </div>
        </div>

        {faError && (
          <p className="mt-3 text-xs text-red-400">{faError}</p>
        )}
      </div>

      {/* Billing bar */}
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-5 py-4">
        <div className="flex items-center gap-6 flex-wrap text-sm">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Quoted</p>
            <p className="font-semibold text-zinc-200 mt-0.5">{formatRM(project.quotedAmount)}</p>
          </div>
          <div className="w-px h-8 bg-zinc-700" />
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Billed</p>
            <p className="font-semibold text-zinc-200 mt-0.5">{formatRM(project.billedAmount)}</p>
          </div>
          <div className="w-px h-8 bg-zinc-700" />
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Balance</p>
            <p className={`font-semibold mt-0.5 ${balance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {formatRM(balance)}
            </p>
          </div>
          <div className="w-px h-8 bg-zinc-700" />
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Status</p>
            <p className="font-semibold text-zinc-200 mt-0.5">{project.status}</p>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300">
          Deliverable Items ({project.deliverableItems.length})
        </h2>
        {project.deliverableItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-12 text-center">
            <p className="text-xs text-zinc-700">No items added to this project</p>
          </div>
        ) : (
          project.deliverableItems.map((item) => (
            <ItemPanel
              key={item.id}
              item={item}
              projectId={project.id}
              onRefresh={loadProject}
            />
          ))
        )}
      </div>
    </div>
  )
}
