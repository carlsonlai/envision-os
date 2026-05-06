'use client'

import { use, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  DollarSign,
  Clock,
  MessageSquare,
  CheckCircle2,
  RotateCcw,
  Flag,
  FileText,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  UserCheck,
  ArrowRight,
  AlertTriangle,
  Check,
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

/* ───────── Types ───────── */

type ProjectStatus  = 'PROJECTED' | 'ONGOING' | 'COMPLETED' | 'BILLED' | 'PAID'
type ItemStatus     = 'PENDING' | 'IN_PROGRESS' | 'WIP_UPLOADED' | 'QC_REVIEW' | 'APPROVED' | 'DELIVERED' | 'FA_SIGNED'
type ItemType       = 'BANNER' | 'BROCHURE' | 'LOGO' | 'SOCIAL' | 'PRINT' | 'THREE_D' | 'VIDEO' | 'OTHER'
type BriefStage     = 'CS_DRAFTING' | 'CD_REVIEW' | 'AD_DIRECTING' | 'DESIGNER_ASSIGNED' | 'DONE'

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

interface Brief {
  briefStage: BriefStage | null
  completedByCSAt: string | null
  sentToCDAt: string | null
  cdReceivedAt: string | null
  sentToADAt: string | null
  adReceivedAt: string | null
  designerAssignedAt: string | null
}

interface CDUser {
  id: string
  name: string
  role: string
}

interface AssignmentData {
  project: {
    assignedCDId: string | null
    assignedADId: string | null
    assignedCD: { id: string; name: string; role: string } | null
    assignedAD: { id: string; name: string; role: string } | null
  }
  brief: Brief | null
  cdUsers: CDUser[]
}

/* ───────── Constants ───────── */

const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  BANNER: 'Banner', BROCHURE: 'Brochure', LOGO: 'Logo', SOCIAL: 'Social Media',
  PRINT: 'Print',   THREE_D: '3D',        VIDEO: 'Video', OTHER: 'Other',
}

const STATUS_COLORS: Record<ItemStatus, string> = {
  PENDING:        'text-zinc-400 bg-zinc-800/60',
  IN_PROGRESS:    'text-blue-400 bg-blue-500/10',
  WIP_UPLOADED:   'text-violet-400 bg-violet-500/10',
  QC_REVIEW:      'text-amber-400 bg-amber-500/10',
  APPROVED:       'text-teal-400 bg-teal-500/10',
  DELIVERED:      'text-emerald-400 bg-emerald-500/10',
  FA_SIGNED:      'text-green-400 bg-green-500/10',
}

const STATUS_LABELS: Record<ItemStatus, string> = {
  PENDING: 'Pending', IN_PROGRESS: 'In Progress', WIP_UPLOADED: 'WIP Uploaded',
  QC_REVIEW: 'QC Review', APPROVED: 'Approved', DELIVERED: 'Delivered', FA_SIGNED: 'FA Signed',
}

const BRIEF_STAGE_LABELS: Record<BriefStage, string> = {
  CS_DRAFTING:       'CS Drafting',
  CD_REVIEW:         'CD Review',
  AD_DIRECTING:      'AD Directing',
  DESIGNER_ASSIGNED: 'Designer Assigned',
  DONE:              'Done',
}

const BRIEF_STAGE_ORDER: BriefStage[] = [
  'CS_DRAFTING', 'CD_REVIEW', 'AD_DIRECTING', 'DESIGNER_ASSIGNED', 'DONE',
]

/* ───────── Helpers ───────── */

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
    const isLimitHit = rev.status === 'REJECTED' || rev.revisionNumber > item.revisionLimit
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

  return events.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
}

/* ───────── BriefChainPanel ───────── */

