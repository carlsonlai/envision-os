'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  Palette,
  Clock,
  AlertTriangle,
  RotateCcw,
  Users,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  ArrowRight,
  FileText,
  UserCheck,
} from 'lucide-react'

/* ───────── Types ───────── */

type ProjectStatus = 'PROJECTED' | 'ONGOING' | 'COMPLETED' | 'BILLED' | 'PAID'
type ItemStatus    = 'PENDING' | 'IN_PROGRESS' | 'WIP_UPLOADED' | 'QC_REVIEW' | 'APPROVED' | 'DELIVERED' | 'FA_SIGNED'
type ItemType      = 'BANNER' | 'BROCHURE' | 'LOGO' | 'SOCIAL' | 'PRINT' | 'THREE_D' | 'VIDEO' | 'OTHER'
type BriefStage    = 'CS_DRAFTING' | 'CD_REVIEW' | 'AD_DIRECTING' | 'DESIGNER_ASSIGNED' | 'DONE'

interface AssignedUser {
  id: string
  name: string
  role: string
}

interface Revision {
  id: string
  revisionNumber: number
  status: string
  feedback: string
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
  assignedDesigner?: AssignedUser | null
  revisions?: Revision[]
}

interface Brief {
  briefStage: BriefStage | null
  packageType: string | null
  styleNotes: string | null
  specialInstructions: string | null
  completedByCSAt: string | null
  sentToCDAt: string | null
  sentToADAt: string | null
}

interface Project {
  id: string
  code: string
  status: ProjectStatus
  deadline: string | null
  client?: { companyName: string; contactPerson: string }
  deliverableItems: DeliverableItem[]
  brief?: Brief | null
  assignedCD?: AssignedUser | null
  assignedAD?: AssignedUser | null
}

/* ───────── Helpers ───────── */

const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  BANNER: 'Banner', BROCHURE: 'Brochure', LOGO: 'Logo',   SOCIAL: 'Social',
  PRINT: 'Print',   THREE_D: '3D',        VIDEO: 'Video', OTHER: 'Other',
}

const ITEM_STATUS_COLORS: Record<ItemStatus, string> = {
  PENDING:        'text-zinc-400 bg-zinc-800/60 border-zinc-700/40',
  IN_PROGRESS:    'text-blue-400 bg-blue-500/10 border-blue-500/20',
  WIP_UPLOADED:   'text-violet-400 bg-violet-500/10 border-violet-500/20',
  QC_REVIEW:      'text-amber-400 bg-amber-500/10 border-amber-500/20',
  APPROVED:       'text-teal-400 bg-teal-500/10 border-teal-500/20',
  DELIVERED:      'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  FA_SIGNED:      'text-green-400 bg-green-500/10 border-green-500/20',
}

const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  PENDING: 'Pending', IN_PROGRESS: 'In Progress', WIP_UPLOADED: 'WIP Uploaded',
  QC_REVIEW: 'QC Review', APPROVED: 'Approved', DELIVERED: 'Delivered', FA_SIGNED: 'FA Signed',
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-MY', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function deadlineStatus(deadline: string | null): 'overdue' | 'soon' | 'ok' | 'none' {
  if (!deadline) return 'none'
  const d     = new Date(deadline)
  const now   = new Date()
  const diff  = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0)  return 'overdue'
  if (diff <= 3) return 'soon'
  return 'ok'
}

function getProjectHealth(project: Project): 'at_risk' | 'needs_attention' | 'on_track' {
  const items = project.deliverableItems ?? []
  const ds    = deadlineStatus(project.deadline)
  if (ds === 'overdue') return 'at_risk'
  const pendingRevisions = items.filter(
    i => i.revisions && i.revisions.some(r => r.status === 'PENDING')
  ).length
  if (pendingRevisions > 0 || ds === 'soon') return 'needs_attention'
  return 'on_track'
}

function HealthBadge({ health }: { health: 'at_risk' | 'needs_attention' | 'on_track' }) {
  if (health === 'at_risk') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
        <AlertTriangle className="w-2.5 h-2.5" />
        At Risk
      </span>
    )
  }
  if (health === 'needs_attention') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
        <Clock className="w-2.5 h-2.5" />
        Needs Attention
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
      <CheckCircle2 className="w-2.5 h-2.5" />
      On Track
    </span>
  )
}

/* ───────── ProjectCard ───────── */

