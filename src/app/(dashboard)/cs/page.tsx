'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  Zap,
  Plus,
  X,
  LayoutGrid,
  List,
} from 'lucide-react'

type ProjectStatus = 'PROJECTED' | 'ONGOING' | 'COMPLETED' | 'BILLED' | 'PAID'
type ViewMode = 'board' | 'list'

interface Project {
  id: string
  code: string
  status: ProjectStatus
  quotedAmount: number
  billedAmount: number
  paidAmount: number
  deadline: string | null
  client?: { companyName: string; contactPerson: string; email: string }
  updatedAt: string
}

interface PipelineColumn {
  status: ProjectStatus
  label: string
  icon: React.ElementType
  accent: string
  borderColor: string
  bgColor: string
  textColor: string
  dropHighlight: string
}

const COLUMNS: PipelineColumn[] = [
  {
    status: 'PROJECTED',
    label: 'Projected',
    icon: Clock,
    accent: 'text-zinc-400',
    borderColor: 'border-zinc-700/60',
    bgColor: 'bg-zinc-800/30',
    textColor: 'text-zinc-400',
    dropHighlight: 'ring-2 ring-zinc-400/50 bg-zinc-800/60',
  },
  {
    status: 'ONGOING',
    label: 'Ongoing',
    icon: Zap,
    accent: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    bgColor: 'bg-blue-500/5',
    textColor: 'text-blue-300',
    dropHighlight: 'ring-2 ring-blue-400/50 bg-blue-500/10',
  },
  {
    status: 'COMPLETED',
    label: 'Completed',
    icon: AlertTriangle,
    accent: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    bgColor: 'bg-amber-500/5',
    textColor: 'text-amber-300',
    dropHighlight: 'ring-2 ring-amber-400/50 bg-amber-500/10',
  },
  {
    status: 'BILLED',
    label: 'Billed',
    icon: FileText,
    accent: 'text-violet-400',
    borderColor: 'border-violet-500/30',
    bgColor: 'bg-violet-500/5',
    textColor: 'text-violet-300',
    dropHighlight: 'ring-2 ring-violet-400/50 bg-violet-500/10',
  },
  {
    status: 'PAID',
    label: 'Paid',
    icon: CheckCircle2,
    accent: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    bgColor: 'bg-emerald-500/5',
    textColor: 'text-emerald-300',
    dropHighlight: 'ring-2 ring-emerald-400/50 bg-emerald-500/10',
  },
]

