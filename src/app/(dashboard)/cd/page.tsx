'use client'

import { useEffect, useState } from 'react'
import {
  Users,
  AlertTriangle,
  Clock,
  Zap,
  MessageSquare,
  RotateCcw,
  CheckCircle2,
  FileText,
} from 'lucide-react'

interface DesignerCapacity {
  user: {
    id: string
    name: string
    email: string
    role: string
  }
  slots: Array<{
    committedMinutes: number
    capacityMinutes: number
    utilizationPercent: number
  }>
  averageUtilization: number
}

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
  itemType: string
  description: string | null
  status: string
  deadline: string | null
  assignedDesignerId: string | null
  assignedDesigner: AssignedUser | null
  revisions: Revision[]
}

interface Project {
  id: string
  code: string
  status: string
  deadline: string | null
  deliverableItems: DeliverableItem[]
  brief: Brief | null
  assignedCS: AssignedUser | null
}

const ROLE_LABELS: Record<string, string> = {
  JUNIOR_ART_DIRECTOR: 'Junior AD',
  GRAPHIC_DESIGNER: 'Graphic Designer',
  JUNIOR_DESIGNER: 'Junior Designer',
  DESIGNER_3D: '3D Designer',
  DIGITAL_MARKETING: 'Digital Mktg',
  SENIOR_ART_DIRECTOR: 'Senior AD',
  CREATIVE_DIRECTOR: 'Creative Director',
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  BANNER: 'Banner', BROCHURE: 'Brochure', LOGO: 'Logo', SOCIAL: 'Social',
  PRINT: 'Print', THREE_D: '3D', VIDEO: 'Video', OTHER: 'Other',
}