function ProjectCard({ project }: { project: Project }) {
  const [expanded, setExpanded] = useState(false)
  const health   = getProjectHealth(project)
  const ds       = deadlineStatus(project.deadline)
  const items    = project.deliverableItems ?? []
  const brief    = project.brief

  const pendingItems    = items.filter(i => i.status === 'PENDING').length
  const inProgressItems = items.filter(i => ['IN_PROGRESS', 'WIP_UPLOADED'].includes(i.status)).length
  const doneItems       = items.filter(i => ['APPROVED', 'DELIVERED', 'FA_SIGNED'].includes(i.status)).length
  const pendingRevItems = items.filter(
    i => i.revisions && i.revisions.some(r => r.status === 'PENDING')
  ).length

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      health === 'at_risk'
        ? 'border-red-500/30 bg-red-500/5'
        : health === 'needs_attention'
        ? 'border-amber-500/20 bg-zinc-900/40'
        : 'border-zinc-800/60 bg-zinc-900/40'
    }`}>
      {/* Card header */}
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-sm font-semibold text-indigo-300">{project.code}</span>
              <HealthBadge health={health} />
              {ds === 'overdue' && (
                <span className="text-[10px] text-red-400 font-medium">
                  Deadline overdue
                </span>
              )}
              {ds === 'soon' && (
                <span className="text-[10px] text-amber-400 font-medium">
                  Due soon
                </span>
              )}
            </div>
            <p className="text-base font-semibold text-zinc-100">
              {project.client?.companyName ?? '—'}
            </p>
            <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
              {project.deadline && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(project.deadline)}
                </span>
              )}
              {project.assignedCD && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  CD: {project.assignedCD.name}
                </span>
              )}
            </div>
          </div>

          {/* Item counts */}
          <div className="flex items-center gap-3 text-xs">
            {pendingRevItems > 0 && (
              <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-400 font-bold">{pendingRevItems}</span>
                <span className="text-amber-400/60 text-[9px]">Revisions</span>
              </div>
            )}
            <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700/40">
              <Palette className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-zinc-200 font-bold">{items.length}</span>
              <span className="text-zinc-500 text-[9px]">Items</span>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="p-2 rounded-lg hover:bg-zinc-800/60 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Brief summary (if available) */}
        {brief?.packageType && (
          <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3 text-indigo-400" />
              <span className="text-zinc-400">{brief.packageType}</span>
            </span>
            {brief.sentToADAt && (
              <span>Brief received {formatDate(brief.sentToADAt)}</span>
            )}
          </div>
        )}

        {/* Item progress bar */}
        {items.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] text-zinc-600 mb-1">
              <span>{doneItems}/{items.length} items complete</span>
              <span>{Math.round((doneItems / items.length) * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden flex gap-0.5">
              {doneItems > 0 && (
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${(doneItems / items.length) * 100}%` }}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Expanded deliverables table */}
      {expanded && items.length > 0 && (
        <div className="border-t border-zinc-800/60">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800/40">
                <th className="text-left px-5 py-2 text-zinc-500 font-medium">Item</th>
                <th className="text-left px-4 py-2 text-zinc-500 font-medium">Status</th>
                <th className="text-left px-4 py-2 text-zinc-500 font-medium">Designer</th>
                <th className="text-left px-4 py-2 text-zinc-500 font-medium">Revisions</th>
                <th className="text-left px-4 py-2 text-zinc-500 font-medium">Deadline</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const ds2    = deadlineStatus(item.deadline)
                const hasRev = item.revisions && item.revisions.some(r => r.status === 'PENDING')
                return (
                  <tr
                    key={item.id}
                    className={`border-b border-zinc-800/30 ${hasRev ? 'bg-amber-500/5' : ''}`}
                  >
                    <td className="px-5 py-2.5">
                      <span className="text-zinc-300 font-medium">
                        {ITEM_TYPE_LABELS[item.itemType]}
                        {item.quantity > 1 && (
                          <span className="text-zinc-500 ml-1">×{item.quantity}</span>
                        )}
                      </span>
                      {item.description && (
                        <p className="text-zinc-600 text-[10px] truncate max-w-[180px] mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${ITEM_STATUS_COLORS[item.status]}`}>
                        {ITEM_STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {item.assignedDesigner ? (
                        <div className="flex items-center gap-1 text-zinc-300">
                          <UserCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span className="truncate max-w-[100px]">{item.assignedDesigner.name}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-600 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        {hasRev && <RotateCcw className="w-3 h-3 text-amber-400" />}
                        <span className={hasRev ? 'text-amber-400 font-medium' : 'text-zinc-500'}>
                          {item.revisionCount}/{item.revisionLimit}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={
                        ds2 === 'overdue' ? 'text-red-400 font-medium' :
                        ds2 === 'soon'    ? 'text-amber-400 font-medium' :
                        'text-zinc-400'
                      }>
                        {formatDate(item.deadline)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Action footer */}
          <div className="px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Circle className={`w-2 h-2 ${pendingItems > 0 ? 'text-zinc-500' : 'text-zinc-700'}`} />
              <span>{pendingItems} pending</span>
              <span className="text-zinc-700">·</span>
              <Circle className={`w-2 h-2 ${inProgressItems > 0 ? 'text-blue-400' : 'text-zinc-700'}`} />
              <span>{inProgressItems} in progress</span>
              <span className="text-zinc-700">·</span>
              <CheckCircle2 className={`w-2 h-2 ${doneItems > 0 ? 'text-emerald-400' : 'text-zinc-700'}`} />
              <span>{doneItems} done</span>
            </div>
            <Link
              href={`/cs/projects/${project.id}`}
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              View Project
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

/* ───────── Main Page ───────── */

type FilterTab = 'all' | 'pending_direction' | 'in_revision' | 'at_risk'

export default function ADDashboardPage() {
  const { data: session } = useSession()
  const [projects, setProjects]   = useState<Project[]>([])
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  const fetchProjects = useCallback(async () => {
    try {
      const res  = await fetch('/api/projects')
      if (!res.ok) throw new Error()
      const json = await res.json()

      // Enrich each project with brief stage data
      const raw: Project[] = json.data ?? []
      const enriched = await Promise.all(
        raw.map(async (p) => {
          try {
            const [briefRes, itemsRes] = await Promise.all([
              fetch(`/api/projects/${p.id}/brief`),
              fetch(`/api/projects/${p.id}/items`),
            ])
            const briefJson = briefRes.ok ? await briefRes.json() : null
            const itemsJson = itemsRes.ok ? await itemsRes.json() : null
            return {
              ...p,
              brief: briefJson?.data ?? null,
              deliverableItems: itemsJson?.data ?? p.deliverableItems ?? [],
            }
          } catch {
            return p
          }
        })
      )

      setProjects(enriched)
    } catch {
      // silent fail — empty state shown
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  /* ── Filter to AD-relevant projects ── */
  const userId = session?.user?.id
  const userRole = session?.user?.role

  const adProjects = projects.filter(p => {
    // AD sees projects assigned to them OR projects in AD_DIRECTING stage
    const stage = p.brief?.briefStage
    const isADStage = stage === 'AD_DIRECTING' || stage === 'DESIGNER_ASSIGNED' || stage === 'DONE'
    const isAssigned = p.assignedAD?.id === userId

    // SENIOR_ART_DIRECTOR sees all AD-stage projects; JUNIOR_ART_DIRECTOR sees assigned only
    if (userRole === 'SENIOR_ART_DIRECTOR') {
      return isADStage || isAssigned
    }
    return isAssigned
  }).filter(p => ['ONGOING', 'PROJECTED'].includes(p.status))

  /* ── Stats ── */
  const totalProjects   = adProjects.length
  const pendingDir      = adProjects.filter(p => p.brief?.briefStage === 'AD_DIRECTING').length
  const inRevision      = adProjects.filter(p =>
    (p.deliverableItems ?? []).some(i =>
      (i.revisions ?? []).some(r => r.status === 'PENDING')
    )
  ).length
  const atRisk          = adProjects.filter(p => getProjectHealth(p) === 'at_risk').length

  /* ── Tab filter ── */
  const filtered = adProjects.filter(p => {
    if (activeTab === 'pending_direction') return p.brief?.briefStage === 'AD_DIRECTING'
    if (activeTab === 'in_revision')       return (p.deliverableItems ?? []).some(i =>
      (i.revisions ?? []).some(r => r.status === 'PENDING')
    )
    if (activeTab === 'at_risk')           return getProjectHealth(p) === 'at_risk'
    return true
  })

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all',               label: 'All',             count: totalProjects },
    { key: 'pending_direction', label: 'Needs Direction', count: pendingDir },
    { key: 'in_revision',       label: 'In Revision',     count: inRevision },
    { key: 'at_risk',           label: 'At Risk',          count: atRisk },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100">
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <Palette className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-zinc-100">Art Direction</h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                {session?.user?.name ?? 'Art Director'} · {totalProjects} active project{totalProjects !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Brief chain rule reminder */}
        <div className="mb-6 rounded-xl border border-zinc-700/40 bg-zinc-900/40 px-5 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="text-zinc-600">CS</span>
            <ArrowRight className="w-3 h-3 text-zinc-700" />
            <span className="text-zinc-600">CD</span>
            <ArrowRight className="w-3 h-3 text-zinc-700" />
            <span className="font-semibold text-violet-300">AD ← You are here</span>
            <ArrowRight className="w-3 h-3 text-zinc-700" />
            <span className="text-zinc-600">Designer</span>
          </div>
          <p className="text-xs text-zinc-500 ml-auto">
            Receive briefs from CD · Direct designers · Escalate to CD if needed
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Active Projects',    value: totalProjects, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
                { label: 'Needs Direction',    value: pendingDir,    color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
                { label: 'In Revision',        value: inRevision,    color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' },
                { label: 'At Risk',            value: atRisk,        color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20' },
              ].map(stat => (
                <div key={stat.label} className={`rounded-xl border p-4 ${stat.bg}`}>
                  <p className="text-xs text-zinc-500 mb-1">{stat.label}</p>
                  <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 mb-5 border-b border-zinc-800/60 pb-0">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                    activeTab === tab.key
                      ? 'border-indigo-400 text-indigo-300 bg-indigo-500/10'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      activeTab === tab.key ? 'bg-indigo-500/30 text-indigo-300' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Project cards */}
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 p-16 text-center">
                <Palette className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-500 text-sm">
                  {activeTab === 'all'
                    ? 'No projects assigned to AD yet. Waiting for CD to send briefs.'
                    : 'No projects match this filter.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map(project => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