function BriefChainPanel({
  projectId,
  assignment,
  onHandoffComplete,
}: {
  projectId: string
  assignment: AssignmentData
  onHandoffComplete: () => void
}) {
  const { brief, cdUsers } = assignment
  const assignedCD = assignment.project.assignedCD

  const currentStage: BriefStage = brief?.briefStage ?? 'CS_DRAFTING'
  const currentIdx = BRIEF_STAGE_ORDER.indexOf(currentStage)

  const [selectedCDId, setSelectedCDId] = useState<string>(assignedCD?.id ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const briefReady = !!brief?.completedByCSAt
  const alreadySent = currentStage !== 'CS_DRAFTING'

  async function handleAssignCD() {
    if (!selectedCDId) return
    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/assign-cd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedCDId: selectedCDId, action: 'ASSIGN_CD' }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to assign CD')
      }
      setSuccess('CD assigned successfully.')
      onHandoffComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSendToCD() {
    setIsSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/assign-cd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedCDId: selectedCDId || undefined,
          action: 'SEND_TO_CD',
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to send brief to CD')
      }
      setSuccess('Brief sent to Creative Director.')
      onHandoffComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-zinc-800/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            Brief Chain
          </span>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          alreadySent
            ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
            : briefReady
            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
            : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
        }`}>
          {alreadySent ? BRIEF_STAGE_LABELS[currentStage] : briefReady ? 'Ready to Send' : 'Brief Incomplete'}
        </span>
      </div>

      <div className="px-5 py-4">
        {/* Stage Progress */}
        <div className="flex items-center gap-0 mb-5">
          {BRIEF_STAGE_ORDER.map((stage, idx) => {
            const done    = idx < currentIdx
            const active  = idx === currentIdx
            const isLast  = idx === BRIEF_STAGE_ORDER.length - 1
            return (
              <div key={stage} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                    done   ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' :
                    active ? 'border-indigo-400 bg-indigo-500/20 text-indigo-300' :
                             'border-zinc-700 bg-zinc-800/40 text-zinc-600'
                  }`}>
                    {done ? <Check className="w-3 h-3" /> : idx + 1}
                  </div>
                  <span className={`text-[9px] font-medium text-center leading-tight ${
                    done ? 'text-emerald-400' : active ? 'text-indigo-300' : 'text-zinc-600'
                  }`}>
                    {BRIEF_STAGE_LABELS[stage]}
                  </span>
                </div>
                {!isLast && (
                  <div className={`h-px flex-1 mt-[-10px] ${
                    done ? 'bg-emerald-500/50' : 'bg-zinc-700/60'
                  }`} />
                )}
              </div>
            )
          })}
        </div>

        {/* CS → CD Handoff Controls (only shown when still in CS_DRAFTING) */}
        {!alreadySent && (
          <div className="space-y-3">
            {/* Warning if brief not ready */}
            {!briefReady && (
              <div className="flex items-start gap-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-300 leading-relaxed">
                  Brief is not yet complete. Fill in Package Type, Special Instructions, and Style Notes in the{' '}
                  <Link href={`/cs/projects/${projectId}/brief`} className="underline hover:text-amber-200">
                    brief page
                  </Link>{' '}
                  before sending to CD.
                </p>
              </div>
            )}

            {/* CD Assignment */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Assign Creative Director
                </label>
                <select
                  value={selectedCDId}
                  onChange={e => setSelectedCDId(e.target.value)}
                  className="w-full rounded-lg bg-zinc-800/60 border border-zinc-700/60 text-sm text-zinc-200 px-3 py-2 focus:outline-none focus:border-indigo-500/60 transition-colors"
                >
                  <option value="">— Select CD —</option>
                  {cdUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleAssignCD}
                disabled={isSaving || !selectedCDId || selectedCDId === assignedCD?.id}
                className="mt-5 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60 disabled:opacity-40 transition-colors"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                Save CD
              </button>
            </div>

            {/* Send to CD */}
            <button
              type="button"
              onClick={handleSendToCD}
              disabled={isSending || !briefReady}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40 ${
                briefReady
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Brief to Creative Director
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        )}

        {/* Already sent — show timeline */}
        {alreadySent && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            {assignedCD && (
              <div className="rounded-lg bg-zinc-800/40 px-3 py-2.5 border border-zinc-700/40">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Creative Director</p>
                <p className="text-zinc-200 font-medium">{assignedCD.name}</p>
              </div>
            )}
            {brief?.sentToCDAt && (
              <div className="rounded-lg bg-zinc-800/40 px-3 py-2.5 border border-zinc-700/40">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Sent to CD</p>
                <p className="text-zinc-200 font-medium">
                  {new Date(brief.sentToCDAt).toLocaleDateString('en-MY', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              </div>
            )}
            {brief?.sentToADAt && (
              <div className="rounded-lg bg-zinc-800/40 px-3 py-2.5 border border-zinc-700/40">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Sent to AD</p>
                <p className="text-zinc-200 font-medium">
                  {new Date(brief.sentToADAt).toLocaleDateString('en-MY', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Feedback messages */}
        {error && (
          <p className="mt-2 text-xs text-red-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> {error}
          </p>
        )}
        {success && (
          <p className="mt-2 text-xs text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> {success}
          </p>
        )}
      </div>
    </div>
  )
}

/* ───────── ItemPanel ───────── */

function ItemPanel({
  item,
  projectId,
  onRefresh,
}: {
  item: DeliverableItem
  projectId: string
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [csNote, setCsNote] = useState('')
  const [isApproving, setIsApproving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showQC, setShowQC] = useState(false)

  const latestRevision  = item.revisions[item.revisions.length - 1] ?? null
  const latestFile      = item.fileVersions[0] ?? null
  const hasClientFeedback = latestRevision && latestRevision.annotationData
  const annotationRaw  = hasClientFeedback
    ? (latestRevision.annotationData as {
        objects?: object[]
        comments?: { id: string; x: number; y: number; width: number; height: number; text: string; authorId: string; authorName: string; createdAt: string; resolved: boolean }[]
      } | null)
    : null
  const annotationData = annotationRaw
    ? { objects: annotationRaw.objects ?? [], comments: annotationRaw.comments ?? [] }
    : null

  const canSendToClient = item.status === 'APPROVED'
  const canQC           = item.status === 'WIP_UPLOADED'
  const timelineEvents  = buildTimelineEvents(item)

  async function handleSendToClient() {
    setIsApproving(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/items/${item.id}/approve`, {
        method: 'POST',
      })
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
            {item.quantity > 1 && (
              <span className="text-zinc-500 ml-1">×{item.quantity}</span>
            )}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[item.status]}`}>
            {STATUS_LABELS[item.status]}
          </span>
          <span className="flex items-center gap-1 text-xs text-zinc-500">
            <RotateCcw className="h-3 w-3" />
            {item.revisionCount}/{item.revisionLimit}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Side-by-side alignment panel */}
      <div className="grid grid-cols-2 gap-0 border-b border-zinc-800/60">
        {/* CLIENT ASKED */}
        <div className="border-r border-zinc-800/60 p-4">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Client Asked
          </p>
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
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Designer Delivered
          </p>
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
          onChange={e => setCsNote(e.target.value)}
          placeholder="Translate client feedback into clear instructions for the designer..."
          className="w-full rounded-lg bg-zinc-800/40 border border-zinc-700/60 text-xs text-zinc-300 placeholder-zinc-600 p-2.5 resize-none focus:outline-none focus:border-[#6366f1]/60 transition-colors"
          rows={2}
        />
      </div>

      {/* Action buttons */}
      <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
        {canQC && latestFile && (
          <button
            type="button"
            onClick={() => setShowQC(v => !v)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-all"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {showQC ? 'Hide QC' : 'Run QC Check'}
          </button>
        )}

        {canSendToClient && (
          <button
            type="button"
            onClick={handleSendToClient}
            disabled={isApproving}
            className="cursor-pointer flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all disabled:opacity-50"
          >
            {isApproving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
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
            onResult={passed => {
              setShowQC(false)
              if (passed) onRefresh()
            }}
          />
        </div>
      )}

      {/* Expanded section */}
      {expanded && (
        <div className="p-4 border-t border-zinc-800/60 space-y-5">
          <div>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Version History
            </p>
            <FileVersionGallery
              versions={item.fileVersions.map((fv, idx) => ({
                ...fv,
                isApproved: item.status === 'FA_SIGNED' && idx === 0,
                isCurrent: idx === 0,
                uploadedBy: fv.uploadedBy,
              }))}
            />
          </div>

          <div>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Activity Timeline
            </p>
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

/* ───────── Main Page ───────── */

export default function CSProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [project, setProject]           = useState<Project | null>(null)
  const [assignment, setAssignment]     = useState<AssignmentData | null>(null)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [isGeneratingFA, setIsGeneratingFA] = useState(false)
  const [faError, setFaError]           = useState<string | null>(null)

  const loadAssignment = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}/assign-cd`)
      if (res.ok) {
        const json = await res.json()
        setAssignment(json.data)
      }
    } catch {
      // Non-fatal — assignment panel will just not render
    }
  }, [id])

  const loadProject = useCallback(async () => {
    try {
      const [projectRes, itemsRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/projects/${id}/items`),
      ])

      const projectData = await projectRes.json()
      const itemsData   = await itemsRes.json()

      const proj = projectData.data
      if (proj) {
        proj.deliverableItems = itemsData.data ?? []
        const enrichedItems = await Promise.all(
          (proj.deliverableItems ?? []).map(async (item: DeliverableItem) => {
            const revisionsRes  = await fetch(`/api/projects/${id}/items/${item.id}/revisions`)
            const revisionsData = await revisionsRes.json()
            return { ...item, revisions: revisionsData.data ?? [] }
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
  }, [id])

  useEffect(() => {
    Promise.all([loadProject(), loadAssignment()])
  }, [loadProject, loadAssignment])

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

  const balance     = project.quotedAmount - project.billedAmount
  const allDelivered =
    project.deliverableItems.length > 0 &&
    project.deliverableItems.every(i => i.status === 'DELIVERED' || i.status === 'FA_SIGNED')

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
              <button
                type="button"
                onClick={handleGenerateFA}
                disabled={isGeneratingFA}
                className="cursor-pointer flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 transition-all disabled:opacity-50"
              >
                {isGeneratingFA ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileText className="h-3.5 w-3.5" />
                )}
                Generate FA PDF
              </button>
            )}
            <Link
              href={`/cs/projects/${id}/brief`}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/20 transition-all"
            >
              <FileText className="h-3.5 w-3.5" />
              Edit Brief
            </Link>
            <button
              type="button"
              className="cursor-pointer flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-700/50 transition-all"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Chat with Client
            </button>
            <button
              type="button"
              className="cursor-pointer flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-700/50 transition-all"
            >
              <DollarSign className="h-3.5 w-3.5" />
              Generate Invoice
            </button>
            <button
              type="button"
              className="cursor-pointer flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 transition-all"
            >
              <Flag className="h-3.5 w-3.5" />
              Flag to Carlson
            </button>
          </div>
        </div>

        {faError && <p className="mt-3 text-xs text-red-400">{faError}</p>}
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

      {/* Brief Chain Handoff Panel */}
      {assignment && (
        <BriefChainPanel
          projectId={id}
          assignment={assignment}
          onHandoffComplete={() => loadAssignment()}
        />
      )}

      {/* Deliverable Items */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300">
          Deliverable Items ({project.deliverableItems.length})
        </h2>
        {project.deliverableItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-12 text-center">
            <p className="text-xs text-zinc-700">No items added to this project</p>
          </div>
        ) : (
          project.deliverableItems.map(item => (
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
