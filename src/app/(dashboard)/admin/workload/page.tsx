'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FolderOpen,
  Loader2,
  RefreshCw,
  User2,
  Users,
  Zap,
  Bot,
  ChevronDown,
  ChevronUp,
  Calendar,
  BarChart2,
  Circle,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeliverableItem {
  id: string
  description: string | null
  itemType: string
  status: string
  deadline: string | null
  estimatedMinutes: number | null
  projectCode: string
  clientName: string
  assignedDesignerName: string | null
  assignedDesignerRole: string | null
  paymentStatus: string | null
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const PAYMENT_STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  HALF_PAID:  { label: 'Half Paid', cls: 'text-lime-400 bg-lime-500/10 border-lime-500/20' },
  FULL_PAID:  { label: 'Full Paid', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  PAID:       { label: 'Paid',      cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  BILLED:     { label: 'Billed',    cls: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  STARTED:    { label: 'Started',   cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  PENDING:    { label: 'Pending',   cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
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

function getProjectProgressColor(pct: number): string {
  if (pct >= 80) return 'bg-emerald-500'
  if (pct >= 50) return 'bg-[#6366f1]'
  if (pct >= 20) return 'bg-yellow-500'
  return 'bg-zinc-600'
}

function getDaysRemainingBadge(days: number | null): React.ReactElement {
  if (days === null) return <span className="text-xs text-zinc-600">No deadline</span>
  if (days < 0)
    return (
      <span className="text-xs font-medium text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
        {Math.abs(days)}d overdue
      </span>
    )
  if (days === 0)
    return (
      <span className="text-xs font-medium text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
        Due today
      </span>
    )
  if (days <= 3)
    return (
      <span className="text-xs font-medium text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded">
        {days}d left
      </span>
    )
  return (
    <span className="text-xs text-zinc-500">{days}d left</span>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  accent?: 'red' | 'yellow' | 'purple' | 'green'
}) {
  const accentClasses = {
    red: 'border-red-500/30 bg-red-500/5',
    yellow: 'border-yellow-500/30 bg-yellow-500/5',
    purple: 'border-[#6366f1]/30 bg-[#6366f1]/5',
    green: 'border-emerald-500/30 bg-emerald-500/5',
  }
  const iconClasses = {
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

  // Unique projects this designer is working on
  const projects = Array.from(
    new Map(designer.tasks.map(t => [t.projectCode, t.clientName])).entries()
  )

  return (
    <div
      className={`rounded-xl border transition-colors ${
        designer.isOverloaded
          ? 'border-red-500/40 bg-red-500/5'
          : 'border-zinc-800/60 bg-zinc-900/40'
      }`}
    >
      {/* Header */}
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
              <p className="text-sm font-semibold text-zinc-100 truncate">{designer.name}</p>
              <p className="text-xs text-zinc-500">{ROLE_LABELS[designer.role] ?? designer.role}</p>
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

        {/* Utilization bar */}
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

        {/* Metrics row */}
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

        {/* Project assignment — always visible */}
        {projects.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {projects.map(([code, client]) => (
              <span
                key={code}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/50"
                title={client ?? code}
              >
                <span className="font-mono text-[#818cf8]">{code}</span>
                {client && <span className="text-zinc-500 max-w-[80px] truncate">· {client}</span>}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Expand toggle */}
      {designer.tasks.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-between border-t border-zinc-800/60 px-4 py-2 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30 transition-colors"
          >
            <span>View tasks</span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {expanded && (
            <div className="border-t border-zinc-800/60 divide-y divide-zinc-800/40">
              {designer.tasks.map((task) => (
                <div key={task.id} className="flex items-start gap-2.5 px-4 py-2.5">
                  <span className="mt-0.5 flex-shrink-0 text-[10px] font-medium text-zinc-600 bg-zinc-800 rounded px-1 py-0.5">
                    {ITEM_TYPE_LABELS[task.itemType] ?? task.itemType}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-zinc-300 truncate">
                      {task.description ?? task.itemType}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px] font-mono font-medium text-[#818cf8]">
                        {task.projectCode}
                      </span>
                      {task.clientName && (
                        <span className="text-[10px] text-zinc-500 truncate">
                          · {task.clientName}
                        </span>
                      )}
                      {task.deadline && (
                        <span className="text-[10px] text-zinc-600">
                          · {formatDeadline(task.deadline)}
                        </span>
                      )}
                    </div>
                  </div>
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
          No active tasks
        </div>
      )}
    </div>
  )
}

function ProjectCard({ project }: { project: ProjectTimeline }) {
  const [expanded, setExpanded] = useState(false)
  const pct = project.completionPercent

  // Build role assignment summary for this project
  const roleAssignments = new Map<string, string[]>()
  for (const d of project.deliverables) {
    if (d.assignedDesignerRole && d.assignedDesignerName) {
      const role = ROLE_LABELS[d.assignedDesignerRole] ?? d.assignedDesignerRole
      if (!roleAssignments.has(role)) roleAssignments.set(role, [])
      const names = roleAssignments.get(role)!
      if (!names.includes(d.assignedDesignerName)) names.push(d.assignedDesignerName)
    }
  }
  const unassignedCount = project.deliverables.filter(d => !d.assignedDesignerName).length

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-mono font-medium text-[#818cf8]">
                {project.projectCode}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  project.status === 'ONGOING'
                    ? 'text-blue-400 bg-blue-500/10'
                    : project.status === 'COMPLETED'
                    ? 'text-green-400 bg-green-500/10'
                    : 'text-zinc-500 bg-zinc-800'
                }`}
              >
                {project.status}
              </span>
            </div>
            <p className="text-sm font-medium text-zinc-200 truncate">{project.clientName}</p>
          </div>
          <div className="flex-shrink-0 ml-2">
            {getDaysRemainingBadge(project.daysRemaining)}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-zinc-500">Progress</span>
            <span className="font-medium text-zinc-300">{pct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-zinc-800">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${getProjectProgressColor(pct)}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Role assignment summary */}
        {(roleAssignments.size > 0 || unassignedCount > 0) && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {Array.from(roleAssignments.entries()).map(([role, names]) => (
              <span
                key={role}
                className="inline-flex items-center gap-1 text-[10px] font-medium rounded px-1.5 py-0.5 bg-[#6366f1]/10 text-[#818cf8] border border-[#6366f1]/20"
                title={names.join(', ')}
              >
                {role}: {names.join(', ')}
              </span>
            ))}
            {unassignedCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium rounded px-1.5 py-0.5 bg-orange-500/10 text-orange-400 border border-orange-500/20">
                {unassignedCount} unassigned
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{project.deliverables.length} deliverable{project.deliverables.length !== 1 ? 's' : ''}</span>
          {project.deadline && (
            <span className="flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5" />
              {new Date(project.deadline).toLocaleDateString('en-MY', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          )}
        </div>
      </div>

      {project.deliverables.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-between border-t border-zinc-800/60 px-4 py-2 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30 transition-colors"
          >
            <span>Deliverables</span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {expanded && (
            <div className="border-t border-zinc-800/60 divide-y divide-zinc-800/40">
              {project.deliverables.map((d) => {
                const payStyle = d.paymentStatus ? PAYMENT_STATUS_STYLES[d.paymentStatus] : null
                return (
                  <div key={d.id} className="px-4 py-2.5 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="flex-shrink-0 text-[10px] font-medium text-zinc-600 bg-zinc-800 rounded px-1 py-0.5">
                        {ITEM_TYPE_LABELS[d.itemType] ?? d.itemType}
                      </span>
                      <span className="flex-1 min-w-0 text-xs text-zinc-400 truncate">
                        {d.description ?? d.itemType}
                      </span>
                      <span
                        className={`flex-shrink-0 text-[10px] font-medium ${
                          STATUS_COLORS[d.status] ?? 'text-zinc-500'
                        }`}
                      >
                        {d.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pl-0.5">
                      {d.assignedDesignerName ? (
                        <span className="text-[10px] text-zinc-500">
                          <span className="text-[#818cf8]">{d.assignedDesignerName}</span>
                          {d.assignedDesignerRole && (
                            <span className="text-zinc-600"> · {ROLE_LABELS[d.assignedDesignerRole] ?? d.assignedDesignerRole}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-[10px] text-orange-400">Unassigned</span>
                      )}
                      {payStyle && (
                        <span className={`text-[10px] font-medium rounded px-1 py-0.5 border ${payStyle.cls}`}>
                          {payStyle.label}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkloadPage() {
  const { data: session } = useSession()
  const [timeline, setTimeline] = useState<CompanyTimeline | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'designers' | 'projects' | 'alerts'>('designers')
  const [mode, setMode] = useState<'AUTOPILOT' | 'COPILOT' | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)

    try {
      const [timelineRes, settingsRes] = await Promise.all([
        fetch('/api/admin/workload'),
        fetch('/api/admin/settings'),
      ])

      if (!timelineRes.ok) throw new Error('Failed to load workload data')
      const { data } = await timelineRes.json()
      setTimeline(data)

      if (settingsRes.ok) {
        const { data: settings } = await settingsRes.json()
        setMode(settings.autopilotMode ? 'AUTOPILOT' : 'COPILOT')
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
    // Auto-refresh every 2 minutes
    const interval = setInterval(() => void load(true), 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [load])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
        <p className="text-sm text-zinc-500">Loading company workload...</p>
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

  // Sort designers: overloaded first, then by utilization desc
  const sortedDesigners = [...timeline.designerWorkload].sort((a, b) => {
    if (a.isOverloaded && !b.isOverloaded) return -1
    if (!a.isOverloaded && b.isOverloaded) return 1
    return b.utilizationToday - a.utilizationToday
  })

  // Sort projects: by days remaining asc (most urgent first)
  const sortedProjects = [...timeline.activeProjects].sort((a, b) => {
    if (a.daysRemaining === null) return 1
    if (b.daysRemaining === null) return -1
    return a.daysRemaining - b.daysRemaining
  })

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#818cf8]" />
            Team Workload
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Live company timeline ·{' '}
            <span className="text-zinc-600">
              Updated {new Date(timeline.generatedAt).toLocaleTimeString('en-MY', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Mode badge */}
          {mode && (
            <div
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                mode === 'AUTOPILOT'
                  ? 'border-[#6366f1]/40 bg-[#6366f1]/10 text-[#818cf8]'
                  : 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400'
              }`}
            >
              {mode === 'AUTOPILOT' ? (
                <Bot className="h-3.5 w-3.5" />
              ) : (
                <User2 className="h-3.5 w-3.5" />
              )}
              {mode === 'AUTOPILOT' ? 'Autopilot' : 'Copilot'}
            </div>
          )}

          <Link
            href="/admin/settings"
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors"
          >
            Settings
          </Link>

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
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
          icon={Users}
          label="Team Members"
          value={timeline.designerWorkload.length}
          sub={overloadedCount > 0 ? `${overloadedCount} overloaded` : 'All clear'}
          accent={overloadedCount > 0 ? 'red' : undefined}
        />
        <StatCard
          icon={AlertTriangle}
          label="Critical Deadlines"
          value={criticalCount}
          sub="Due within 3 days"
          accent={criticalCount > 0 ? 'yellow' : undefined}
        />
        <StatCard
          icon={Zap}
          label="Unassigned Tasks"
          value={unassignedCount}
          accent={unassignedCount > 0 ? 'yellow' : undefined}
        />
      </div>

      {/* Alerts strip */}
      {(overloadedCount > 0 || criticalCount > 0 || unassignedCount > 0) && (
        <div className="flex flex-wrap gap-2">
          {overloadedCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                <strong>{overloadedCount} designer{overloadedCount !== 1 ? 's' : ''}</strong> overloaded:{' '}
                {timeline.overloadedDesigners.join(', ')}
              </span>
            </div>
          )}
          {criticalCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-xs text-yellow-400">
              <Clock className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                <strong>{criticalCount} deadline{criticalCount !== 1 ? 's' : ''}</strong> critical (≤3 days)
              </span>
            </div>
          )}
          {unassignedCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 px-3 py-2 text-xs text-orange-400">
              <User2 className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                <strong>{unassignedCount} task{unassignedCount !== 1 ? 's' : ''}</strong> awaiting assignment
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-zinc-800/60">
        <div className="flex gap-0">
          {(
            [
              { key: 'designers', label: 'Designers', count: timeline.designerWorkload.length },
              { key: 'projects', label: 'Active Projects', count: timeline.activeProjects.length },
              { key: 'alerts', label: 'Alerts', count: criticalCount + unassignedCount },
            ] as const
          ).map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm transition-colors ${
                activeTab === key
                  ? 'border-[#6366f1] text-[#818cf8]'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {label}
              {count > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    activeTab === key ? 'bg-[#6366f1]/20 text-[#818cf8]' : 'bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}

      {/* ─── Designers tab ─────────────────────────────────────────────────── */}
      {activeTab === 'designers' && (
        <div>
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
      )}

      {/* ─── Projects tab ──────────────────────────────────────────────────── */}
      {activeTab === 'projects' && (
        <div>
          {sortedProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
              <FolderOpen className="h-10 w-10 mb-3" />
              <p className="text-sm">No active projects</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sortedProjects.map((project) => (
                <ProjectCard key={project.projectId} project={project} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Alerts tab ────────────────────────────────────────────────────── */}
      {activeTab === 'alerts' && (
        <div className="space-y-6">
          {/* Critical deadlines */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-400" />
              Critical Deadlines
              <span className="text-xs font-normal text-zinc-600">(due within 3 days)</span>
            </h2>

            {timeline.criticalDeadlines.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-500">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                No critical deadlines — all clear
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-800/60 overflow-hidden divide-y divide-zinc-800/60">
                {timeline.criticalDeadlines.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/20 transition-colors">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 text-yellow-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-200 truncate">
                        {d.description ?? d.itemType}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono text-[#818cf8]">{d.projectCode}</span>
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
            )}
          </div>

          {/* Unassigned tasks */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
              <User2 className="h-4 w-4 text-orange-400" />
              Unassigned Tasks
            </h2>

            {timeline.unassignedTasks.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-500">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                All tasks are assigned
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-800/60 overflow-hidden divide-y divide-zinc-800/60">
                {timeline.unassignedTasks.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/20 transition-colors">
                    <span className="flex-shrink-0 text-[10px] font-medium text-zinc-500 bg-zinc-800 rounded px-1.5 py-0.5">
                      {ITEM_TYPE_LABELS[d.itemType] ?? d.itemType}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-300 truncate">
                        {d.description ?? d.itemType}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono text-[#818cf8]">{d.projectCode}</span>
                        <span className="text-xs text-zinc-600">{d.clientName}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {d.deadline ? (
                        <span className="text-xs text-zinc-500">{formatDeadline(d.deadline)}</span>
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
            )}
          </div>
        </div>
      )}
    </div>
  )
}
