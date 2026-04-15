'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  Play,
  Upload,
  Flag,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Zap,
  MessageSquare,
  FileText,
  ChevronDown,
  ChevronUp,
  ListTodo,
} from 'lucide-react'

type ItemStatus = 'PENDING' | 'IN_PROGRESS' | 'WIP_UPLOADED' | 'QC_REVIEW' | 'APPROVED' | 'DELIVERED' | 'FA_SIGNED'
type ItemType = 'BANNER' | 'BROCHURE' | 'LOGO' | 'SOCIAL' | 'PRINT' | 'THREE_D' | 'VIDEO' | 'OTHER'

interface Revision {
  id: string
  feedback: string
  status: string
  revisionNumber: number
  createdAt: string
}

interface Brief {
  id: string
  packageType: string | null
  specialInstructions: string | null
  styleNotes: string | null
  priority: string
  qualityGatePassed: boolean | null
  completedByCSAt: string | null
}

interface AssignedUser {
  id: string
  name: string
  role: string
}

interface DeliverableItem {
  id: string
  projectId: string
  itemType: ItemType
  description: string | null
  quantity: number
  revisionLimit: number
  revisionCount: number
  status: ItemStatus
  estimatedMinutes: number | null
  deadline: string | null
  revisions: Revision[]
  assignedDesigner: AssignedUser | null
}

interface Project {
  id: string
  code: string
  status: string
  deliverableItems: DeliverableItem[]
  brief: Brief | null
  assignedCS: AssignedUser | null
}

interface CapacityInfo {
  committedMinutes: number
  capacityMinutes: number
  utilizationPercent: number
}

const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  BANNER: 'Banner',
  BROCHURE: 'Brochure',
  LOGO: 'Logo',
  SOCIAL: 'Social',
  PRINT: 'Print',
  THREE_D: '3D',
  VIDEO: 'Video',
  OTHER: 'Other',
}

const STATUS_STYLES: Record<ItemStatus, { label: string; color: string; icon: React.ElementType }> = {
  PENDING: { label: 'Pending', color: 'text-zinc-400 bg-zinc-800/60', icon: Clock },
  IN_PROGRESS: { label: 'In Progress', color: 'text-blue-400 bg-blue-500/10', icon: Zap },
  WIP_UPLOADED: { label: 'Uploaded', color: 'text-violet-400 bg-violet-500/10', icon: Upload },
  QC_REVIEW: { label: 'QC Review', color: 'text-amber-400 bg-amber-500/10', icon: AlertTriangle },
  APPROVED: { label: 'Approved', color: 'text-emerald-400 bg-emerald-500/10', icon: CheckCircle2 },
  DELIVERED: { label: 'Delivered', color: 'text-teal-400 bg-teal-500/10', icon: CheckCircle2 },
  FA_SIGNED: { label: 'FA Signed', color: 'text-green-400 bg-green-500/10', icon: CheckCircle2 },
}

function getCountdown(deadline: string | null): { label: string; urgent: boolean } | null {
  if (!deadline) return null
  const diff = new Date(deadline).getTime() - Date.now()
  if (diff < 0) return { label: 'Overdue', urgent: true }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  if (days === 0) return { label: `${hours}h left`, urgent: true }
  if (days === 1) return { label: '1 day left', urgent: true }
  if (days <= 3) return { label: `${days} days left`, urgent: true }
  return { label: `${days} days left`, urgent: false }
}

function CapacityBar({ percent }: { percent: number }) {
  const color =
    percent >= 90 ? 'from-red-500 to-red-600' : percent >= 70 ? 'from-amber-400 to-amber-500' : 'from-[#6366f1] to-[#8b5cf6]'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">Today&apos;s capacity</span>
        <span className={`font-semibold ${percent >= 90 ? 'text-red-400' : percent >= 70 ? 'text-amber-400' : 'text-zinc-300'}`}>
          {percent}%
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  )
}

