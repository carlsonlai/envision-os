'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Package,
  RotateCcw,
} from 'lucide-react'

type ProjectStatus = 'PROJECTED' | 'ONGOING' | 'COMPLETED' | 'BILLED' | 'PAID'
type ItemStatus = 'PENDING' | 'IN_PROGRESS' | 'WIP_UPLOADED' | 'QC_REVIEW' | 'APPROVED' | 'DELIVERED' | 'FA_SIGNED'

interface DeliverableItem {
  id: string
  itemType: string
  status: ItemStatus
  revisionCount: number
  revisionLimit: number
}

interface Project {
  id: string
  code: string
  status: ProjectStatus
  deadline: string | null
  deliverableItems: DeliverableItem[]
}

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; icon: React.ElementType }> = {
  PROJECTED: { label: 'Coming Soon', color: 'text-zinc-400 bg-zinc-100', icon: Clock },
  ONGOING: { label: 'In Progress', color: 'text-blue-600 bg-blue-50', icon: Clock },
  COMPLETED: { label: 'Completed', color: 'text-amber-600 bg-amber-50', icon: AlertTriangle },
  BILLED: { label: 'Billed', color: 'text-violet-600 bg-violet-50', icon: CheckCircle2 },
  PAID: { label: 'Paid', color: 'text-emerald-600 bg-emerald-50', icon: CheckCircle2 },
}

function getProjectNextAction(project: Project): { label: string; urgent: boolean } | null {
  const items = project.deliverableItems

  const awaitingReview = items.filter((i) => i.status === 'DELIVERED').length
  if (awaitingReview > 0) {
    return { label: `${awaitingReview} item${awaitingReview > 1 ? 's' : ''} awaiting your review`, urgent: true }
  }

  const allDelivered = items.length > 0 && items.every((i) => i.status === 'DELIVERED' || i.status === 'FA_SIGNED')
  if (allDelivered && project.status === 'COMPLETED') {
    return { label: 'Ready to sign Final Artwork', urgent: true }
  }

  const inProgress = items.filter((i) => ['IN_PROGRESS', 'WIP_UPLOADED', 'QC_REVIEW'].includes(i.status)).length
  if (inProgress > 0) {
    return { label: `${inProgress} item${inProgress > 1 ? 's' : ''} being worked on`, urgent: false }
  }

  return null
}

function ProjectCard({ project }: { project: Project }) {
  const statusConfig = STATUS_CONFIG[project.status]
  const StatusIcon = statusConfig.icon
  const nextAction = getProjectNextAction(project)
  const isOverdue = project.deadline && new Date(project.deadline) < new Date()

  const totalRevisions = project.deliverableItems.reduce((sum, i) => sum + i.revisionCount, 0)
  const maxRevisions = project.deliverableItems.reduce((sum, i) => sum + i.revisionLimit, 0)

  return (
    <Link
      href={`/portal/${project.id}`}
      className={`group block rounded-2xl border bg-white shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${
        nextAction?.urgent
          ? 'border-amber-200 hover:border-amber-300'
          : 'border-zinc-200 hover:border-zinc-300'
      }`}
    >
      {/* Action banner */}
      {nextAction?.urgent && (
        <div className="flex items-center gap-2 bg-amber-50 border-b border-amber-200 px-4 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
          <span className="text-xs font-medium text-amber-700">{nextAction.label}</span>
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-xs font-mono text-zinc-400 mb-1">{project.code}</p>
            <h3 className="text-base font-semibold text-zinc-900 group-hover:text-[#4f46e5] transition-colors">
              Your Project
            </h3>
          </div>
          <div
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${statusConfig.color}`}
          >
            <StatusIcon className="h-3 w-3" />
            {statusConfig.label}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg bg-zinc-50 border border-zinc-100 p-2.5 text-center">
            <p className="text-lg font-bold text-zinc-900">{project.deliverableItems.length}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Items</p>
          </div>
          <div className="rounded-lg bg-zinc-50 border border-zinc-100 p-2.5 text-center">
            <p className="text-lg font-bold text-zinc-900">
              {project.deliverableItems.filter((i) => i.status === 'DELIVERED' || i.status === 'FA_SIGNED').length}
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Delivered</p>
          </div>
          <div className="rounded-lg bg-zinc-50 border border-zinc-100 p-2.5 text-center">
            <p className={`text-lg font-bold ${totalRevisions >= maxRevisions && maxRevisions > 0 ? 'text-red-600' : 'text-zinc-900'}`}>
              {totalRevisions}
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Revisions</p>
          </div>
        </div>

        {/* Deadline */}
        {project.deadline && (
          <div className="flex items-center gap-1.5 text-xs mb-4">
            <Clock className="h-3.5 w-3.5 text-zinc-400" />
            <span className={isOverdue ? 'text-red-500 font-medium' : 'text-zinc-500'}>
              {isOverdue
                ? `Overdue — ${new Date(project.deadline).toLocaleDateString('en-MY', { day: 'numeric', month: 'long' })}`
                : `Due ${new Date(project.deadline).toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })}`}
            </span>
          </div>
        )}

        {/* Non-urgent next action */}
        {nextAction && !nextAction.urgent && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-4">
            <RotateCcw className="h-3.5 w-3.5" />
            {nextAction.label}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex -space-x-1">
            {project.deliverableItems.slice(0, 5).map((item) => {
              const isDelivered = item.status === 'DELIVERED' || item.status === 'FA_SIGNED'
              return (
                <div
                  key={item.id}
                  className={`h-4 w-4 rounded-full border border-white ${
                    isDelivered ? 'bg-emerald-400' : 'bg-zinc-300'
                  }`}
                />
              )
            })}
          </div>
          <span className="flex items-center gap-1 text-xs font-medium text-[#4f46e5] group-hover:gap-1.5 transition-all">
            View project <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function ClientPortalPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/projects')
        const data = await res.json()
        setProjects(data.data ?? [])
      } catch (err) {
        console.error('Failed to load projects:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const urgentCount = projects.filter((p) => {
    const action = getProjectNextAction(p)
    return action?.urgent
  }).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">My Projects</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {projects.length} project{projects.length !== 1 ? 's' : ''} in your portal
          {urgentCount > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-amber-600 font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              {urgentCount} action{urgentCount > 1 ? 's' : ''} needed
            </span>
          )}
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-16 text-center">
          <Package className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-zinc-700">No projects yet</h3>
          <p className="text-xs text-zinc-400 mt-1">
            Your projects will appear here once your account manager sets them up.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}
