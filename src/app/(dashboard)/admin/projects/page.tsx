'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  Plus,
  X,
  ChevronDown,
  FolderOpen,
  Loader2,
  Check,
  AlertCircle,
  ExternalLink,
  Calendar,
  DollarSign,
  UserPlus,
  Building2,
  Mail,
  Phone,
  User,
  RefreshCw,
  Link2,
  Trash2,
  Pencil,
  Search,
  Save,
  Users,
} from 'lucide-react'
import { formatCurrency, formatDeadline } from '@/lib/utils'
import { ViewToggle, type ViewMode } from '@/components/ui/view-toggle'
import { ProjectStatsBar } from '@/components/project/ProjectStatsBar'

type ProjectStatus = 'PROJECTED' | 'ONGOING' | 'COMPLETED' | 'BILLED' | 'PAID'

interface Client {
  id: string
  companyName: string
  contactPerson: string
  email?: string
}

interface CSUser {
  id: string
  name: string
  email: string
}

interface Project {
  id: string
  code: string
  status: ProjectStatus
  quotedAmount: number
  deadline: string | null
  client?: { id: string; companyName: string; contactPerson: string }
  assignedCS?: { id: string; name: string } | null
  assignedCSId?: string | null
  csAssignments?: Array<{ user: { id: string; name: string } }>
  createdAt: string
}

interface Toast {
  id: number
  type: 'success' | 'error'
  message: string
}

interface LarkSyncResult {
  total: number
  created: number
  skipped: number
  errors: string[]
  projects: Array<{ name: string; code: string; chatId: string; isNew: boolean }>
}

interface EditDraft {
  projectName: string
  status: ProjectStatus
  quotedAmount: string
  deadline: string
  assignedCSId: string
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  PROJECTED: 'Projected',
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed',
  BILLED: 'Billed',
  PAID: 'Paid',
}

const STATUS_ORDER: ProjectStatus[] = ['PROJECTED', 'ONGOING', 'COMPLETED', 'BILLED', 'PAID']

function getStatusBadgeClass(status: ProjectStatus): string {
  switch (status) {
    case 'PROJECTED':  return 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
    case 'ONGOING':    return 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
    case 'COMPLETED':  return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
    case 'BILLED':     return 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
    case 'PAID':       return 'bg-green-500/15 text-green-400 border border-green-500/30'
  }
}

function isLarkClient(contactPerson: string): boolean {
  return contactPerson === 'TBD'
}

