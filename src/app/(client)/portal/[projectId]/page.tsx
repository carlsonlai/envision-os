'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MessageSquare,
  RotateCcw,
  Download,
  FileSignature,
} from 'lucide-react'

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

const ITEM_STATUS_CONFIG: Record<ItemStatus, { label: string; color: string; icon: React.ElementType }> = {
  PENDING: { label: 'Not Started', color: 'text-zinc-500 bg-zinc-100', icon: Clock },
  IN_PROGRESS: { label: 'In Design', color: 'text-blue-600 bg-blue-50', icon: Clock },
  WIP_UPLOADED: { label: 'Under Review', color: 'text-violet-600 bg-violet-50', icon: Clock },
  QC_REVIEW: { label: 'Quality Check', color: 'text-amber-600 bg-amber-50', icon: Clock },
  APPROVED: { label: 'Approved', color: 'text-teal-600 bg-teal-50', icon: CheckCircle2 },
  DELIVERED: { label: 'Ready for Review', color: 'text-orange-600 bg-orange-50', icon: AlertTriangle },
  FA_SIGNED: { label: 'Final Signed', color: 'text-emerald-600 bg-emerald-50', icon: CheckCircle2 },
}

function RevisionProgressBar({ used, limit }: { used: number; limit: number }) {
  const percent = Math.min(100, (used / limit) * 100)
  const remaining = limit - used

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500 flex items-center gap-1">
          <RotateCcw className="h-3 w-3" />
          Revisions
        </span>
        <span className={`font-medium ${remaining <= 1 ? 'text-red-500' : 'text-zinc-600'}`}>
          {used}/{limit} used ({remaining} remaining)
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            percent >= 100 ? 'bg-red-400' : percent >= 80 ? 'bg-amber-400' : 'bg-[#6366f1]'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

function ItemCard({ item, projectId }: { item: DeliverableItem; projectId: string }) {
  const statusConfig = ITEM_STATUS_CONFIG[item.status]
  const StatusIcon = statusConfig.icon
  const latestVersion = item.fileVersions[0] ?? null
  const isDelivered = item.status === 'DELIVERED'
  const canAnnotate = isDelivered && latestVersion

  return (
    <div
      className={`rounded-2xl border bg-white overflow-hidden transition-shadow hover:shadow-md ${
        isDelivered ? 'border-amber-200' : 'border-zinc-200'
      }`}
    >
      {/* Action banner for items needing review */}
      {isDelivered && (
        <div className="flex items-center gap-2 bg-amber-50 border-b border-amber-200 px-4 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-xs font-medium text-amber-700">Your review needed</span>
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-semibold text-zinc-900">
              {ITEM_TYPE_LABELS[item.itemType]}
              {item.quantity > 1 && (
                <span className="ml-1.5 text-sm text-zinc-400">×{item.quantity}</span>
              )}
            </h3>
            {item.description && (
              <p className="text-xs text-zinc-500 mt-0.5">{item.description}</p>
            )}
          </div>
          <div
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium flex-shrink-0 ${statusConfig.color}`}
          >
            <StatusIcon className="h-3 w-3" />
            {statusConfig.label}
          </div>
        </div>

        {/* Latest file preview */}
        {latestVersion && (
          <div className="mb-3 rounded-lg border border-zinc-100 overflow-hidden bg-zinc-50">
            {/\.(jpg|jpeg|png|gif|webp|svg|avif)$/i.test(latestVersion.filename) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={latestVersion.url}
                alt={latestVersion.filename}
                className="w-full h-32 object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-20">
                <span className="text-3xl">
                  {latestVersion.filename.match(/\.pdf$/i) ? '📄' : '📁'}
                </span>
              </div>
            )}
            <div className="px-3 py-2 border-t border-zinc-100">
              <p className="text-xs text-zinc-500 truncate">
                v{latestVersion.version} — {latestVersion.filename}
              </p>
            </div>
          </div>
        )}

        {/* Revision bar */}
        <div className="mb-4">
          <RevisionProgressBar used={item.revisionCount} limit={item.revisionLimit} />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {canAnnotate && (
            <Link
              href={`/portal/${projectId}/annotate/${item.id}`}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[#4f46e5] hover:text-white bg-[#eef2ff] hover:bg-[#4f46e5] border border-[#c7d2fe] hover:border-[#4f46e5] transition-all"
            >
              <MessageSquare className="h-4 w-4" />
              Review &amp; Annotate
            </Link>
          )}
          {isDelivered && (
            <Link
              href={`/portal/${projectId}/annotate/${item.id}?approve=1`}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-500 hover:text-white border border-emerald-200 hover:border-emerald-500 transition-all"
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve
            </Link>
          )}
          {latestVersion && !isDelivered && (
            <a
              href={latestVersion.url}
              download={latestVersion.filename}
              className="flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 border border-zinc-200 transition-all"
            >
              <Download className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
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
    load()
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
    (i) => i.status === 'DELIVERED' || i.status === 'FA_SIGNED'
  ).length
  const allDelivered =
    project.deliverableItems.length > 0 &&
    project.deliverableItems.every((i) => i.status === 'DELIVERED' || i.status === 'FA_SIGNED')

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Back nav */}
      <Link
        href="/portal"
        className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        My Projects
      </Link>

      {/* Project header */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 mb-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-mono text-zinc-400 mb-1">{project.code}</p>
            <h1 className="text-xl font-bold text-zinc-900">Your Artwork Project</h1>
            {project.deadline && (
              <p className="text-sm text-zinc-500 mt-1 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Deadline:{' '}
                {new Date(project.deadline).toLocaleDateString('en-MY', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <p className="text-2xl font-bold text-zinc-900">
                {deliveredCount}/{project.deliverableItems.length}
              </p>
              <p className="text-xs text-zinc-500">items delivered</p>
            </div>

            {allDelivered && (
              <Link
                href={`/portal/${projectId}/fa`}
                className="flex items-center gap-2 rounded-xl bg-[#4f46e5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4338ca] transition-colors shadow-lg shadow-[#4f46e5]/30"
              >
                <FileSignature className="h-4 w-4" />
                Sign Final Artwork
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Items */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-700 mb-4">
          Your Artwork Items ({project.deliverableItems.length})
        </h2>
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

      {/* Timeline milestones */}
      <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-700 mb-4">Project Progress</h2>
        <ol className="relative space-y-4">
          {[
            { label: 'Project initiated', done: true },
            {
              label: 'Design in progress',
              done: project.deliverableItems.some((i) => i.status !== 'PENDING'),
            },
            {
              label: 'Artwork delivered for review',
              done: project.deliverableItems.some((i) =>
                ['DELIVERED', 'FA_SIGNED'].includes(i.status)
              ),
            },
            { label: 'All artwork approved', done: allDelivered },
            { label: 'Final Artwork signed', done: project.status === 'COMPLETED' || project.status === 'BILLED' || project.status === 'PAID' },
          ].map((step, idx) => (
            <li key={idx} className="flex items-center gap-3">
              <div
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  step.done
                    ? 'bg-[#4f46e5] text-white'
                    : 'bg-zinc-100 text-zinc-400 border border-zinc-200'
                }`}
              >
                {step.done ? '✓' : idx + 1}
              </div>
              <span className={`text-sm ${step.done ? 'text-zinc-800 font-medium' : 'text-zinc-400'}`}>
                {step.label}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