function formatRM(amount: number): string {
  return `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function isOverdue(deadline: string | null): boolean {
  if (!deadline) return false
  return new Date(deadline) < new Date()
}

interface ProjectCardProps {
  project: Project
  showAlert?: boolean
  onDragStart: (id: string) => void
  isDragging: boolean
}

function ProjectCard({ project, showAlert, onDragStart, isDragging }: ProjectCardProps) {
  const overdue = isOverdue(project.deadline)

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', project.id)
        onDragStart(project.id)
      }}
      onDragEnd={() => onDragStart('')}
      className={`rounded-lg border p-3 space-y-2 transition-all duration-150 cursor-grab active:cursor-grabbing select-none ${
        isDragging
          ? 'opacity-40 scale-95'
          : 'hover:border-zinc-600/60'
      } ${
        showAlert
          ? 'border-red-500/30 bg-red-500/5'
          : overdue
          ? 'border-amber-500/20 bg-amber-500/5'
          : 'border-zinc-800/60 bg-zinc-900/40'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/cs/projects/${project.id}`}
          className="text-xs font-mono font-semibold text-[#818cf8] hover:text-[#a5b4fc] transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {project.code}
        </Link>
        {(showAlert || overdue) && (
          <AlertTriangle className="h-3 w-3 text-red-400 flex-shrink-0" />
        )}
      </div>
      {project.client && (
        <p className="text-xs text-zinc-300 font-medium truncate">{project.client.companyName}</p>
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">
          {formatRM(project.quotedAmount)}
        </span>
        {project.deadline && (
          <span className={`text-[10px] ${overdue ? 'text-red-400' : 'text-zinc-600'}`}>
            {overdue ? 'Overdue' : new Date(project.deadline).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
      <div className="flex gap-1.5">
        <Link
          href={`/cs/projects/${project.id}`}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/60 transition-colors border border-zinc-700/40"
        >
          <FileText className="h-2.5 w-2.5" />
          Open
        </Link>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="cursor-pointer flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/60 transition-colors border border-zinc-700/40"
        >
          <MessageSquare className="h-2.5 w-2.5" />
          Message
        </button>
      </div>
    </div>
  )
}

export default function CSPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewProject, setShowNewProject] = useState(false)
  const [clients, setClients] = useState<{ id: string; companyName: string }[]>([])
  const [newProject, setNewProject] = useState({ clientId: '', status: 'PROJECTED', quotedAmount: '', deadline: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [view, setView] = useState<ViewMode>('board')

  // Drag state
  const [draggingId, setDraggingId] = useState<string>('')
  const [overCol, setOverCol] = useState<ProjectStatus | null>(null)
  const dragCounters = useRef<Partial<Record<ProjectStatus, number>>>({})

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch('/api/projects')
        const data = await res.json()
        setProjects(data.data ?? [])
      } catch (error: unknown) {
        void error
      } finally {
        setLoading(false)
      }
    }
    loadProjects()
  }, [])

  async function loadClients() {
    try {
      const res = await fetch('/api/crm/clients')
      const data = await res.json()
      setClients(data.data ?? [])
    } catch {}
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: newProject.clientId || undefined,
          status: newProject.status,
          quotedAmount: newProject.quotedAmount ? Number(newProject.quotedAmount) : 0,
          deadline: newProject.deadline ? new Date(newProject.deadline).toISOString() : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create project')
      setShowNewProject(false)
      setNewProject({ clientId: '', status: 'PROJECTED', quotedAmount: '', deadline: '' })
      router.refresh()
      const updated = await fetch('/api/projects')
      const updatedData = await updated.json()
      setProjects(updatedData.data ?? [])
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  async function handleDrop(targetStatus: ProjectStatus) {
    if (!draggingId || !overCol) return
    const project = projects.find(p => p.id === draggingId)
    if (!project || project.status === targetStatus) {
      setDraggingId('')
      setOverCol(null)
      return
    }

    // Optimistic update
    const prev = projects
    setProjects(ps => ps.map(p => p.id === draggingId ? { ...p, status: targetStatus } : p))
    setDraggingId('')
    setOverCol(null)
    dragCounters.current = {}

    try {
      const res = await fetch(`/api/projects/${draggingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      })
      if (!res.ok) throw new Error('Failed')
    } catch {
      // Revert on error
      setProjects(prev)
    }
  }

  const byStatus = (status: ProjectStatus) =>
    projects.filter((p) => p.status === status)

  const columnTotal = (status: ProjectStatus) =>
    byStatus(status).reduce((sum, p) => sum + p.quotedAmount, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-5 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Billing Pipeline</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {projects.length} project{projects.length !== 1 ? 's' : ''} across all stages
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-800/60 p-0.5">
            <button
              type="button"
              onClick={() => setView('board')}
              title="Board view"
              className={`rounded-md p-1.5 transition-colors ${view === 'board' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              title="List view"
              className={`rounded-md p-1.5 transition-colors ${view === 'list' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
          <button type="button"
            onClick={() => { setShowNewProject(true); loadClients() }}
            className="flex items-center gap-2 rounded-lg bg-[#6366f1] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#5558e3] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Project
          </button>
        </div>
      </div>

      {/* New Project Modal */}
      {showNewProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-[#0d0d14] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-zinc-100">New Project</h2>
              <button type="button" onClick={() => setShowNewProject(false)} className="text-zinc-500 hover:text-zinc-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Client</label>
                <select
                  value={newProject.clientId}
                  onChange={e => setNewProject(p => ({ ...p, clientId: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 focus:border-[#6366f1] focus:outline-none"
                >
                  <option value="">— No client yet —</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.companyName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Status</label>
                <select
                  value={newProject.status}
                  onChange={e => setNewProject(p => ({ ...p, status: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 focus:border-[#6366f1] focus:outline-none"
                >
                  <option value="PROJECTED">Projected</option>
                  <option value="ONGOING">Ongoing</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Quoted Amount (RM)</label>
                <input
                  type="number"
                  min="0"
                  value={newProject.quotedAmount}
                  onChange={e => setNewProject(p => ({ ...p, quotedAmount: e.target.value }))}
                  placeholder="0"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-[#6366f1] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Deadline</label>
                <input
                  type="date"
                  value={newProject.deadline}
                  onChange={e => setNewProject(p => ({ ...p, deadline: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 focus:border-[#6366f1] focus:outline-none"
                />
              </div>
              {createError && <p className="text-xs text-red-400">{createError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowNewProject(false)} className="flex-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">Cancel</button>
                <button type="submit" disabled={creating} className="cursor-pointer flex-1 rounded-lg bg-[#6366f1] px-3 py-2 text-sm font-medium text-white hover:bg-[#5558e3] disabled:opacity-50 transition-colors">
                  {creating ? 'Creating…' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List view */}
      {view === 'list' && (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[minmax(0,1fr)_140px_160px_100px_100px] gap-2 px-4 py-2.5 bg-zinc-800/60 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 border-b border-zinc-800">
            <span>Project</span>
            <span>Status</span>
            <span>Client</span>
            <span className="text-right">Quoted</span>
            <span>Deadline</span>
          </div>
          {projects.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-600">No projects yet</div>
          ) : (
            projects.map(p => {
              const overdue = isOverdue(p.deadline)
              const colMap: Record<ProjectStatus, { label: string; cls: string }> = {
                PROJECTED: { label: 'Projected', cls: 'bg-zinc-700/50 text-zinc-400' },
                ONGOING:   { label: 'Ongoing',   cls: 'bg-blue-500/15 text-blue-400 border border-blue-500/30' },
                COMPLETED: { label: 'Completed', cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
                BILLED:    { label: 'Billed',    cls: 'bg-violet-500/15 text-violet-400 border border-violet-500/30' },
                PAID:      { label: 'Paid',      cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
              }
              const { label, cls } = colMap[p.status]
              return (
                <div
                  key={p.id}
                  className="grid grid-cols-[minmax(0,1fr)_140px_160px_100px_100px] gap-2 px-4 py-3 border-b border-zinc-800/60 hover:bg-zinc-800/20 items-center transition-colors"
                >
                  <Link href={`/cs/projects/${p.id}`} className="font-mono text-xs font-semibold text-[#818cf8] hover:text-[#a5b4fc] transition-colors">
                    {p.code}
                  </Link>
                  <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold w-fit ${cls}`}>{label}</span>
                  <span className="text-xs text-zinc-400 truncate">{p.client?.companyName ?? '—'}</span>
                  <span className="text-xs text-zinc-300 text-right font-medium">{formatRM(p.quotedAmount)}</span>
                  <span className={`text-xs ${overdue ? 'text-red-400' : 'text-zinc-500'}`}>
                    {p.deadline
                      ? overdue
                        ? 'Overdue'
                        : new Date(p.deadline).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: '2-digit' })
                      : '—'}
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Pipeline board */}
      {view === 'board' && (
      <div className="grid grid-cols-5 gap-3 h-[calc(100vh-200px)] overflow-hidden">
        {COLUMNS.map((col) => {
          const colProjects = byStatus(col.status)
          const total = columnTotal(col.status)
          const Icon = col.icon
          const isOver = overCol === col.status && !!draggingId

          return (
            <div
              key={col.status}
              className={`flex flex-col rounded-xl border transition-all duration-150 overflow-hidden ${
                isOver
                  ? `${col.dropHighlight} border-transparent`
                  : `${col.borderColor} ${col.bgColor}`
              }`}
              onDragEnter={(e) => {
                e.preventDefault()
                dragCounters.current[col.status] = (dragCounters.current[col.status] ?? 0) + 1
                setOverCol(col.status)
              }}
              onDragLeave={(e) => {
                dragCounters.current[col.status] = (dragCounters.current[col.status] ?? 1) - 1
                if ((dragCounters.current[col.status] ?? 0) <= 0) {
                  dragCounters.current[col.status] = 0
                  setOverCol(prev => prev === col.status ? null : prev)
                }
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(e) => {
                e.preventDefault()
                dragCounters.current[col.status] = 0
                handleDrop(col.status)
              }}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800/40">
                <div className="flex items-center gap-1.5">
                  <Icon className={`h-3.5 w-3.5 ${col.accent}`} />
                  <span className={`text-xs font-semibold ${col.textColor}`}>{col.label}</span>
                </div>
                <span className="rounded-full bg-zinc-800/60 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                  {colProjects.length}
                </span>
              </div>

              {/* Total value */}
              <div className="px-3 py-2 border-b border-zinc-800/30">
                <span className="text-xs font-semibold text-zinc-300">{formatRM(total)}</span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {colProjects.length === 0 ? (
                  <div className={`flex flex-col items-center justify-center h-20 gap-1 rounded-lg border-2 border-dashed transition-colors ${
                    isOver ? 'border-zinc-500/50' : 'border-transparent'
                  }`}>
                    {isOver ? (
                      <span className="text-xs text-zinc-400 font-medium">Drop here</span>
                    ) : (
                      <>
                        <span className="text-xs text-zinc-700">No projects here</span>
                        {col.status === 'PROJECTED' && (
                          <a href="/admin/projects" className="text-[10px] text-indigo-500 hover:text-indigo-400 hover:underline">+ Create project</a>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  colProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      showAlert={col.status === 'COMPLETED'}
                      onDragStart={setDraggingId}
                      isDragging={draggingId === project.id}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
      )}
    </div>
  )
}