function QueueItem({
  item,
  projectCode,
  projectId,
  brief,
  assignedCS,
  onAction,
}: {
  item: DeliverableItem
  projectCode: string
  projectId: string
  brief: Brief | null
  assignedCS: AssignedUser | null
  onAction: (action: 'start' | 'upload' | 'flag', itemId: string) => void
}) {
  const [showBrief, setShowBrief] = useState(false)
  const statusConfig = STATUS_STYLES[item.status]
  const StatusIcon = statusConfig.icon
  const isOverdue = item.deadline && new Date(item.deadline) < new Date()
  const latestRevision = item.revisions?.[0]
  const hasFeedback = !!latestRevision && latestRevision.status === 'PENDING'

  return (
    <div
      className={`rounded-lg border p-4 space-y-3 ${
        hasFeedback
          ? 'border-amber-500/30 bg-amber-500/5'
          : isOverdue
          ? 'border-red-500/30 bg-red-500/5'
          : 'border-zinc-800/60 bg-zinc-900/40'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          {/* Anonymised — show only project code */}
          <span className="text-xs font-mono font-semibold text-[#818cf8]">{projectCode}</span>
          <p className="text-sm font-medium text-zinc-200">
            {ITEM_TYPE_LABELS[item.itemType]}
            {item.quantity > 1 && (
              <span className="ml-1.5 text-xs text-zinc-500">×{item.quantity}</span>
            )}
          </p>
          {item.description && (
            <p className="text-xs text-zinc-500 leading-relaxed">{item.description}</p>
          )}
        </div>
        <div className={`flex-shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusConfig.color}`}>
          <StatusIcon className="h-2.5 w-2.5" />
          {statusConfig.label}
        </div>
      </div>

      {/* Team: Designer + CS */}
      <div className="flex items-center gap-3 text-[10px] text-zinc-600">
        {item.assignedDesigner && (
          <div className="flex items-center gap-1">
            <div className="h-4 w-4 rounded-full bg-[#6366f1]/20 flex items-center justify-center text-[8px] font-bold text-[#818cf8]">
              {item.assignedDesigner.name[0]}
            </div>
            <span className="text-zinc-500">{item.assignedDesigner.name}</span>
          </div>
        )}
        {assignedCS && (
          <>
            <span className="text-zinc-700">·</span>
            <div className="flex items-center gap-1">
              <div className="h-4 w-4 rounded-full bg-emerald-500/15 flex items-center justify-center text-[8px] font-bold text-emerald-400">
                {assignedCS.name[0]}
              </div>
              <span className="text-zinc-500">{assignedCS.name} <span className="text-zinc-700">(CS)</span></span>
            </div>
          </>
        )}
      </div>

      {/* Latest feedback from CS (revision request) */}
      {hasFeedback && latestRevision && (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 space-y-1">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="h-3 w-3 text-amber-400" />
            <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide">
              Revision #{latestRevision.revisionNumber} — Feedback
            </span>
          </div>
          <p className="text-xs text-amber-200/90 leading-relaxed">{latestRevision.feedback}</p>
        </div>
      )}

      {/* Brief info toggle */}
      {brief && (brief.specialInstructions || brief.styleNotes || brief.packageType) && (
        <div>
          <button type="button"
            onClick={() => setShowBrief(v => !v)}
            className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <FileText className="h-3 w-3" />
            Brief notes
            {showBrief ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {showBrief && (
            <div className="mt-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 space-y-1.5 text-xs">
              {brief.packageType && (
                <div><span className="text-zinc-600">Package: </span><span className="text-zinc-300">{brief.packageType}</span></div>
              )}
              {brief.styleNotes && (
                <div><span className="text-zinc-600">Style: </span><span className="text-zinc-300">{brief.styleNotes}</span></div>
              )}
              {brief.specialInstructions && (
                <div><span className="text-zinc-600">Instructions: </span><span className="text-zinc-300">{brief.specialInstructions}</span></div>
              )}
              {brief.qualityGatePassed && (
                <div className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="h-3 w-3" /><span>QC Approved</span></div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Revisions + Countdown */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-zinc-500">
          <RotateCcw className="h-3 w-3" />
          <span>{item.revisionCount}/{item.revisionLimit} revisions</span>
        </div>
        {item.deadline && (() => {
          const cd = getCountdown(item.deadline)
          return cd ? (
            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              cd.urgent
                ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                : 'bg-zinc-800 text-zinc-400'
            }`}>
              <Clock className="h-2.5 w-2.5" />
              {cd.label}
            </span>
          ) : null
        })()}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-3 gap-1.5">
        <button type="button"
          onClick={() => onAction('start', item.id)}
          disabled={item.status !== 'PENDING'}
          className="flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium border border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-700/60 hover:border-zinc-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Play className="h-3 w-3" />
          Start
        </button>
        <button type="button"
          onClick={() => onAction('upload', item.id)}
          disabled={item.status === 'PENDING' || item.status === 'APPROVED' || item.status === 'DELIVERED'}
          className="flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium border border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-700/60 hover:border-zinc-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Upload className="h-3 w-3" />
          Upload
        </button>
        <button type="button"
          onClick={() => onAction('flag', item.id)}
          className="flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium border border-red-800/40 text-red-500/70 hover:text-red-300 hover:bg-red-500/10 hover:border-red-700/50 transition-all"
        >
          <Flag className="h-3 w-3" />
          Flag
        </button>
      </div>

      {/* View task detail */}
      <Link
        href={`/designer/task/${item.id}`}
        className="flex items-center justify-center gap-1 text-[10px] text-zinc-600 hover:text-[#818cf8] transition-colors"
      >
        <FileText className="h-3 w-3" />
        View full task & upload history
      </Link>
    </div>
  )
}