function UtilBar({ percent }: { percent: number }) {
  const color =
    percent >= 90 ? 'from-red-500 to-red-600' : percent >= 70 ? 'from-amber-400 to-amber-500' : 'from-[#6366f1] to-[#8b5cf6]'
  const textColor = percent >= 90 ? 'text-red-400' : percent >= 70 ? 'text-amber-400' : 'text-zinc-300'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className={`font-semibold tabular-nums ${textColor}`}>{percent}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
        <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`} style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
    </div>
  )
}

function isAtRisk(deadline: string | null, status: string): boolean {
  if (!deadline) return false
  const dl = new Date(deadline)
  const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
  return dl <= soon && status === 'PENDING'
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function CDPage() {
  const [team, setTeam] = useState<DesignerCapacity[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [workloadRes, projectsRes] = await Promise.all([
          fetch('/api/workload'),
          fetch('/api/projects'),
        ])
        const workloadData = await workloadRes.json()
        const projectsData = await projectsRes.json()
        setTeam(workloadData.data ?? [])
        setProjects(projectsData.data ?? [])
      } catch (error) {
        console.error('Failed to load CD data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const activeProjects = projects.filter((p) => p.status === 'ONGOING')

  const atRiskItems = projects.flatMap((p) =>
    (p.deliverableItems ?? [])
      .filter((item) => isAtRisk(item.deadline, item.status))
      .map((item) => ({ ...item, projectCode: p.code }))
  )

  // All pending revisions across projects (feedback that needs designer action)
  const pendingRevisions = projects.flatMap((p) =>
    (p.deliverableItems ?? []).flatMap((item) =>
      (item.revisions ?? [])
        .filter((r) => r.status === 'PENDING')
        .map((r) => ({
          ...r,
          itemType: item.itemType,
          itemDescription: item.description,
          projectCode: p.code,
          projectId: p.id,
        }))
    )
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Projects with QC-approved briefs
  const recentBriefUpdates = projects
    .filter((p) => p.brief && p.brief.qualityGatePassed === true)
    .sort((a, b) => new Date(b.brief!.completedByCSAt ?? 0).getTime() - new Date(a.brief!.completedByCSAt ?? 0).getTime())
    .slice(0, 5)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Creative Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {team.length} designer{team.length !== 1 ? 's' : ''} · {activeProjects.length} active project{activeProjects.length !== 1 ? 's' : ''}
          {pendingRevisions.length > 0 && (
            <span className="ml-2 rounded-full bg-amber-500/15 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
              {pendingRevisions.length} revision{pendingRevisions.length !== 1 ? 's' : ''} pending
            </span>
          )}
        </p>
      </div>

      {/* Pending Revision Feedback banner */}
      {pendingRevisions.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-amber-300">Client Feedback Pending Designer Action</h2>
            <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">{pendingRevisions.length}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {pendingRevisions.slice(0, 6).map((rev) => (
              <div key={rev.id} className="rounded-lg border border-amber-500/20 bg-zinc-900/60 p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-semibold text-[#818cf8]">{rev.projectCode}</span>
                    <span className="text-[10px] text-zinc-500">· {ITEM_TYPE_LABELS[rev.itemType] ?? rev.itemType}</span>
                    {rev.itemDescription && <span className="text-[10px] text-zinc-600 truncate max-w-[100px]">{rev.itemDescription}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <RotateCcw className="h-2.5 w-2.5 text-amber-400" />
                    <span className="text-[10px] text-amber-400">Rev #{rev.revisionNumber}</span>
                  </div>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed line-clamp-2">{rev.feedback}</p>
                <span className="text-[10px] text-zinc-600">{timeAgo(rev.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Team workload board */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#818cf8]" />
            <h2 className="text-sm font-semibold text-zinc-200">Team Workload</h2>
          </div>

          {team.length === 0 ? (
            <p className="text-sm text-zinc-600 text-center py-8">No team data available</p>
          ) : (
            <div className="space-y-3">
              {team.map((member) => (
                <div
                  key={member.user.id}
                  className={`rounded-lg border p-3 space-y-2 ${
                    member.averageUtilization >= 90
                      ? 'border-red-500/30 bg-red-500/5'
                      : 'border-zinc-800/40 bg-zinc-800/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#6366f1]/15 text-[#818cf8] text-xs font-semibold flex-shrink-0">
                        {member.user.name[0]}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-zinc-200">{member.user.name}</p>
                        <p className="text-[10px] text-zinc-600">{ROLE_LABELS[member.user.role] ?? member.user.role}</p>
                      </div>
                    </div>
                    {member.averageUtilization >= 90 && (
                      <span className="flex items-center gap-1 rounded-full bg-red-500/15 border border-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Overloaded
                      </span>
                    )}
                  </div>
                  <UtilBar percent={member.averageUtilization} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* At-risk items */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-zinc-200">At Risk</h2>
              <span className="rounded-full bg-amber-500/15 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                {atRiskItems.length}
              </span>
            </div>
            {atRiskItems.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center py-4">No at-risk items</p>
            ) : (
              <div className="space-y-2">
                {atRiskItems.map((item) => (
                  <div key={item.id} className="rounded-lg border border-amber-500/20 bg-zinc-900/60 p-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-[#818cf8]">{item.projectCode}</span>
                      <span className="text-[10px] text-amber-400">
                        {item.deadline
                          ? new Date(item.deadline).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })
                          : 'No deadline'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      {ITEM_TYPE_LABELS[item.itemType] ?? item.itemType}
                      {item.description && <span className="text-zinc-600"> · {item.description}</span>}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active projects with brief status */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#818cf8]" />
              <h2 className="text-sm font-semibold text-zinc-200">Active Projects</h2>
              <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
                {activeProjects.length}
              </span>
            </div>
            {activeProjects.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center py-4">No active projects</p>
            ) : (
              <div className="space-y-2">
                {activeProjects.slice(0, 8).map((project) => {
                  const totalItems = project.deliverableItems?.length ?? 0
                  const doneItems = project.deliverableItems?.filter(
                    (i) => ['APPROVED', 'DELIVERED', 'FA_SIGNED'].includes(i.status)
                  ).length ?? 0
                  const pendingRevs = project.deliverableItems?.reduce(
                    (sum, i) => sum + (i.revisions?.filter((r) => r.status === 'PENDING').length ?? 0), 0
                  ) ?? 0
                  const hasBrief = !!project.brief?.qualityGatePassed

                  return (
                    <div key={project.id} className="rounded-md border border-zinc-800/60 bg-zinc-800/20 p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-semibold text-[#818cf8]">{project.code}</span>
                        <div className="flex items-center gap-1.5">
                          {pendingRevs > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
                              <RotateCcw className="h-2.5 w-2.5" />
                              {pendingRevs}
                            </span>
                          )}
                          {hasBrief && (
                            <span className="flex items-center gap-0.5 text-[10px] text-emerald-400">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Brief
                            </span>
                          )}
                          {project.deadline && (
                            <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              {new Date(project.deadline).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </div>
                      </div>
                      {totalItems > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full bg-zinc-700 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#6366f1]"
                              style={{ width: `${totalItems > 0 ? (doneItems / totalItems) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-zinc-600 flex-shrink-0">{doneItems}/{totalItems}</span>
                        </div>
                      )}
                      {/* Team: CS + designers */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {project.assignedCS && (
                          <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                            <div className="h-3.5 w-3.5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[7px] font-bold text-emerald-400 flex-shrink-0">{project.assignedCS.name[0]}</div>
                            {project.assignedCS.name}
                          </span>
                        )}
                        {Array.from(new Set(
                          project.deliverableItems
                            ?.filter(i => i.assignedDesigner)
                            .map(i => i.assignedDesigner!.name)
                        )).slice(0, 3).map(name => (
                          <span key={name} className="flex items-center gap-1 text-[10px] text-zinc-500">
                            <div className="h-3.5 w-3.5 rounded-full bg-[#6366f1]/15 flex items-center justify-center text-[7px] font-bold text-[#818cf8] flex-shrink-0">{name[0]}</div>
                            {name}
                          </span>
                        ))}
                      </div>
                      {project.brief?.styleNotes && (
                        <p className="text-[10px] text-zinc-600 leading-relaxed line-clamp-1 flex items-center gap-1">
                          <FileText className="h-2.5 w-2.5 flex-shrink-0" />
                          {project.brief.styleNotes}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Recent brief updates */}
          {recentBriefUpdates.length > 0 && (
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#818cf8]" />
                <h2 className="text-sm font-semibold text-zinc-200">Approved Briefs</h2>
              </div>
              <div className="space-y-2">
                {recentBriefUpdates.map((project) => (
                  <div key={project.id} className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-[#818cf8]">{project.code}</span>
                    <div className="text-right">
                      {project.brief?.styleNotes && (
                        <p className="text-[10px] text-zinc-500 truncate max-w-[140px]">{project.brief.styleNotes}</p>
                      )}
                      {project.brief?.completedByCSAt && (
                        <span className="text-[10px] text-zinc-700">{timeAgo(project.brief.completedByCSAt)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