export default function AdminProjectsPage() {
  useSession()
  const [projects, setProjects]   = useState<Project[]>([])
  const [clients, setClients]     = useState<Client[]>([])
  const [csUsers, setCSUsers]     = useState<CSUser[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [toasts, setToasts]       = useState<Toast[]>([])
  const toastCounter              = useRef(0)

  // Search + filter
  const [search, setSearch]               = useState('')
  const [statusFilter, setStatusFilter]   = useState<ProjectStatus | 'ALL'>('ALL')
  const [view, setView]                   = useState<ViewMode>('list')

  // New project form
  const [formClientId, setFormClientId]       = useState('')
  const [formStatus, setFormStatus]           = useState<'PROJECTED' | 'ONGOING'>('PROJECTED')
  const [formQuotedAmount, setFormQuotedAmount] = useState('')
  const [formDeadline, setFormDeadline]       = useState('')
  const [formCSId, setFormCSId]               = useState('')
  const [formLoading, setFormLoading]         = useState(false)
  const [formError, setFormError]             = useState('')

  // Lark sync
  const [larkSyncing, setLarkSyncing]         = useState(false)
  const [larkResult, setLarkResult]           = useState<LarkSyncResult | null>(null)
  const [showLarkPanel, setShowLarkPanel]     = useState(false)
  const [memberSyncing, setMemberSyncing]     = useState(false)

  // Delete
  const [deleteConfirm, setDeleteConfirm]     = useState<{ id: string; code: string } | null>(null)
  const [deleting, setDeleting]               = useState(false)

  // Inline edit
  const [editingId, setEditingId]             = useState<string | null>(null)
  const [editDraft, setEditDraft]             = useState<EditDraft | null>(null)
  const [editSaving, setEditSaving]           = useState(false)

  // Inline new-client mini-form
  const [showNewClient, setShowNewClient]     = useState(false)
  const [nc, setNc]                           = useState({ company: '', contact: '', email: '', phone: '' })
  const [ncLoading, setNcLoading]             = useState(false)
  const [ncError, setNcError]                 = useState('')

  function addToast(type: 'success' | 'error', message: string) {
    const id = ++toastCounter.current
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  async function fetchProjects() {
    try {
      const res = await fetch('/api/projects')
      if (!res.ok) throw new Error()
      const json = await res.json()
      setProjects(json.data ?? [])
    } catch {
      addToast('error', 'Failed to load projects.')
    }
  }

  async function fetchClients() {
    try {
      const res = await fetch('/api/crm/clients')
      if (!res.ok) return
      const json = await res.json()
      setClients(json.data ?? [])
    } catch { /* non-critical */ }
  }

  async function fetchCSUsers() {
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) return
      const json = await res.json()
      const cs = (json.data ?? []).filter((u: CSUser & { role: string }) => u.role === 'CLIENT_SERVICING')
      setCSUsers(cs)
    } catch { /* non-critical */ }
  }

  async function syncFromLark() {
    setLarkSyncing(true)
    setLarkResult(null)
    try {
      const res = await fetch('/api/admin/sync-lark-groups', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Lark sync failed')
      setLarkResult(json.data)
      setShowLarkPanel(true)
      if (json.data.created > 0) {
        await fetchProjects()
        addToast('success', `Lark sync complete — ${json.data.created} project(s) imported.`)
      } else {
        addToast('success', 'Lark sync complete — all projects already up to date.')
      }
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Lark sync failed')
    } finally {
      setLarkSyncing(false)
    }
  }

  async function syncMembers() {
    setMemberSyncing(true)
    try {
      const res = await fetch('/api/admin/sync-lark-group-members', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Member sync failed')
      const data = json.data as { synced: number; assignments: { created: number; unmatched: number } }
      await fetchProjects()
      addToast('success', `Synced members for ${data.synced} project(s) — ${data.assignments.created} assignment(s).`)
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Member sync failed')
    } finally {
      setMemberSyncing(false)
    }
  }

  async function handleDeleteProject() {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/projects/${deleteConfirm.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Delete failed')
      setProjects(prev => prev.filter(p => p.id !== deleteConfirm.id))
      addToast('success', `Project ${deleteConfirm.code} deleted.`)
      setDeleteConfirm(null)
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  function startEdit(project: Project) {
    setEditingId(project.id)
    setEditDraft({
      projectName: project.client?.companyName ?? '',
      status: project.status,
      quotedAmount: project.quotedAmount > 0 ? String(project.quotedAmount) : '',
      deadline: project.deadline ? project.deadline.slice(0, 10) : '',
      assignedCSId: project.assignedCSId ?? '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft(null)
  }

  async function saveEdit(project: Project) {
    if (!editDraft) return
    setEditSaving(true)
    try {
      // Save project fields
      const projectPatch: Record<string, unknown> = {
        status: editDraft.status,
        quotedAmount: editDraft.quotedAmount ? parseFloat(editDraft.quotedAmount) : 0,
        deadline: editDraft.deadline || null,
        assignedCSId: editDraft.assignedCSId || null,
      }
      const projRes = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectPatch),
      })
      if (!projRes.ok) {
        const j = await projRes.json()
        throw new Error(j.error ?? 'Failed to save project')
      }

      // If project name changed (stored on client), patch the client too
      const originalName = project.client?.companyName ?? ''
      if (project.client?.id && editDraft.projectName.trim() && editDraft.projectName.trim() !== originalName) {
        const clientRes = await fetch(`/api/crm/clients/${project.client.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyName: editDraft.projectName.trim() }),
        })
        if (!clientRes.ok) {
          const j = await clientRes.json()
          throw new Error(j.error ?? 'Failed to update project name')
        }
      }

      await fetchProjects()
      addToast('success', `${project.code} saved.`)
      cancelEdit()
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Save failed')
    } finally {
      setEditSaving(false)
    }
  }

  useEffect(() => {
    Promise.all([fetchProjects(), fetchClients(), fetchCSUsers()]).finally(() => setLoading(false))
  }, [])

  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault()
    setNcError('')
    if (!nc.company.trim() || !nc.contact.trim() || !nc.email.trim()) {
      setNcError('Company name, contact person and email are required.')
      return
    }
    setNcLoading(true)
    try {
      const res = await fetch('/api/crm/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName:   nc.company.trim(),
          contactPerson: nc.contact.trim(),
          email:         nc.email.trim(),
          ...(nc.phone.trim() ? { phone: nc.phone.trim() } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create client')

      const newClient: Client = { id: json.data.id, companyName: json.data.companyName, contactPerson: json.data.contactPerson }
      setClients(prev => [newClient, ...prev])
      setFormClientId(json.data.id)
      setNc({ company: '', contact: '', email: '', phone: '' })
      setShowNewClient(false)
      addToast('success', `Client "${json.data.companyName}" added.`)
    } catch (err) {
      setNcError(err instanceof Error ? err.message : 'Failed to create client')
    } finally {
      setNcLoading(false)
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setFormLoading(true)
    try {
      const body: Record<string, unknown> = {
        status: formStatus,
        quotedAmount: formQuotedAmount ? parseFloat(formQuotedAmount) : 0,
      }
      if (formClientId)  body.clientId     = formClientId
      if (formCSId)      body.assignedCSId = formCSId
      if (formDeadline)  body.deadline     = new Date(formDeadline).toISOString()

      const res  = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) { setFormError(json.error ?? 'Failed to create project.'); return }

      await fetchProjects()
      setFormClientId(''); setFormStatus('PROJECTED'); setFormQuotedAmount(''); setFormDeadline(''); setFormCSId('')
      setShowForm(false)
      addToast('success', `Project ${json.data.code} created.`)
    } catch {
      setFormError('Something went wrong. Please try again.')
    } finally {
      setFormLoading(false)
    }
  }

  // Filtered projects
  const filteredProjects = projects.filter(p => {
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const inCode = p.code.toLowerCase().includes(q)
      const inName = (p.client?.companyName ?? '').toLowerCase().includes(q)
      if (!inCode && !inName) return false
    }
    return true
  })

  const counts: Record<ProjectStatus | 'ALL', number> = {
    ALL: projects.length,
    PROJECTED: projects.filter(p => p.status === 'PROJECTED').length,
    ONGOING: projects.filter(p => p.status === 'ONGOING').length,
    COMPLETED: projects.filter(p => p.status === 'COMPLETED').length,
    BILLED: projects.filter(p => p.status === 'BILLED').length,
    PAID: projects.filter(p => p.status === 'PAID').length,
  }

  // Derived metrics for stats bar.
  // "Needs attention": completed-but-not-billed + overdue ongoing.
  const now = Date.now()
  const needsAttention = projects.filter(p => {
    if (p.status === 'COMPLETED') return true
    if (p.status === 'ONGOING' && p.deadline && new Date(p.deadline).getTime() < now) return true
    return false
  }).length
  const pipelineValue = projects
    .filter(p => p.status !== 'PAID')
    .reduce((sum, p) => sum + (Number.isFinite(p.quotedAmount) ? p.quotedAmount : 0), 0)

  const selectedClient = clients.find(c => c.id === formClientId)

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium shadow-xl ${toast.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300' : 'bg-red-950/90 border-red-500/40 text-red-300'}`}>
            {toast.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {toast.message}
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <FolderOpen className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-zinc-100">All Projects</h1>
              {!loading && (
                <p className="text-sm text-zinc-500 mt-0.5">{projects.length} project{projects.length !== 1 ? 's' : ''} total</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button"
              onClick={syncMembers}
              disabled={memberSyncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-zinc-100 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Users className={`w-4 h-4 ${memberSyncing ? 'animate-spin' : ''}`} />
              {memberSyncing ? 'Syncing…' : 'Sync Members'}
            </button>
            <button type="button"
              onClick={syncFromLark}
              disabled={larkSyncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-zinc-100 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${larkSyncing ? 'animate-spin' : ''}`} />
              {larkSyncing ? 'Syncing…' : 'Sync Lark'}
            </button>
            <button type="button"
              onClick={() => { setShowForm(p => !p); setShowNewClient(false); setFormError('') }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <ProjectStatsBar
          totalProjects={projects.length}
          activeProjects={counts.ONGOING}
          needsAttention={needsAttention}
          pipelineValue={pipelineValue}
          loading={loading}
        />

        {/* Lark Sync Results Panel */}
        {showLarkPanel && larkResult && (
          <div className="mb-6 rounded-2xl border border-zinc-700/60 bg-zinc-900/60 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-semibold text-zinc-200">Lark Sync Results</h2>
              </div>
              <button type="button" onClick={() => setShowLarkPanel(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700/60 text-xs">
                  <span className="text-zinc-400">Groups in Lark</span>
                  <span className="font-bold text-zinc-100">{larkResult.total}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
                  <Link2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Imported</span>
                  <span className="font-bold text-emerald-200">{larkResult.created}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/40 border border-zinc-700/40 text-xs">
                  <Check className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-zinc-400">Already exists</span>
                  <span className="font-bold text-zinc-300">{larkResult.skipped}</span>
                </div>
              </div>
              {larkResult.projects.filter(p => p.isNew).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-emerald-400 mb-2">Newly imported:</p>
                  <div className="flex flex-wrap gap-2">
                    {larkResult.projects.filter(p => p.isNew).map(p => (
                      <span key={p.chatId} className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                        <span className="font-mono text-emerald-200">{p.code}</span> — {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {larkResult.errors.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-400 mb-2">Errors:</p>
                  {larkResult.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-400">{e}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* New Project Form */}
        {showForm && (
          <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-200">New Project</h2>
              <button type="button" onClick={() => { setShowForm(false); setShowNewClient(false); setFormError('') }}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="px-6 py-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                {/* Client picker */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Client</label>
                    <button type="button"
                      onClick={() => { setShowNewClient(p => !p); setNcError('') }}
                      className="flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
                      <UserPlus className="w-3 h-3" />
                      {showNewClient ? 'Cancel' : '+ New Client'}
                    </button>
                  </div>

                  {selectedClient && !showNewClient && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 mb-1">
                      <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-indigo-300 truncate">{selectedClient.companyName}</p>
                        <p className="text-[10px] text-zinc-500 truncate">{selectedClient.contactPerson}</p>
                      </div>
                      <button type="button" onClick={() => setFormClientId('')} className="ml-auto text-zinc-600 hover:text-zinc-400">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {!showNewClient && (
                    <div className="relative">
                      <select value={formClientId} onChange={e => setFormClientId(e.target.value)}
                        className="w-full appearance-none bg-zinc-800/70 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors pr-9">
                        <option value="">— Select client —</option>
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>{c.companyName}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                    </div>
                  )}

                  {showNewClient && (
                    <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-3">
                      <p className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                        <UserPlus className="w-3.5 h-3.5" /> Add New Client
                      </p>
                      <div className="space-y-2.5">
                        {[
                          { icon: Building2, key: 'company', placeholder: 'Company name *', type: 'text' },
                          { icon: User, key: 'contact', placeholder: 'Contact person *', type: 'text' },
                          { icon: Mail, key: 'email', placeholder: 'Email *', type: 'email' },
                          { icon: Phone, key: 'phone', placeholder: 'Phone (optional)', type: 'text' },
                        ].map(({ icon: Icon, key, placeholder, type }) => (
                          <div key={key} className="relative">
                            <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                            <input
                              type={type}
                              value={nc[key as keyof typeof nc]}
                              onChange={e => setNc(p => ({ ...p, [key]: e.target.value }))}
                              placeholder={placeholder}
                              className="w-full bg-zinc-800/80 border border-zinc-700 rounded-lg pl-8 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20"
                            />
                          </div>
                        ))}
                      </div>
                      {ncError && <p className="text-[11px] text-red-400">{ncError}</p>}
                      <button type="button" onClick={handleCreateClient} disabled={ncLoading}
                        className="cursor-pointer w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-medium transition-colors">
                        {ncLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        {ncLoading ? 'Saving…' : 'Save Client & Select'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Status</label>
                  <div className="relative">
                    <select value={formStatus} onChange={e => setFormStatus(e.target.value as 'PROJECTED' | 'ONGOING')}
                      className="w-full appearance-none bg-zinc-800/70 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors pr-9">
                      <option value="PROJECTED">Projected</option>
                      <option value="ONGOING">Ongoing</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                  </div>
                </div>

                {/* Quoted Amount */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Quoted Amount (RM)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
                    <input type="number" min="0" step="0.01" value={formQuotedAmount}
                      onChange={e => setFormQuotedAmount(e.target.value)} placeholder="0.00"
                      className="w-full bg-zinc-800/70 border border-zinc-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors" />
                  </div>
                </div>

                {/* Deadline */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Deadline</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
                    <input type="date" value={formDeadline} onChange={e => setFormDeadline(e.target.value)}
                      className="w-full bg-zinc-800/70 border border-zinc-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors [color-scheme:dark]" />
                  </div>
                </div>

                {/* Assign CS */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Assign CS</label>
                  <div className="relative">
                    <select value={formCSId} onChange={e => setFormCSId(e.target.value)}
                      className="w-full appearance-none bg-zinc-800/70 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors pr-9">
                      <option value="">— Unassigned —</option>
                      {csUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                  </div>
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-950/50 border border-red-500/30 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => { setShowForm(false); setShowNewClient(false); setFormError('') }}
                  className="px-4 py-2 rounded-xl text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={formLoading}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors">
                  {formLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {formLoading ? 'Creating…' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search + Status Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or code…"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 flex-wrap">
            {(['ALL', ...STATUS_ORDER] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                {s === 'ALL' ? 'All' : STATUS_LABELS[s]}
                <span className={`ml-1.5 ${statusFilter === s ? 'text-indigo-300' : 'text-zinc-600'}`}>
                  {counts[s]}
                </span>
              </button>
            ))}
          </div>

          <ViewToggle view={view} onChange={setView} />
        </div>

        {/* Projects Table */}
        {view === 'list' && <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
          {loading ? (
            <div className="divide-y divide-zinc-800/60">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                  <div className="h-3.5 bg-zinc-800 rounded w-24" />
                  <div className="h-3.5 bg-zinc-800 rounded w-40 flex-1" />
                  <div className="h-6 bg-zinc-800 rounded-full w-20" />
                  <div className="h-3.5 bg-zinc-800 rounded w-24" />
                  <div className="h-3.5 bg-zinc-800 rounded w-20" />
                  <div className="ml-auto h-8 bg-zinc-800 rounded-lg w-16" />
                </div>
              ))}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="py-20 text-center text-zinc-500">
              <FolderOpen className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">
                {projects.length === 0 ? 'No projects yet.' : 'No projects match your filters.'}
              </p>
              {projects.length === 0 && (
                <p className="text-xs mt-1 text-zinc-600">Click <span className="text-indigo-400">New Project</span> or <span className="text-indigo-400">Sync Lark</span> to get started.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider w-28">Code</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Project / Client</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider w-32">Status</th>
                    <th className="text-right px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider w-32">Quoted (RM)</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider w-28 hidden lg:table-cell">Deadline</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider w-32 hidden xl:table-cell">CS</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider w-40 hidden xl:table-cell">Team</th>
                    <th className="px-4 py-3.5 w-28"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredProjects.map(project => {
                    const isEditing = editingId === project.id
                    const isLark = project.client ? isLarkClient(project.client.contactPerson) : false

                    if (isEditing && editDraft) {
                      return (
                        <tr key={project.id} className="bg-indigo-500/5 border-l-2 border-l-indigo-500/60">
                          {/* Code */}
                          <td className="px-5 py-3">
                            <span className="text-sm font-mono font-semibold text-zinc-100">{project.code}</span>
                          </td>

                          {/* Project Name (editable) */}
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={editDraft.projectName}
                              onChange={e => setEditDraft(d => d ? { ...d, projectName: e.target.value } : d)}
                              placeholder="Project / Client name"
                              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30"
                            />
                          </td>

                          {/* Status (editable) */}
                          <td className="px-4 py-3">
                            <div className="relative">
                              <select
                                value={editDraft.status}
                                onChange={e => setEditDraft(d => d ? { ...d, status: e.target.value as ProjectStatus } : d)}
                                className="w-full appearance-none bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500/60 pr-7"
                              >
                                {STATUS_ORDER.map(s => (
                                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                            </div>
                          </td>

                          {/* Amount (editable) */}
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editDraft.quotedAmount}
                              onChange={e => setEditDraft(d => d ? { ...d, quotedAmount: e.target.value } : d)}
                              placeholder="0.00"
                              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 text-right focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30"
                            />
                          </td>

                          {/* Deadline (editable) */}
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <input
                              type="date"
                              value={editDraft.deadline}
                              onChange={e => setEditDraft(d => d ? { ...d, deadline: e.target.value } : d)}
                              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500/60 [color-scheme:dark]"
                            />
                          </td>

                          {/* CS (editable) */}
                          <td className="px-4 py-3 hidden xl:table-cell">
                            <div className="relative">
                              <select
                                value={editDraft.assignedCSId}
                                onChange={e => setEditDraft(d => d ? { ...d, assignedCSId: e.target.value } : d)}
                                className="w-full appearance-none bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500/60 pr-7"
                              >
                                <option value="">Unassigned</option>
                                {csUsers.map(u => (
                                  <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => saveEdit(project)}
                                disabled={editSaving}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-medium text-white transition-colors"
                              >
                                {editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={editSaving}
                                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    }

                    // Read-only row
                    return (
                      <tr key={project.id} className="group hover:bg-zinc-800/30 transition-colors duration-100">
                        <td className="px-5 py-4">
                          <span className="text-sm font-mono font-semibold text-zinc-100">{project.code}</span>
                        </td>
                        <td className="px-4 py-4">
                          {project.client ? (
                            <div className="min-w-0">
                              <p className="text-sm text-zinc-200 truncate max-w-[220px]">{project.client.companyName}</p>
                              {!isLark && (
                                <p className="text-xs text-zinc-500 truncate max-w-[220px]">{project.client.contactPerson}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(project.status)}`}>
                            {STATUS_LABELS[project.status]}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="text-sm font-medium text-zinc-300 tabular-nums">
                            {project.quotedAmount > 0 ? formatCurrency(project.quotedAmount) : <span className="text-zinc-600 text-xs">—</span>}
                          </span>
                        </td>
                        <td className="px-4 py-4 hidden lg:table-cell">
                          <span className="text-xs text-zinc-500">{formatDeadline(project.deadline) || '—'}</span>
                        </td>
                        <td className="px-4 py-4 hidden xl:table-cell">
                          {project.assignedCS
                            ? <span className="text-xs text-zinc-400">{project.assignedCS.name}</span>
                            : <span className="text-xs text-zinc-600">—</span>}
                        </td>
                        <td className="px-4 py-4 hidden xl:table-cell">
                          {project.csAssignments && project.csAssignments.length > 0
                            ? (
                              <div className="flex flex-wrap gap-1">
                                {project.csAssignments.map(a => (
                                  <span key={a.user.id} className="inline-flex items-center text-[10px] text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded px-1.5 py-0.5">
                                    {a.user.name.split(' ')[0]}
                                  </span>
                                ))}
                              </div>
                            )
                            : <span className="text-xs text-zinc-600">—</span>}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => startEdit(project)}
                              className="p-1.5 rounded-lg text-zinc-600 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors opacity-0 group-hover:opacity-100"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <Link
                              href={`/cs/projects/${project.id}`}
                              className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors opacity-0 group-hover:opacity-100"
                              title="Open project"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm({ id: project.id, code: project.code })}
                              className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>}

        {/* Bento Cards */}
        {view === 'bento' && (
          loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 animate-pulse space-y-3">
                  <div className="h-3.5 bg-zinc-800 rounded w-24" />
                  <div className="h-3 bg-zinc-800 rounded w-40" />
                  <div className="h-6 bg-zinc-800 rounded-full w-20" />
                </div>
              ))}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="py-20 text-center text-zinc-500">
              <FolderOpen className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">
                {projects.length === 0 ? 'No projects yet.' : 'No projects match your filters.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map(project => {
                const isLark = project.client ? isLarkClient(project.client.contactPerson) : false
                const cs = project.assignedCS
                return (
                  <div key={project.id} className="group relative rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-5 hover:border-zinc-700 transition-colors space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-mono text-xs font-semibold text-indigo-400">{project.code}</span>
                        {isLark && <span className="ml-2 text-[10px] text-zinc-500">Lark</span>}
                        <p className="mt-0.5 text-sm font-medium text-zinc-100 leading-snug line-clamp-2">
                          {project.client?.companyName ?? '—'}
                        </p>
                        {project.client?.contactPerson && !isLark && (
                          <p className="text-xs text-zinc-500 mt-0.5 truncate">{project.client.contactPerson}</p>
                        )}
                      </div>
                      <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${getStatusBadgeClass(project.status)}`}>
                        {STATUS_LABELS[project.status]}
                      </span>
                    </div>

                    {/* Amount + Deadline */}
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>RM {project.quotedAmount != null ? Number(project.quotedAmount).toLocaleString('en-MY', { minimumFractionDigits: 2 }) : '—'}</span>
                      {project.deadline && (
                        <span className="text-zinc-500">{new Date(project.deadline).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      )}
                    </div>

                    {/* CS */}
                    {cs && (
                      <p className="text-xs text-zinc-500">CS: <span className="text-zinc-300">{cs.name}</span></p>
                    )}

                    {/* Team / PIC */}
                    {project.csAssignments && project.csAssignments.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <span className="text-xs text-zinc-500 mr-0.5">Team:</span>
                        {project.csAssignments.map(a => (
                          <span key={a.user.id} className="inline-flex items-center text-[10px] text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded px-1.5 py-0.5">
                            {a.user.name.split(' ')[0]}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1 pt-1 border-t border-zinc-800/60 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="button" onClick={() => startEdit(project)}
                        className="p-1.5 rounded-lg text-zinc-600 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <Link href={`/cs/projects/${project.id}`}
                        className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors" title="Open project">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                      <button type="button" onClick={() => setDeleteConfirm({ id: project.id, code: project.code })}
                        className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* Row count hint */}
        {!loading && filteredProjects.length > 0 && filteredProjects.length < projects.length && (
          <p className="text-xs text-zinc-600 mt-3 text-right">
            Showing {filteredProjects.length} of {projects.length} projects
          </p>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm mx-4 rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Delete Project</h3>
                <p className="text-xs text-zinc-500 mt-0.5">This cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-zinc-400 mb-6">
              Are you sure you want to delete <span className="font-mono font-semibold text-zinc-200">{deleteConfirm.code}</span>? All associated data will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteConfirm(null)} disabled={deleting}
                className="flex-1 px-4 py-2 rounded-xl border border-zinc-700 bg-zinc-800 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={handleDeleteProject} disabled={deleting}
                className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
