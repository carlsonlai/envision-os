'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MessageSquare,
  Download,
  FileSignature,
  Sparkles,
} from 'lucide-react'
import { ProjectProgressRing } from '@/components/project/ProjectProgressRing'
import { RevisionMeter } from '@/components/project/RevisionMeter'

type ItemStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'WIP_UPLOADED'
  | 'QC_REVIEW'
  | 'APPROVED'
  | 'DELIVERED'
  | 'FA_SIGNED'
type ItemType = 'BANNER' | 'BROCHURE' | 'LOGO' | 'SOCIAL' | 'PRINT' | 'THREE_D' | 'VIDEO' | 'OTHER'
type ProjectStatus = 'PROJECTED' | 'ONGOING' | 'COMPLETED' | 'BILLED' | 'PAID'

interface FileVersion {
  id: string
  version: number
  filename: string
  url: string
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
}

interface Project {
  id: string
  code: string
  status: ProjectStatus
  deadline: string | null
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

interface StatusPresentation {
  label: string
  color: string
  icon: React.ElementType
}

const ITEM_STATUS_CONFIG: Record<ItemStatus, StatusPresentation> = {
  PENDING: { label: 'Not Started', color: 'text-zinc-600 bg-zinc-100', icon: Clock },
  IN_PROGRESS: { label: 'In Design', color: 'text-blue-700 bg-blue-50', icon: Clock },
  WIP_UPLOADED: { label: 'Under Review', color: 'text-violet-700 bg-violet-50', icon: Clock },
  QC_REVIEW: { label: 'Quality Check', color: 'text-amber-700 bg-amber-50', icon: Clock },
  APPROVED: { label: 'Approved', color: 'text-teal-700 bg-teal-50', icon: CheckCircle2 },
  DELIVERED: { label: 'Ready for Review', color: 'text-orange-700 bg-orange-50', icon: AlertTriangle },
  FA_SIGNED: { label: 'Final Signed', color: 'text-emerald-700 bg-emerald-50', icon: CheckCircle2 },
}

function ItemCard({ item, projectId }: { item: DeliverableItem; projectId: string }) {
  const statusConfig = ITEM_STATUS_CONFIG[item.status]
  const StatusIcon = statusConfig.icon
  const latestVersion = item.fileVersions[0] ?? null
  const isDelivered = item.status === 'DELIVERED'
  const canAnnotate = isDelivered && latestVersion

  return (
    <div
      className={`group rounded-2xl border bg-white overflow-hidden transition-all hover:shadow-lg ${
        isDelivered ? 'border-amber-200 ring-1 ring-amber-100' : 'border-zinc-200'
      }`}
    >
      {/* Action banner for items needing review */}
      {isDelivered && (
        <div className="flex items-center gap-2 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 px-4 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
          <span className="text-xs font-semibold text-amber-800">Your review needed</span>
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-zinc-900 truncate">
              {ITEM_TYPE_LABELS[item.itemType]}
              {item.quantity > 1 && <span className="ml-1.5 text-sm text-zinc-400">×{item.quantity}</span>}
            </h3>
            {item.description && (
              <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{item.description}</p>
            )}
          </div>
          <div
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium flex-shrink-0 ${statusConfig.color}`}
          >
            <StatusIcon className="h-3 w-3" />
            {statusConfig.label}
          </div>
        </div>

        {/* Latest file preview */}
        {latestVersion && (
          <div className="mb-3 rounded-xl border border-zinc-100 overflow-hidden bg-zinc-50">
            {/\.(jpg|jpeg|png|gif|webp|svg|avif)$/i.test(latestVersion.filename) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={latestVersion.url}
                alt={latestVersion.filename}
                className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="flex items-center justify-center h-24 bg-gradient-to-br from-zinc-50 to-zinc-100">
                <span className="text-4xl">
                  {latestVersion.filename.match(/\.pdf$/i) ? '📄' : '📁'}
                </span>
              </div>
            )}
            <div className="px-3 py-2 border-t border-zinc-100 bg-white">
              <p className="text-xs text-zinc-500 truncate">
                <span className="font-mono font-semibold text-zinc-700">v{latestVersion.version}</span>
                {' — '}
                {latestVersion.filename}
              </p>
            </div>
          </div>
        )}

        {/* Revision meter */}
        <div className="mb-4">
          <RevisionMeter used={item.revisionCount} limit={item.revisionLimit} theme="light" />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {canAnnotate && (
            <Link
              href={`/portal/${projectId}/annotate/${item.id}`}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-[#4f46e5] hover:text-white bg-[#eef2ff] hover:bg-[#4f46e5] border border-[#c7d2fe] hover:border-[#4f46e5] transition-all"
            >
              <MessageSquare className="h-4 w-4" />
              Review &amp; Annotate
            </Link>
          )}
          {isDelivered && (
            <Link
              href={`/portal/${projectId}/annotate/${item.id}?approve=1`}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-500 hover:text-white border border-emerald-200 hover:border-emerald-500 transition-all"
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve
            </Link>
          )}
          {latestVersion && !isDelivered && (
            <a
              href={latestVersion.url}
              download={latestVersion.filename}
              className="flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 border border-zinc-200 transition-all"
            >
              <Download className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

interface TimelineStep {
  label: string
  done: boolean
  active: boolean
}

function HorizontalTimeline({ steps }: { steps: readonly TimelineStep[] }) {
  return (
    <div className="relative">
      <ol className="grid grid-cols-5 gap-0">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1
          return (
            <li key={idx} className="relative flex flex-col items-center text-center">
              {/* Connector line (to next step) */}
              {!isLast && (
                <div
                  className={`absolute top-3 left-1/2 w-full h-0.5 ${
                    steps[idx + 1]?.done || step.done ? 'bg-[#4f46e5]' : 'bg-zinc-200'
                  }`}
                />
              )}
              <div
                className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                  step.done
                    ? 'bg-[#4f46e5] text-white shadow-md shadow-[#4f46e5]/30'
                    : step.active
                      ? 'bg-white border-2 border-[#4f46e5] text-[#4f46e5]'
                      : 'bg-white border-2 border-zinc-200 text-zinc-400'
                }`}
              >
                {step.done ? '✓' : idx + 1}
              </div>
              <span
                className={`mt-2 text-[11px] font-medium max-w-[90px] leading-tight ${
                  step.done ? 'text-zinc-800' : step.active ? 'text-zinc-700' : 'text-zinc-400'
                }`}
              >
                {step.label}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default function ClientProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = use(params)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        if (!res.ok) throw new Error('Project not found')
        const data = await res.json()
        setProject(data.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load project')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [projectId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10 text-center">
        <p className="text-zinc-500">{error ?? 'Project not found'}</p>
        <Link href="/portal" className="mt-4 inline-block text-sm text-[#4f46e5] hover:underline">
          Back to My Projects
        </Link>
      </div>
    )
  }

  const deliveredCount = project.deliverableItems.filter(
    (i) => i.status === 'DELIVERED' || i.status === 'FA_SIGNED',
  ).length
  const allDelivered =
    project.deliverableItems.length > 0 &&
    project.deliverableItems.every((i) => i.status === 'DELIVERED' || i.status === 'FA_SIGNED')
  const progress =
    project.deliverableItems.length > 0 ? deliveredCount / project.deliverableItems.length : 0
  const hasStarted = project.deliverableItems.some((i) => i.status !== 'PENDING')
  const hasDelivered = project.deliverableItems.some((i) =>
    ['DELIVERED', 'FA_SIGNED'].includes(i.status),
  )
  const isSigned =
    project.status === 'COMPLETED' || project.status === 'BILLED' || project.status === 'PAID'
  const reviewsPending = project.deliverableItems.filter((i) => i.status === 'DELIVERED').length

  const timelineSteps: readonly TimelineStep[] = [
    { label: 'Kick-off', done: true, active: false },
    { label: 'Designing', done: hasStarted, active: hasStarted && !hasDelivered },
    { label: 'Your review', done: hasDelivered, active: hasDelivered && !allDelivered },
    { label: 'All approved', done: allDelivered, active: allDelivered && !isSigned },
    { label: 'Signed off', done: isSigned, active: false },
  ]

  const ringTone: 'indigo' | 'emerald' | 'amber' = progress >= 1
    ? 'emerald'
    : reviewsPending > 0
      ? 'amber'
      : 'indigo'

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Back nav */}
      <Link
        href="/portal"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        My Projects
      </Link>

      {/* Project header — hero with ring */}
      <div className="relative rounded-3xl border border-zinc-200 bg-white p-6 mb-6 shadow-sm overflow-hidden">
        <div className="absolute top-0 right-0 h-32 w-64 bg-gradient-to-bl from-[#eef2ff] to-transparent rounded-bl-full pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-5">
            <ProjectProgressRing progress={progress} size={88} stroke={7} tone={ringTone} />
            <div>
              <p className="text-xs font-mono font-semibold text-zinc-400 tracking-tight mb-1">
                {project.code}
              </p>
              <h1 className="text-2xl font-bold text-zinc-900">Your Artwork Project</h1>
              <div className="flex items-center gap-4 mt-2 flex-wrap">
                <p className="text-sm text-zinc-600">
                  <span className="font-semibold text-zinc-900 tabular-nums">{deliveredCount}</span>
                  <span className="text-zinc-400"> of </span>
                  <span className="font-semibold text-zinc-900 tabular-nums">
                    {project.deliverableItems.length}
                  </span>
                  {' items delivered'}
                </p>
                {project.deadline && (
                  <p className="text-sm text-zinc-500 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Due{' '}
                    {new Date(project.deadline).toLocaleDateString('en-MY', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                )}
              </div>
            </div>
          </div>

          {allDelivered && !isSigned && (
            <Link
              href={`/portal/${projectId}/fa`}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#4f46e5] to-[#6366f1] px-5 py-2.5 text-sm font-semibold text-white hover:from-[#4338ca] hover:to-[#4f46e5] transition-colors shadow-lg shadow-[#4f46e5]/30"
            >
              <FileSignature className="h-4 w-4" />
              Sign Final Artwork
            </Link>
          )}
        </div>

        {/* Reviews pending callout */}
        {reviewsPending > 0 && (
          <div className="relative mt-4 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 flex items-center gap-3">
            <Sparkles className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs font-semibold text-amber-800">
              {reviewsPending} item{reviewsPending > 1 ? 's are' : ' is'} ready for your review below.
            </p>
          </div>
        )}
      </div>

      {/* Horizontal timeline */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 mb-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-700 mb-5">Project Progress</h2>
        <HorizontalTimeline steps={timelineSteps} />
      </div>

      {/* Items */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-700">
            Your Artwork Items ({project.deliverableItems.length})
          </h2>
          {reviewsPending > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
              <AlertTriangle className="h-3 w-3" />
              {reviewsPending} awaiting review
            </span>
          )}
        </div>
        {project.deliverableItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-center">
            <p className="text-sm text-zinc-400">No items added yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {project.deliverableItems.map((item) => (
              <ItemCard key={item.id} item={item} projectId={project.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
