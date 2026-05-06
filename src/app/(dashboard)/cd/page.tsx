'use client'

import { useEffect, useState } from 'react'
import {
  Layers,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Users,
  ArrowRight,
  RotateCcw,
  Zap,
  FileText,
  Eye,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProjectStatus = 'PROJECTED' | 'ONGOING' | 'COMPLETED' | 'BILLED' | 'PAID'
type DeliverableStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'WIP_UPLOADED'
  | 'QC_REVIEW'
  | 'APPROVED'
  | 'DELIVERED'
  | 'FA_SIGNED'
type ItemType =
  | 'BANNER'
  | 'BROCHURE'
  | 'LOGO'
  | 'SOCIAL'
  | 'PRINT'
  | 'THREE_D'
  | 'VIDEO'
  | 'OTHER'

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
  status: DeliverableStatus
  estimatedMinutes: number | null
  deadline: string | null
  assignedDesigner: AssignedUser | null
  revisions: Revision[]
}

interface Project {
  id: string
  code: string
  status: ProjectStatus
  quotedAmount: number
  deadline: string | null
  brief: Brief | null
  deliverableItems: DeliverableItem[]
  assignedCS: AssignedUser | null
  csAssignments: Array<{ user: { id: string; name: string } }>
  client: { id: string; companyName: string; contactPerson: string } | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  BANNER: 'Banner',
  BROCHURE: 'Brochure',
  LOGO: 'Logo / Branding',
  SOCIAL: 'Social Media',
  PRINT: 'Print',
  THREE_D: '3D',
  VIDEO: 'Video',
  OTHER: 'Other',
}

