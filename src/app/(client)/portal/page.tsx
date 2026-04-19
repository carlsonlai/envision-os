'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Package,
  RotateCcw,
  Sparkles,
  Mail,
} from 'lucide-react'
import { ProjectProgressRing } from '@/components/project/ProjectProgressRing'

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

interface StatusPresentation {
  label: string
  color: string
  icon: React.ElementType
}

const STATUS_CONFIG: Record<ProjectStatus, StatusPresentation> = {
  PROJECTED: { label: 'Coming Soon', color: 'text-zinc-600 bg-zinc-100', icon: Clock },
  ONGOING: { label: 'In Progress', color: 'text-blue-700 bg-blue-50', icon: Clock },
  COMPLETED: { label: 'Ready for FA', color: 'text-amber-700 bg-amber-50', icon: AlertTriangle },
  BILLED: { label: 'Billed', color: 'text-violet-700 bg-violet-50', icon: CheckCircle2 },
  PAID: { label: 'Paid', color: 'text-emerald-700 bg-emerald-50', icon: CheckCircle2 },
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

function getProgress(items: DeliverableItem[]): number {
  if (items.length === 0) return 0
  const completed = items.filter((i) => i.status === 'DELIVERED' || i.status === 'FA_SIGNED').length
  return completed / items.length
}

function formatDeadline(deadline: string): string {
  return new Date(deadline).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function ProjectCard({ project }: { project: Project }) {
  const statusConfig = STATUS_CONFIG[project.status]
  const StatusIcon = statusConfig.icon
  const nextAction = getProjectNextAction(project)
  const [now] = useState(() => Date.now())
  const isOverdue = project.deadline ? new Date(project.deadline).getTime() < now : false
  const progress = getProgress(project.deliverableItems)
  const delivered = project.deliverableItems.filter(
    (i) => i.status === 'DELIVERED' || i.status === 'FA_SIGNED',
  ).length
  const totalRevisions = project.deliverableItems.reduce((sum, i) => sum + i.revisionCount, 0)
  const maxRevisions = project.deliverableItems.reduce((sum, i) => sum + i.revisionLimit, 0)
  const revisionsExhausted = maxRevisions > 0 && totalRevisions >= maxRevisions

  const ringTone: 'indigo' | 'emerald' | 'amber' = progress >= 1
    ? 'emerald'
    : nextAction?.urgent
      ? 'amber'
      : 'indigo'

  return (
    <Link
      href={`/portal/${project.id}`}
      className={`group relative block rounded-2xl border bg-white shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden ${
        nextAction?.urgent ? 'border-amber-200 hover:border-amber-300' : 'border-zinc-200 hover:border-zinc-300'
      }`}
    >
      {/* Urgent action banner */}
      {nextAction?.urgent && (
        <div className="flex items-center gap-2 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 px-4 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
          <span className="text-xs font-semibold text-amber-800">{nextAction.label}</span>
        </div>
      )}

      <div className="p-5">
        {/* Progress ring + identity */}
        <div className="flex items-start gap-4 mb-4">
          <ProjectProgressRing progress={progress} size={56} stroke={5} tone={ringTone} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-mono font-semibold text-zinc-400 tracking-tight">
              {project.code}
            </p>
            <h3 className="text-base font-semibold text-zinc-900 group-hover:text-[#4f46e5] transition-colors truncate">
              Your Project
            </h3>
            <div
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 mt-1 text-[11px] font-medium ${statusConfig.color}`}
            >
              <StatusIcon className="h-3 w-3" />
              {statusConfig.label}
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-lg bg-zinc-50 border border-zinc-100 p-2.5 text-center">
            <p className="text-lg font-bold text-zinc-900 tabular-nums">
              {project.deliverableItems.length}
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wide">Items</p>
          </div>
          <div className="rounded-lg bg-zinc-50 border border-zinc-100 p-2.5 text-center">
            <p className="text-lg font-bold text-emerald-600 tabular-nums">{delivered}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wide">Done</p>
          </div>
          <div className="rounded-lg bg-zinc-50 border border-zinc-100 p-2.5 text-center">
            <p
              className={`text-lg font-bold tabular-nums ${
                revisionsExhausted ? 'text-red-600' : 'text-zinc-900'
              }`}
            >
              {totalRevisions}
              {maxRevisions > 0 && <span className="text-xs text-zinc-400">/{maxRevisions}</span>}
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wide flex items-center justify-center gap-0.5">
              <RotateCcw className="h-2.5 w-2.5" /> Revs
            </p>
          </div>
        </div>

        {/* Deadline */}
        {project.deadline && (
          <div className="flex items-center gap-1.5 text-xs mb-4">
            <Clock className="h-3.5 w-3.5 text-zinc-400" />
            <span className={isOverdue ? 'text-red-600 font-semibold' : 'text-zinc-500'}>
              {isOverdue ? `Overdue — ${formatDeadline(project.deadline)}` : `Due ${formatDeadline(project.deadline)}`}
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

        {/* Item status dots + CTA */}
        <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
          <div className="flex -space-x-1">
            {project.deliverableItems.slice(0, 6).map((item) => {
              const isDelivered = item.status === 'DELIVERED' || item.status === 'FA_SIGNED'
              const isInProgress = ['IN_PROGRESS', 'WIP_UPLOADED', 'QC_REVIEW', 'APPROVED'].includes(
                item.status,
              )
              return (
                <div
                  key={item.id}
                  className={`h-4 w-4 rounded-full border-2 border-white ${
                    isDelivered ? 'bg-emerald-400' : isInProgress ? 'bg-indigo-400' : 'bg-zinc-300'
                  }`}
                />
              )
            })}
            {project.deliverableItems.length > 6 && (
              <div className="h-4 min-w-[16px] px-1 rounded-full border-2 border-white bg-zinc-200 text-[9px] font-bold text-zinc-600 flex items-center justify-center">
                +{project.deliverableItems.length - 6}
              </div>
            )}
          </div>
          <span className="flex items-center gap-1 text-xs font-semibold text-[#4f46e5] group-hover:gap-1.5 transition-all">
            View project <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function ClientPortalPage() {
  const { data: session } = useSession()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/projects')
        const data = await res.json()
        setProjects(data.data ?? [])
      } catch {
        // Silent fail - empty state will show
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const urgentCount = projects.filter((p) => {
    const action = getProjectNextAction(p)
    return action?.urgent
  }).length

  const activeCount = projects.filter((p) => p.status === 'ONGOING' || p.status === 'COMPLETED').length
  const completedCount = projects.filter((p) => p.status === 'PAID' || p.status === 'BILLED').length

  const firstName = session?.user?.name?.split(' ')[0] ?? 'there'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Hero header */}
      <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-[#4f46e5] via-[#6366f1] to-[#8b5cf6] p-8 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_60%)]" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-white/80" />
              <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
                My Portal
              </p>
            </div>
            <h1 className="text-3xl font-bold text-white">Welcome back, {firstName}</h1>
            <p className="text-sm text-white/80 mt-1.5">
              {projects.length === 0
                ? 'No active projects yet — your account manager will add them soon.'
                : urgentCount > 0
                  ? `${urgentCount} item${urgentCount > 1 ? 's need' : ' needs'} your attention today.`
                  : `${projects.length} project${projects.length !== 1 ? 's' : ''} in motion. Everything's on track.`}
            </p>
          </div>

          {projects.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Active</p>
                <p className="text-2xl font-bold text-white tabular-nums">{activeCount}</p>
              </div>
              <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Completed</p>
                <p className="text-2xl font-bold text-white tabular-nums">{completedCount}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Urgent callout */}
      {urgentCount > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 flex items-center gap-3">
          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-900">
              {urgentCount} item{urgentCount > 1 ? 's' : ''} waiting on you
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Review and approve artwork to keep your project moving.
            </p>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-200 bg-white p-16 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-zinc-50 flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-zinc-300" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-700">No projects yet</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
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

      {/* Help CTA */}
      <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Need help with your project?</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Our team is here whenever you have a question — usually replies within an hour.
          </p>
        </div>
        <a
          href="mailto:hello@envicionstudio.com.my"
          className="flex items-center gap-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 px-4 py-2.5 text-sm font-medium text-white transition-colors shadow-sm"
        >
          <Mail className="h-4 w-4" />
          Contact your team
        </a>
      </div>
    </div>
  )
}
