/**
 * /cs/workload
 *
 * CS-focused designer capacity dashboard. Mirrors /admin/workload but drops the
 * admin-only controls (autopilot toggle, settings jump). CS uses this to pick
 * the least-loaded designer before assigning new work and to spot overloaded
 * teammates / critical deadlines.
 *
 * Data source: GET /api/admin/workload (CS is in ALLOWED_ROLES on that route).
 */

'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FolderOpen,
  RefreshCw,
  User2,
  Users,
  Zap,
  ChevronDown,
  ChevronUp,
  Calendar,
  BarChart2,
  Circle,
  ArrowUpRight,
} from 'lucide-react'

// ─── Types (match /api/admin/workload response) ───────────────────────────────

interface DeliverableItem {
  id: string
  description: string | null
  itemType: string
  status: string
  deadline: string | null
  estimatedMinutes: number | null
  projectCode: string
  projectId?: string
  clientName: string
  assignedDesignerName: string | null
  assignedDesignerRole: string | null
}

interface DesignerWorkload {
  userId: string
  name: string
  email: string
  role: string
  totalPendingTasks: number
  totalEstimatedMinutes: number
  utilizationToday: number
  nearestDeadline: string | null
  isOverloaded: boolean
  tasks: DeliverableItem[]
}

interface ProjectTimeline {
  projectId: string
  projectCode: string
  clientName: string
  status: string
  deadline: string | null
  deliverables: DeliverableItem[]
  completionPercent: number
  daysRemaining: number | null
}

interface CompanyTimeline {
  generatedAt: string
  activeProjects: ProjectTimeline[]
  designerWorkload: DesignerWorkload[]
  overloadedDesigners: string[]
  criticalDeadlines: DeliverableItem[]
  unassignedTasks: DeliverableItem[]
  totalPendingTasks: number
  totalEstimatedHours: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  JUNIOR_ART_DIRECTOR: 'Junior AD',
  GRAPHIC_DESIGNER: 'Graphic Designer',
  JUNIOR_DESIGNER: 'Junior Designer',
  DESIGNER_3D: '3D Designer',
  MULTIMEDIA_DESIGNER: 'Multimedia',
  DIGITAL_MARKETING: 'Digital Marketing',
  SENIOR_ART_DIRECTOR: 'Senior AD',
  CREATIVE_DIRECTOR: 'Creative Director',
  CLIENT_SERVICING: 'Client Services',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-zinc-400',
  IN_PROGRESS: 'text-blue-400',
  WIP_UPLOADED: 'text-purple-400',
  QC_REVIEW: 'text-yellow-400',
  APPROVED: 'text-green-400',
  DELIVERED: 'text-emerald-400',
  FA_SIGNED: 'text-teal-400',
  REVISION: 'text-orange-400',
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  BANNER: 'Banner',
  BROCHURE: 'Brochure',
  LOGO: 'Logo',
  SOCIAL: 'Social',
  PRINT: 'Print',
  THREE_D: '3D',
  VIDEO: 'Video',
  OTHER: 'Other',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function formatDeadline(dateStr: string | null): string {
  if (!dateStr) return 'No deadline'
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const label = d.toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })
  if (diffDays < 0) return `${label} (${Math.abs(diffDays)}d overdue)`
  if (diffDays === 0) return `${label} (today!)`
  if (diffDays === 1) return `${label} (tomorrow)`
  return `${label} (${diffDays}d left)`
}

function getUtilizationColor(pct: number): string {
  if (pct >= 90) return 'bg-red-500'
  if (pct >= 70) return 'bg-yellow-500'
  if (pct >= 40) return 'bg-[#6366f1]'
  return 'bg-emerald-500'
}

function getUtilizationTextColor(pct: number): string {
  if (pct >= 90) return 'text-red-400'
  if (pct >= 70) return 'text-yellow-400'
  return 'text-[#818cf8]'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  accent?: 'red' | 'yellow' | 'purple' | 'green'
}