export default function DesignerPage() {
  const { data: session } = useSession()
  const [projects, setProjects] = useState<Project[]>([])
  const [capacity, setCapacity] = useState<CapacityInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [projectsRes, workloadRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/workload'),
        ])

        const projectsData = await projectsRes.json()
        const workloadData = await workloadRes.json()

        setProjects(projectsData.data ?? [])

        const myWorkload = (workloadData.data ?? []).find(
          (w: { user: { id: string } }) => w.user?.id === session?.user?.id
        )
        if (myWorkload?.slots?.[0]) {
          setCapacity(myWorkload.slots[0])
        }
      } catch (error) {
        console.error('Failed to load designer data:', error)
      } finally {
        setLoading(false)
      }
    }
    if (session?.user) loadData()
  }, [session])

  async function handleAction(action: 'start' | 'upload' | 'flag', itemId: string) {
    const statusMap: Record<string, string> = {
      start: 'IN_PROGRESS',
      upload: 'WIP_UPLOADED',
    }

    if (action === 'flag') {
      alert('Flag feature: Please message your Creative Director with the issue details.')
      return
    }

    try {
      // Update item status optimistically
      setProjects((prev) =>
        prev.map((p) => ({
          ...p,
          deliverableItems: p.deliverableItems.map((item) =>
            item.id === itemId
              ? { ...item, status: statusMap[action] as ItemStatus }
              : item
          ),
        }))
      )
    } catch (error) {
      console.error('Failed to update item:', error)
    }
  }

  const allItems = projects.flatMap((p) =>
    (p.deliverableItems ?? []).map((item) => ({
      ...item,
      projectCode: p.code,
      projectId: p.id,
      brief: p.brief ?? null,
      assignedCS: p.assignedCS ?? null,
    }))
  )

  const nowItems = allItems.filter((i) => i.status === 'IN_PROGRESS')
  const nextItems = allItems.filter((i) => i.status === 'PENDING' && i.deadline).slice(0, 3)
  const queuedItems = allItems.filter(
    (i) => i.status === 'PENDING' && !nextItems.find((n) => n.id === i.id)
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  const inProgressCount = nowItems.length
  const pendingCount = allItems.filter(i => i.status === 'PENDING').length
  const uploadedCount = allItems.filter(i => ['WIP_UPLOADED', 'QC_REVIEW'].includes(i.status)).length
  const doneCount = allItems.filter(i => ['APPROVED', 'DELIVERED', 'FA_SIGNED'].includes(i.status)).length
  const pendingFeedback = allItems.filter(i => (i.revisions ?? []).some((r: { status: string }) => r.status === 'PENDING')).length

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">My Queue</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {allItems.length} job{allItems.length !== 1 ? 's' : ''} across {projects.length} project{projects.length !== 1 ? 's' : ''}
        </p>
        {/* Pipeline summary */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 text-[11px] font-medium text-blue-400">
            <Zap className="h-3 w-3" /> {inProgressCount} In Progress
          </span>
          <span className="flex items-center gap-1 rounded-full bg-zinc-800 border border-zinc-700/40 px-2.5 py-1 text-[11px] font-medium text-zinc-400">
            <ListTodo className="h-3 w-3" /> {pendingCount} Pending
          </span>
          {uploadedCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 text-[11px] font-medium text-violet-400">
              <Upload className="h-3 w-3" /> {uploadedCount} In Review
            </span>
          )}
          {doneCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> {doneCount} Done
            </span>
          )}
          {pendingFeedback > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-[11px] font-medium text-amber-400">
              <MessageSquare className="h-3 w-3" /> {pendingFeedback} Needs Action
            </span>
          )}
        </div>
      </div>

      {/* Capacity bar */}
      {capacity && (
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
          <CapacityBar percent={capacity.utilizationPercent} />
          <p className="mt-2 text-xs text-zinc-600">
            {capacity.committedMinutes}min committed / {capacity.capacityMinutes}min available today
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* NOW */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
            <h2 className="text-sm font-semibold text-zinc-200">Now</h2>
            <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
              {nowItems.length}
            </span>
          </div>
          {nowItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center">
              <p className="text-xs text-zinc-700">Nothing in progress</p>
            </div>
          ) : (
            nowItems.map((item) => (
              <QueueItem
                key={item.id}
                item={item}
                projectCode={item.projectCode}
                projectId={item.projectId}
                brief={item.brief}
                assignedCS={item.assignedCS}
                onAction={handleAction}
              />
            ))
          )}
        </div>

        {/* NEXT */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-amber-400" />
            <h2 className="text-sm font-semibold text-zinc-200">Next</h2>
            <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
              {nextItems.length}
            </span>
          </div>
          {nextItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center">
              <p className="text-xs text-zinc-700">Queue is clear</p>
            </div>
          ) : (
            nextItems.map((item) => (
              <QueueItem
                key={item.id}
                item={item}
                projectCode={item.projectCode}
                projectId={item.projectId}
                brief={item.brief}
                assignedCS={item.assignedCS}
                onAction={handleAction}
              />
            ))
          )}
        </div>

        {/* QUEUED */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-zinc-600" />
            <h2 className="text-sm font-semibold text-zinc-200">Queued</h2>
            <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
              {queuedItems.length}
            </span>
          </div>
          {queuedItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center">
              <p className="text-xs text-zinc-700">No queued work</p>
            </div>
          ) : (
            queuedItems.map((item) => (
              <QueueItem
                key={item.id}
                item={item}
                projectCode={item.projectCode}
                projectId={item.projectId}
                brief={item.brief}
                assignedCS={item.assignedCS}
                onAction={handleAction}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