const STATUS_CONFIG: Record<DeliverableStatus, { label: string; color: string }> = {
  PENDING:      { label: 'Pending',     color: 'text-zinc-400 bg-zinc-800/60' },
  IN_PROGRESS:  { label: 'In Progress', color: 'text-blue-400 bg-blue-500/10' },
  WIP_UPLOADED: { label: 'WIP Upload',  color: 'text-violet-400 bg-violet-500/10' },
  QC_REVIEW:    { label: 'QC Review',   color: 'text-amber-400 bg-amber-500/10' },
  APPROVED:     { label: 'Approved',    color: 'text-emerald-400 bg-emerald-500/10' },
  DELIVERED:    { label: 'Delivered',   color: 'text-teal-400 bg-teal-500/10' },
  FA_SIGNED:    { label: 'FA Signed',   color: 'text-green-400 bg-green-500/10' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getProjectHealth(
  project: Project
): 'at_risk' | 'needs_attention' | 'on_track' {
  const items = project.deliverableItems
  const hasOverdue = items.some(
    (i) =>
      i.deadline &&
      new Date(i.deadline) < new Date() &&
      !['APPROVED', 'DELIVERED', 'FA_SIGNED'].includes(i.status)
  )
  if (hasOverdue) return 'at_risk'
  const hasPendingRevision = items.some((i) =>
    i.revisions?.some((r) => r.status === 'PENDING')
  )
  if (hasPendingRevision) return 'needs_attention'
  return 'on_track'
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-MY', {
    day: '2-digit',
    month: 'short',
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: number
  sub: string
  color: string
}

function StatCard({ label, value, sub, color }: StatCardProps) {
  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
      <p className="mb-1 text-[11px] uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="mt-1 text-[11px] text-zinc-600">{sub}</p>
    </div>
  )
}

function BriefChainRow({ project }: { project: Project }) {
  const stage = project.brief?.completedByCSAt ? 'cs_done' : 'cs_drafting'
  const items = project.deliverableItems
  const unassigned = items.filter(
    (i) => !i.assignedDesigner && i.status === 'PENDING'
  ).length
  const inRevision = items.filter((i) =>
    i.revisions?.some((r) => r.status === 'PENDING')
  ).length

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      {/* CS node */}
      <div
        className={`flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium ${
          stage === 'cs_done'
            ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
            : 'border-amber-500/25 bg-amber-500/10 text-amber-400'
        }`}
      >
        {stage === 'cs_done' ? (
          <CheckCircle2 className="h-3 w-3" />
        ) : (
          <Clock className="h-3 w-3" />
        )}
        CS Brief {stage === 'cs_done' ? 'Done' : 'Drafting'}
      </div>

      <ArrowRight className="h-3 w-3 flex-shrink-0 text-zinc-700" />

      {/* CD node */}
      <div
        className={`flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium ${
          stage === 'cs_done'
            ? 'border-indigo-500/30 bg-indigo-500/15 text-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.15)]'
            : 'border-zinc-700/40 bg-zinc-800/60 text-zinc-500'
        }`}
      >
        <Zap className="h-3 w-3" />
        CD {stage === 'cs_done' ? '← Your turn' : 'Waiting'}
      </div>

      <ArrowRight className="h-3 w-3 flex-shrink-0 text-zinc-700" />

      {/* AD node */}
      <div
        className={`flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium ${
          unassigned > 0
            ? 'border-orange-500/25 bg-orange-500/10 text-orange-400'
            : 'border-zinc-700/40 bg-zinc-800/60 text-zinc-500'
        }`}
      >
        <Users className="h-3 w-3" />
        AD {unassigned > 0 ? `${unassigned} to assign` : 'Assigned'}
      </div>

      <ArrowRight className="h-3 w-3 flex-shrink-0 text-zinc-700" />

      {/* Designer node */}
      <div className="flex items-center gap-1 rounded-full border border-zinc-700/40 bg-zinc-800/60 px-2.5 py-1 font-medium text-zinc-500">
        <Layers className="h-3 w-3" />
        Designer {inRevision > 0 ? `(${inRevision} revision)` : ''}
      </div>
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const [expanded, setExpanded] = useState(false)
  const health = getProjectHealth(project)
  const items = project.deliverableItems
  const done = items.filter((i) =>
    ['APPROVED', 'DELIVERED', 'FA_SIGNED'].includes(i.status)
  ).length
  const itemsInRevision = items.filter((i) =>
    i.revisions?.some((r) => r.status === 'PENDING')
  )
  const completionPct = items.length > 0 ? Math.round((done / items.length) * 100) : 0

  return (
    <div
      className={`rounded-xl border transition-colors ${
        health === 'at_risk'
          ? 'border-red-500/30 bg-red-500/5'
          : health === 'needs_attention'
          ? 'border-amber-500/20 bg-amber-500/5'
          : 'border-zinc-800/60 bg-zinc-900/40'
      }`}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-[#818cf8]">
              {project.code}
            </span>
            {project.client && (
              <span className="truncate text-sm font-semibold text-zinc-200">
                {project.client.companyName}
              </span>
            )}
            {health === 'at_risk' && (
              <span className="flex items-center gap-1 rounded-full border border-red-500/25 bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                <AlertTriangle className="h-2.5 w-2.5" /> Overdue
              </span>
            )}
            {health === 'needs_attention' && (
              <span className="flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                <RotateCcw className="h-2.5 w-2.5" /> Revision pending
              </span>
            )}
          </div>

          <BriefChainRow project={project} />

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-zinc-600">
            <span>
              {items.length} deliverable{items.length !== 1 ? 's' : ''}
            </span>
            <span>
              {done}/{items.length} done
            </span>
            {project.assignedCS && (
              <span>CS: {project.assignedCS.name}</span>
            )}
            {project.deadline && (
              <span>Due {formatDate(project.deadline)}</span>
            )}
            {project.brief?.priority &&
              project.brief.priority !== 'NORMAL' && (
                <span
                  className={`font-semibold ${
                    project.brief.priority === 'RUSH'
                      ? 'text-red-400'
                      : project.brief.priority === 'HIGH'
                      ? 'text-amber-400'
                      : 'text-zinc-400'
                  }`}
                >
                  {project.brief.priority}
                </span>
              )}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-bold text-zinc-300">
              {completionPct}%
            </div>
            <div className="text-[10px] text-zinc-600">complete</div>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-zinc-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          )}
        </div>
      </button>

      {/* Progress bar */}
      <div className="mx-4 mb-3 h-1 rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] transition-all"
          style={{ width: `${completionPct}%` }}
        />
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-zinc-800/60">
          {/* Brief from CS */}
          {project.brief?.completedByCSAt && (
            <div className="space-y-2 border-b border-zinc-800/40 bg-zinc-900/60 p-4">
              <div className="mb-2 flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-xs font-semibold text-zinc-300">
                  Brief from CS
                </span>
                <span className="text-[10px] text-zinc-600">
                  Completed {formatDate(project.brief.completedByCSAt)}
                </span>
              </div>
              {project.brief.packageType && (
                <div className="text-xs">
                  <span className="text-zinc-600">Package: </span>
                  <span className="text-zinc-300">
                    {project.brief.packageType}
                  </span>
                </div>
              )}
              {project.brief.styleNotes && (
                <div className="text-xs">
                  <span className="text-zinc-600">Style: </span>
                  <span className="text-zinc-300">
                    {project.brief.styleNotes}
                  </span>
                </div>
              )}
              {project.brief.specialInstructions && (
                <div className="text-xs">
                  <span className="text-zinc-600">Instructions: </span>
                  <span className="text-zinc-300">
                    {project.brief.specialInstructions}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Pending revisions needing CD direction */}
          {itemsInRevision.length > 0 && (
            <div className="space-y-2 border-b border-zinc-800/40 bg-amber-500/5 p-4">
              <div className="mb-2 flex items-center gap-2">
                <RotateCcw className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-amber-400">
                  Pending Revisions — needs your direction
                </span>
              </div>
              {itemsInRevision.map((item) => {
                const rev = item.revisions?.find((r) => r.status === 'PENDING')
                return rev ? (
                  <div
                    key={item.id}
                    className="rounded-md border border-amber-500/20 bg-amber-500/8 px-3 py-2"
                  >
                    <div className="mb-1 text-xs font-semibold text-zinc-300">
                      {ITEM_TYPE_LABELS[item.itemType]}
                      {item.assignedDesigner && (
                        <span className="ml-1 font-normal text-zinc-500">
                          · {item.assignedDesigner.name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-amber-200/80">
                      Rev #{rev.revisionNumber}: {rev.feedback}
                    </p>
                  </div>
                ) : null
              })}
            </div>
          )}

          {/* Deliverables */}
          <div className="p-4 space-y-2">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Deliverables
            </p>
            {items.length === 0 ? (
              <p className="py-4 text-center text-xs text-zinc-700">
                No deliverables set up yet
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((item) => {
                  const sc = STATUS_CONFIG[item.status]
                  const isOverdue =
                    item.deadline &&
                    new Date(item.deadline) < new Date() &&
                    !['APPROVED', 'DELIVERED', 'FA_SIGNED'].includes(
                      item.status
                    )
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-xs ${
                        isOverdue
                          ? 'border-red-500/25 bg-red-500/5'
                          : 'border-zinc-800/50 bg-zinc-900/60'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="font-medium text-zinc-200">
                          {ITEM_TYPE_LABELS[item.itemType]}
                          {item.quantity > 1 && (
                            <span className="ml-1.5 text-zinc-500">
                              ×{item.quantity}
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <div className="text-[11px] text-zinc-600">
                            {item.description}
                          </div>
                        )}
                      </div>

                      {/* Designer assignment */}
                      <div className="flex min-w-[80px] items-center gap-1.5">
                        {item.assignedDesigner ? (
                          <>
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/15 text-[9px] font-bold text-violet-400">
                              {item.assignedDesigner.name[0]}
                            </div>
                            <span className="text-[11px] text-zinc-400">
                              {item.assignedDesigner.name}
                            </span>
                          </>
                        ) : (
                          <span className="text-[11px] italic text-zinc-700">
                            Unassigned
                          </span>
                        )}
                      </div>

                      {/* Revision count */}
                      <div className="flex min-w-[50px] items-center gap-1 text-zinc-600">
                        <RotateCcw className="h-3 w-3" />
                        <span>
                          {item.revisionCount}/{item.revisionLimit}
                        </span>
                      </div>

                      {/* Deadline */}
                      {item.deadline && (
                        <span
                          className={`min-w-[60px] text-[11px] ${
                            isOverdue
                              ? 'font-semibold text-red-400'
                              : 'text-zinc-600'
                          }`}
                        >
                          {formatDate(item.deadline)}
                        </span>
                      )}

                      {/* Status */}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${sc.color}`}
                      >
                        {sc.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 px-4 pb-4">
            <a
              href={`/cs/projects/${project.id}`}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700/50 bg-zinc-800/60 px-3 py-1.5 text-xs text-zinc-400 transition-all hover:border-zinc-600 hover:text-zinc-200"
            >
              <Eye className="h-3 w-3" /> View Project
            </a>
            <a
              href={`/cs/projects/${project.id}/brief`}
              className="flex items-center gap-1.5 rounded-lg border border-indigo-700/40 bg-indigo-500/8 px-3 py-1.5 text-xs text-indigo-400 transition-all hover:bg-indigo-500/15"
            >
              <FileText className="h-3 w-3" /> Open Brief
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'needs_brief' | 'in_revision' | 'at_risk'

const FILTERS: Array<{ key: FilterKey; label: (counts: Record<string, number>) => string }> = [
  { key: 'all',          label: (c) => `All (${c.total})` },
  { key: 'needs_brief',  label: (c) => `No Brief Yet (${c.noBrief})` },
  { key: 'in_revision',  label: (c) => `In Revision (${c.inRevision})` },
  { key: 'at_risk',      label: (c) => `At Risk (${c.atRisk})` },
]

export default function CDDashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('all')

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((d) =>
        setProjects(
          ((d.data ?? []) as Project[]).filter((p) =>
            ['ONGOING', 'PROJECTED'].includes(p.status)
          )
        )
      )
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const briefReady  = projects.filter((p) => p.brief?.completedByCSAt).length
  const noBrief     = projects.filter((p) => !p.brief?.completedByCSAt).length
  const inRevision  = projects.filter((p) =>
    p.deliverableItems.some((i) => i.revisions?.some((r) => r.status === 'PENDING'))
  ).length
  const atRisk      = projects.filter((p) => getProjectHealth(p) === 'at_risk').length
  const unassigned  = projects
    .flatMap((p) => p.deliverableItems)
    .filter((i) => !i.assignedDesigner && i.status === 'PENDING').length

  const counts = {
    total: projects.length,
    noBrief,
    inRevision,
    atRisk,
  }

  const filtered = projects.filter((p) => {
    if (filter === 'needs_brief') return !p.brief?.completedByCSAt
    if (filter === 'in_revision')
      return p.deliverableItems.some((i) =>
        i.revisions?.some((r) => r.status === 'PENDING')
      )
    if (filter === 'at_risk') return getProjectHealth(p) === 'at_risk'
    return true
  })

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">
          Creative Director Dashboard
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Brief chain overview — CS briefs you, you direct AD, AD assigns
          Designer
        </p>
      </div>

      {/* Brief chain rule banner */}
      <div className="flex items-center gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 text-xs text-indigo-300">
        <ArrowRight className="h-4 w-4 flex-shrink-0 text-indigo-500" />
        <span>
          <strong className="text-indigo-200">Brief chain rule: </strong>
          CS briefs you (CD only) → You direct AD → AD assigns Designer →
          Designer produces → Internal review loop → Presentation
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Active Projects"
          value={projects.length}
          sub="ongoing + projected"
          color="text-zinc-200"
        />
        <StatCard
          label="Brief Ready"
          value={briefReady}
          sub="CS completed brief"
          color="text-emerald-400"
        />
        <StatCard
          label="Needs Direction"
          value={noBrief}
          sub="awaiting CS brief"
          color="text-amber-400"
        />
        <StatCard
          label="In Revision"
          value={inRevision}
          sub="pending your decision"
          color="text-red-400"
        />
      </div>

      {/* Secondary stats */}
      <div className="flex flex-wrap gap-3">
        <div className="rounded-lg border border-zinc-800/50 bg-zinc-900/40 px-3 py-2 text-xs">
          <span className="text-zinc-500">Unassigned deliverables: </span>
          <span className="font-semibold text-orange-400">{unassigned}</span>
        </div>
        {atRisk > 0 && (
          <div className="rounded-lg border border-red-500/25 bg-red-500/8 px-3 py-2 text-xs">
            <span className="text-zinc-500">At risk (overdue): </span>
            <span className="font-semibold text-red-400">{atRisk}</span>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
              filter === f.key
                ? 'border-[#6366f1]/40 bg-[#6366f1]/15 text-[#818cf8]'
                : 'border-zinc-800 bg-transparent text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
            }`}
          >
            {f.label(counts)}
          </button>
        ))}
      </div>

      {/* Project cards */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center">
            <Layers className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
            <p className="text-sm text-zinc-600">
              No projects match this filter
            </p>
          </div>
        ) : (
          filtered.map((p) => <ProjectCard key={p.id} project={p} />)
        )}
      </div>
    </div>
  )
}