function StatCard({ icon: Icon, label, value, sub, accent }: StatCardProps) {
  const accentClasses: Record<NonNullable<StatCardProps['accent']>, string> = {
    red: 'border-red-500/30 bg-red-500/5',
    yellow: 'border-yellow-500/30 bg-yellow-500/5',
    purple: 'border-[#6366f1]/30 bg-[#6366f1]/5',
    green: 'border-emerald-500/30 bg-emerald-500/5',
  }
  const iconClasses: Record<NonNullable<StatCardProps['accent']>, string> = {
    red: 'text-red-400',
    yellow: 'text-yellow-400',
    purple: 'text-[#818cf8]',
    green: 'text-emerald-400',
  }

  return (
    <div
      className={`rounded-xl border p-4 ${
        accent ? accentClasses[accent] : 'border-zinc-800/60 bg-zinc-900/40'
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-zinc-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-zinc-100">{value}</p>
          {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
        </div>
        <Icon
          className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
            accent ? iconClasses[accent] : 'text-zinc-600'
          }`}
        />
      </div>
    </div>
  )
}

function DesignerCard({ designer }: { designer: DesignerWorkload }) {
  const [expanded, setExpanded] = useState(false)
  const pct = Math.min(designer.utilizationToday, 100)

  return (
    <div
      className={`rounded-xl border transition-colors ${
        designer.isOverloaded
          ? 'border-red-500/40 bg-red-500/5'
          : 'border-zinc-800/60 bg-zinc-900/40'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
                designer.isOverloaded
                  ? 'bg-gradient-to-br from-red-500 to-orange-500'
                  : 'bg-gradient-to-br from-[#6366f1] to-[#8b5cf6]'
              }`}
            >
              {designer.name[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-100 truncate">
                {designer.name}
              </p>
              <p className="text-xs text-zinc-500">
                {ROLE_LABELS[designer.role] ?? designer.role}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {designer.isOverloaded && (
              <span className="text-xs font-medium text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                Overloaded
              </span>
            )}
            <span
              className={`text-sm font-bold tabular-nums ${getUtilizationTextColor(
                designer.utilizationToday
              )}`}
            >
              {designer.utilizationToday}%
            </span>
          </div>
        </div>

        <div className="mb-3">
          <div className="h-1.5 w-full rounded-full bg-zinc-800">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${getUtilizationColor(
                designer.utilizationToday
              )}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <Circle className="h-2.5 w-2.5" />
            {designer.totalPendingTasks} task{designer.totalPendingTasks !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {formatMinutes(designer.totalEstimatedMinutes)} est.
          </span>
          {designer.nearestDeadline && (
            <span className="flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5" />
              {new Date(designer.nearestDeadline).toLocaleDateString('en-MY', {
                day: '2-digit',
                month: 'short',
              })}
            </span>
          )}
        </div>
      </div>

      {designer.tasks.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-between border-t border-zinc-800/60 px-4 py-2 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30 transition-colors"
          >
            <span>View tasks</span>
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          {expanded && (
            <div className="border-t border-zinc-800/60 divide-y divide-zinc-800/40">
              {designer.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-2.5 px-4 py-2.5"
                >
                  <span className="mt-0.5 flex-shrink-0 text-[10px] font-medium text-zinc-600 bg-zinc-800 rounded px-1 py-0.5">
                    {ITEM_TYPE_LABELS[task.itemType] ?? task.itemType}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-zinc-300 truncate">
                      {task.description ?? task.itemType}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-medium text-zinc-600">
                        {task.projectCode}
                      </span>
                      {task.deadline && (
                        <span className="text-[10px] text-zinc-600">
                          {formatDeadline(task.deadline)}
                        </span>
                      )}
                    </div>
                  </div>
                  {task.projectId && (
                    <Link
                      href={`/cs/projects/${task.projectId}`}
                      className="flex-shrink-0 text-[#818cf8] hover:text-white"
                      title="Open project"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                  <span
                    className={`flex-shrink-0 text-[10px] font-medium ${
                      STATUS_COLORS[task.status] ?? 'text-zinc-500'
                    }`}
                  >
                    {task.status.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {designer.tasks.length === 0 && (
        <div className="border-t border-zinc-800/60 px-4 py-2.5 text-xs text-zinc-600 italic">
          No active tasks — good candidate for new work
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface IncomingProject {
  id: string
  code: string
  clientName: string
  status: string
  deadline: string | null
  updatedAt: string
  larkFolderId: string
}

export default function CSWorkloadPage() {
  const [timeline, setTimeline] = useState<CompanyTimeline | null>(null)
  const [incomingProjects, setIncomingProjects] = useState<IncomingProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)

    try {
      const [workloadRes, incomingRes] = await Promise.all([
        fetch('/api/admin/workload'),
        fetch('/api/projects/incoming'),
      ])
      if (!workloadRes.ok) throw new Error('Failed to load workload data')
      const { data }: { data: CompanyTimeline } = await workloadRes.json()
      setTimeline(data)
      if (incomingRes.ok) {
        const incomingData = await incomingRes.json()
        setIncomingProjects(incomingData.data ?? [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const interval = setInterval(() => void load(true), 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [load])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
        <p className="text-sm text-zinc-500">Loading designer capacity...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertTriangle className="h-10 w-10 text-red-500" />
        <p className="text-sm text-zinc-300">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!timeline) return null

  const overloadedCount = timeline.overloadedDesigners.length
  const criticalCount = timeline.criticalDeadlines.length
  const unassignedCount = timeline.unassignedTasks.length

  const sortedDesigners = [...timeline.designerWorkload].sort((a, b) => {
    if (a.isOverloaded && !b.isOverloaded) return -1
    if (!a.isOverloaded && b.isOverloaded) return 1
    return b.utilizationToday - a.utilizationToday
  })

  const availableDesigners = timeline.designerWorkload
    .filter((d) => !d.isOverloaded && d.utilizationToday < 70)
    .sort((a, b) => a.utilizationToday - b.utilizationToday)
    .slice(0, 3)

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#818cf8]" />
            Designer Capacity
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Pick the right designer before assigning new work ·{' '}
            <span className="text-zinc-600">
              Updated{' '}
              {new Date(timeline.generatedAt).toLocaleTimeString('en-MY', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={Users}
          label="Team Members"
          value={timeline.designerWorkload.length}
          sub={overloadedCount > 0 ? `${overloadedCount} overloaded` : 'All clear'}
          accent={overloadedCount > 0 ? 'red' : 'green'}
        />
        <StatCard
          icon={FolderOpen}
          label="Active Projects"
          value={timeline.activeProjects.length}
          accent="purple"
        />
        <StatCard
          icon={BarChart2}
          label="Pending Tasks"
          value={timeline.totalPendingTasks}
          sub={`${timeline.totalEstimatedHours}h est.`}
        />
        <StatCard
          icon={Zap}
          label="Unassigned"
          value={unassignedCount}
          accent={unassignedCount > 0 ? 'yellow' : 'green'}
        />
      </div>

      {/* Alerts */}
      {(overloadedCount > 0 || criticalCount > 0 || unassignedCount > 0) && (
        <div className="flex flex-wrap gap-2">
          {overloadedCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                <strong>
                  {overloadedCount} designer{overloadedCount !== 1 ? 's' : ''}
                </strong>{' '}
                overloaded — avoid assigning new work: {timeline.overloadedDesigners.join(', ')}
              </span>
            </div>
          )}
          {criticalCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-xs text-yellow-400">
              <Clock className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                <strong>
                  {criticalCount} deadline{criticalCount !== 1 ? 's' : ''}
                </strong>{' '}
                critical (≤3 days)
              </span>
            </div>
          )}
          {unassignedCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 px-3 py-2 text-xs text-orange-400">
              <User2 className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                <strong>
                  {unassignedCount} task{unassignedCount !== 1 ? 's' : ''}
                </strong>{' '}
                awaiting assignment
              </span>
            </div>
          )}
        </div>
      )}

      {/* Best candidates for new work */}
      {availableDesigners.length > 0 && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <h2 className="text-sm font-semibold text-emerald-300 mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Best candidates for new work
          </h2>
          <div className="flex flex-wrap gap-2">
            {availableDesigners.map((d) => (
              <span
                key={d.userId}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-1.5 text-xs"
              >
                <span className="text-zinc-200 font-medium">{d.name}</span>
                <span className="text-zinc-500">
                  ({ROLE_LABELS[d.role] ?? d.role})
                </span>
                <span className="text-emerald-400 font-semibold tabular-nums">
                  {d.utilizationToday}%
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Designers grid */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-[#818cf8]" />
          All Designers
        </h2>
        {sortedDesigners.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
            <Users className="h-10 w-10 mb-3" />
            <p className="text-sm">No active team members found</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedDesigners.map((designer) => (
              <DesignerCard key={designer.userId} designer={designer} />
            ))}
          </div>
        )}
      </div>

      {/* Critical deadlines */}
      {timeline.criticalDeadlines.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-400" />
            Critical Deadlines
            <span className="text-xs font-normal text-zinc-600">(≤3 days)</span>
          </h2>
          <div className="rounded-xl border border-zinc-800/60 overflow-hidden divide-y divide-zinc-800/60">
            {timeline.criticalDeadlines.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/20 transition-colors"
              >
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-yellow-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-200 truncate">
                    {d.description ?? d.itemType}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono text-[#818cf8]">
                      {d.projectCode}
                    </span>
                    <span className="text-xs text-zinc-600">{d.clientName}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-xs font-medium text-yellow-400">
                    {d.deadline ? formatDeadline(d.deadline) : '—'}
                  </span>
                  <span className="text-[10px] text-zinc-600">
                    {d.assignedDesignerName ?? (
                      <span className="text-orange-400">Unassigned</span>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lark projects awaiting task setup */}
      {incomingProjects.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-indigo-400" />
            Needs Setup
            <span className="rounded-full bg-indigo-500/15 border border-indigo-500/25 px-1.5 py-0.5 text-[10px] font-medium text-indigo-400">
              {incomingProjects.length} from Lark
            </span>
          </h2>
          <p className="text-xs text-zinc-600 mb-3">
            These projects were synced from Lark group chats but have no deliverable items yet. Add tasks to assign work to designers.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {incomingProjects.map((proj) => {
              const daysAgo = Math.floor((Date.now() - new Date(proj.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
              return (
                <div
                  key={proj.id}
                  className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-semibold text-[#818cf8]">{proj.code}</span>
                    <span className="text-[10px] text-zinc-600">
                      {daysAgo === 0 ? 'synced today' : `${daysAgo}d ago`}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-zinc-200 truncate">{proj.clientName}</p>
                  {proj.deadline && (
                    <p className="text-[10px] text-zinc-600">
                      Deadline: {new Date(proj.deadline).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                  <a
                    href={`/cs/projects/${proj.id}`}
                    className="inline-flex items-center gap-1 rounded-md bg-indigo-500/15 border border-indigo-500/25 px-2 py-1 text-[11px] font-medium text-indigo-300 hover:bg-indigo-500/25 transition-colors"
                  >
                    <ArrowUpRight className="h-3 w-3" />
                    Set up project
                  </a>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Unassigned tasks */}
      {timeline.unassignedTasks.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
            <User2 className="h-4 w-4 text-orange-400" />
            Unassigned Tasks
          </h2>
          <div className="rounded-xl border border-zinc-800/60 overflow-hidden divide-y divide-zinc-800/60">
            {timeline.unassignedTasks.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/20 transition-colors"
              >
                <span className="flex-shrink-0 text-[10px] font-medium text-zinc-500 bg-zinc-800 rounded px-1.5 py-0.5">
                  {ITEM_TYPE_LABELS[d.itemType] ?? d.itemType}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-300 truncate">
                    {d.description ?? d.itemType}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono text-[#818cf8]">
                      {d.projectCode}
                    </span>
                    <span className="text-xs text-zinc-600">{d.clientName}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {d.deadline ? (
                    <span className="text-xs text-zinc-500">
                      {formatDeadline(d.deadline)}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-700">No deadline</span>
                  )}
                  <span
                    className={`text-[10px] font-medium ${
                      STATUS_COLORS[d.status] ?? 'text-zinc-500'
                    }`}
                  >
                    {d.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
