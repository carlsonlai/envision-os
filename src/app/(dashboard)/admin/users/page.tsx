'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import {
  UserPlus,
  Trash2,
  Edit2,
  Check,
  X,
  ChevronDown,
  Users,
  Shield,
  RefreshCw,
  UserX,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { ViewToggle, type ViewMode } from '@/components/ui/view-toggle'

type Role =
  | 'ADMIN'
  | 'CREATIVE_DIRECTOR'
  | 'SENIOR_ART_DIRECTOR'
  | 'SALES'
  | 'CLIENT_SERVICING'
  | 'JUNIOR_ART_DIRECTOR'
  | 'GRAPHIC_DESIGNER'
  | 'JUNIOR_DESIGNER'
  | 'DESIGNER_3D'
  | 'DIGITAL_MARKETING'
  | 'CLIENT'
  | 'AI_SALES_AGENT'
  | 'AI_CS_AGENT'

interface User {
  id: string
  name: string
  email: string
  role: Role
  avatar: string | null
  active: boolean
  larkOpenId: string | null   // null = manually created; set = synced from Lark
  createdAt: string
}

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  CREATIVE_DIRECTOR: 'Creative Director',
  SENIOR_ART_DIRECTOR: 'Senior Art Director',
  SALES: 'Sales',
  CLIENT_SERVICING: 'Client Servicing',
  JUNIOR_ART_DIRECTOR: 'Junior Art Director',
  GRAPHIC_DESIGNER: 'Graphic Designer',
  JUNIOR_DESIGNER: 'Junior Designer',
  DESIGNER_3D: '3D Designer',
  DIGITAL_MARKETING: 'Digital Marketing',
  CLIENT: 'Client',
  AI_SALES_AGENT: '🤖 AI Sales Agent',
  AI_CS_AGENT: '🤖 AI CS Agent',
}

// AI roles have special visual treatment
const AI_ROLES: Role[] = ['AI_SALES_AGENT', 'AI_CS_AGENT']

const ALL_ROLES: Role[] = [
  'ADMIN',
  'CREATIVE_DIRECTOR',
  'SENIOR_ART_DIRECTOR',
  'SALES',
  'CLIENT_SERVICING',
  'JUNIOR_ART_DIRECTOR',
  'GRAPHIC_DESIGNER',
  'JUNIOR_DESIGNER',
  'DESIGNER_3D',
  'DIGITAL_MARKETING',
  'CLIENT',
]

function getRoleBadgeClass(role: Role): string {
  switch (role) {
    case 'ADMIN':
      return 'bg-red-500/15 text-red-400 border border-red-500/30'
    case 'SALES':
      return 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
    case 'CLIENT_SERVICING':
      return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
    case 'CREATIVE_DIRECTOR':
    case 'SENIOR_ART_DIRECTOR':
      return 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
    case 'DIGITAL_MARKETING':
      return 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
    case 'CLIENT':
      return 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
    default:
      return 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/30'
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

interface Toast {
  id: number
  type: 'success' | 'error'
  message: string
}

export default function AdminUsersPage() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastCounter = useRef(0)

  // New user form state
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formRole, setFormRole] = useState<Role>('SALES')
  const [formLoading, setFormLoading] = useState(false)

  // Inline edit state: userId → pending role
  const [editingRole, setEditingRole] = useState<Record<string, Role>>({})
  const [savingRole, setSavingRole] = useState<Record<string, boolean>>({})

  // Delete confirm state
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Active toggle state
  const [togglingActive, setTogglingActive] = useState<string | null>(null)

  // Lark sync state
  const [syncing, setSyncing] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [view, setView] = useState<ViewMode>('list')

  function addToast(type: 'success' | 'error', message: string) {
    const id = ++toastCounter.current
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }

  async function fetchUsers() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error('Failed to fetch users')
      const json = await res.json()
      setUsers(json.data)
    } catch {
      addToast('error', 'Failed to load team members.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setFormLoading(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          password: formPassword,
          role: formRole,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        addToast('error', json.error ?? 'Failed to create user.')
        return
      }
      setUsers((prev) => [...prev, json.data])
      setFormName('')
      setFormEmail('')
      setFormPassword('')
      setFormRole('SALES')
      setShowForm(false)
      addToast('success', `${json.data.name} added to the team.`)
    } catch {
      addToast('error', 'Something went wrong.')
    } finally {
      setFormLoading(false)
    }
  }

  async function handleRoleSave(userId: string) {
    const newRole = editingRole[userId]
    if (!newRole) return
    setSavingRole((prev) => ({ ...prev, [userId]: true }))
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      const json = await res.json()
      if (!res.ok) {
        addToast('error', json.error ?? 'Failed to update role.')
        return
      }
      setUsers((prev) => prev.map((u) => (u.id === userId ? json.data : u)))
      setEditingRole((prev) => {
        const next = { ...prev }
        delete next[userId]
        return next
      })
      addToast('success', 'Role updated.')
    } catch {
      addToast('error', 'Something went wrong.')
    } finally {
      setSavingRole((prev) => ({ ...prev, [userId]: false }))
    }
  }

  function handleRoleCancel(userId: string) {
    setEditingRole((prev) => {
      const next = { ...prev }
      delete next[userId]
      return next
    })
  }

  async function handleDelete(userId: string) {
    setDeletingId(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) {
        addToast('error', json.error ?? 'Failed to delete user.')
        return
      }
      setUsers((prev) => prev.filter((u) => u.id !== userId))
      addToast('success', 'Team member removed.')
    } catch {
      addToast('error', 'Something went wrong.')
    } finally {
      setDeletingId(null)
      setConfirmDelete(null)
    }
  }

  async function handleToggleActive(userId: string, currentActive: boolean) {
    setTogglingActive(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !currentActive }),
      })
      const json = await res.json()
      if (!res.ok) {
        addToast('error', json.error ?? 'Failed to update status.')
        return
      }
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, active: !currentActive } : u)))
      addToast('success', currentActive ? 'Account deactivated.' : 'Account activated.')
    } catch {
      addToast('error', 'Something went wrong.')
    } finally {
      setTogglingActive(null)
    }
  }

  async function handleLarkSync() {
    setSyncing(true)
    try {
      const res = await fetch('/api/admin/sync-lark', { method: 'POST' })
      const json = await res.json() as { success: boolean; message?: string; error?: string }
      if (!res.ok || !json.success) {
        addToast('error', json.error ?? 'Lark sync failed.')
        return
      }
      addToast('success', json.message ?? 'Lark sync complete.')
      await fetchUsers()   // Refresh the list with newly synced users
    } catch {
      addToast('error', 'Could not reach sync endpoint.')
    } finally {
      setSyncing(false)
    }
  }

  const currentUserId = session?.user?.id

  const visibleUsers = showInactive ? users : users.filter(u => u.active)
  const larkLinkedCount = users.filter(u => u.larkOpenId).length
  const inactiveCount = users.filter(u => !u.active).length

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100">
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium shadow-xl transition-all duration-300 ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300'
                : 'bg-red-950/90 border-red-500/40 text-red-300'
            }`}
          >
            {toast.type === 'success' ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : (
              <X className="w-4 h-4 shrink-0" />
            )}
            {toast.message}
          </div>
        ))}
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <Shield className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-zinc-100">User Management</h1>
              {!loading && (
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  <p className="text-sm text-zinc-500 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    {users.filter(u => u.active).length} active member{users.filter(u => u.active).length !== 1 ? 's' : ''}
                  </p>
                  {larkLinkedCount > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-400">
                      {larkLinkedCount} from Lark
                    </span>
                  )}
                  {inactiveCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowInactive(v => !v)}
                      className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showInactive ? 'Hide' : 'Show'} {inactiveCount} inactive
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ViewToggle view={view} onChange={setView} />
            {/* Sync from Lark */}
            <button
              type="button"
              onClick={handleLarkSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-blue-500/40 text-zinc-300 hover:text-blue-300 text-sm font-medium transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync from Lark'}
            </button>
            <button type="button"
              onClick={() => setShowForm((prev) => !prev)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors duration-150"
            >
              <UserPlus className="w-4 h-4" />
              Add Member
            </button>
          </div>
        </div>

        {/* Slide-down Add Member Form */}
        {showForm && (
          <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-200">New Team Member</h2>
              <button type="button"
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  placeholder="Jane Doe"
                  className="bg-zinc-800/70 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  required
                  placeholder="jane@envision.com"
                  className="bg-zinc-800/70 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Password</label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Min. 6 characters"
                  className="bg-zinc-800/70 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Role</label>
                <div className="relative">
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as Role)}
                    className="w-full appearance-none bg-zinc-800/70 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors pr-9"
                  >
                    {ALL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                </div>
              </div>
              <div className="sm:col-span-2 flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-xl text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                >
                  {formLoading ? 'Creating…' : 'Create Member'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Table */}
        {view === 'list' && <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
          {loading ? (
            <div className="divide-y divide-zinc-800/60">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-zinc-800" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-zinc-800 rounded w-36" />
                    <div className="h-3 bg-zinc-800/60 rounded w-48" />
                  </div>
                  <div className="h-6 bg-zinc-800 rounded-full w-24" />
                  <div className="h-3.5 bg-zinc-800 rounded w-20" />
                  <div className="h-8 bg-zinc-800 rounded-lg w-28" />
                  <div className="h-8 bg-zinc-800 rounded-lg w-8" />
                </div>
              ))}
            </div>
          ) : visibleUsers.length === 0 ? (
            <div className="py-20 text-center text-zinc-500">
              <Users className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No team members yet. Click &quot;Sync from Lark&quot; to import your team.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Member
                  </th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden md:table-cell">
                    Role
                  </th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden lg:table-cell">
                    Joined
                  </th>
                  <th className="px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {visibleUsers.map((user) => {
                  const isCurrentUser = user.id === currentUserId
                  const pendingRole = editingRole[user.id]
                  const isSaving = savingRole[user.id] ?? false
                  const isDeleting = deletingId === user.id
                  const isConfirming = confirmDelete === user.id
                  const isToggling = togglingActive === user.id

                  return (
                    <tr
                      key={user.id}
                      className={`group transition-colors duration-100 ${user.active ? 'hover:bg-zinc-800/30' : 'opacity-50'}`}
                    >
                      {/* Member */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 relative ${
                            user.active
                              ? 'bg-gradient-to-br from-indigo-500/30 to-purple-500/20 border border-indigo-500/20'
                              : 'bg-zinc-800 border border-zinc-700'
                          }`}>
                            {user.active ? (
                              <span className="text-xs font-semibold text-indigo-300">
                                {user.name.charAt(0).toUpperCase()}
                              </span>
                            ) : (
                              <UserX className="w-4 h-4 text-zinc-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-zinc-100 truncate">
                                {user.name}
                                {isCurrentUser && (
                                  <span className="ml-2 text-xs text-zinc-600">(you)</span>
                                )}
                              </p>
                              {user.larkOpenId && (
                                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                                  Lark
                                </span>
                              )}
                              {!user.active && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-500 font-medium shrink-0">
                                  Inactive
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-4 hidden md:table-cell">
                        {pendingRole !== undefined ? (
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <select
                                value={pendingRole}
                                onChange={(e) =>
                                  setEditingRole((prev) => ({
                                    ...prev,
                                    [user.id]: e.target.value as Role,
                                  }))
                                }
                                className="appearance-none bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500/60 pr-7"
                              >
                                {ALL_ROLES.map((r) => (
                                  <option key={r} value={r}>
                                    {ROLE_LABELS[r]}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
                            </div>
                            <button type="button"
                              onClick={() => handleRoleSave(user.id)}
                              disabled={isSaving}
                              className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-600/30 transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button type="button"
                              onClick={() => handleRoleCancel(user.id)}
                              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getRoleBadgeClass(user.role)}`}
                          >
                            {ROLE_LABELS[user.role]}
                          </span>
                        )}
                      </td>

                      {/* Joined */}
                      <td className="px-4 py-4 hidden lg:table-cell">
                        <span className="text-xs text-zinc-500">{formatDate(user.createdAt)}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isConfirming ? (
                            <>
                              <span className="text-xs text-zinc-400 mr-1">Remove?</span>
                              <button type="button"
                                onClick={() => handleDelete(user.id)}
                                disabled={isDeleting}
                                className="px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 text-xs font-medium transition-colors disabled:opacity-60"
                              >
                                {isDeleting ? 'Removing…' : 'Confirm'}
                              </button>
                              <button type="button"
                                onClick={() => setConfirmDelete(null)}
                                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              {pendingRole === undefined && (
                                <button type="button"
                                  onClick={() =>
                                    setEditingRole((prev) => ({
                                      ...prev,
                                      [user.id]: user.role,
                                    }))
                                  }
                                  className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-indigo-400 transition-colors group-hover:text-zinc-500"
                                  title="Change role"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {!isCurrentUser && (
                                <button type="button"
                                  onClick={() => void handleToggleActive(user.id, user.active)}
                                  disabled={isToggling}
                                  className={`p-2 rounded-lg hover:bg-zinc-800 transition-colors group-hover:text-zinc-500 disabled:opacity-40 ${
                                    user.active
                                      ? 'text-zinc-600 hover:text-amber-400'
                                      : 'text-zinc-600 hover:text-emerald-400'
                                  }`}
                                  title={user.active ? 'Deactivate account' : 'Activate account'}
                                >
                                  {user.active ? (
                                    <ToggleRight className="w-3.5 h-3.5" />
                                  ) : (
                                    <ToggleLeft className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                              <button type="button"
                                onClick={() => setConfirmDelete(user.id)}
                                disabled={isCurrentUser}
                                className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-red-400 transition-colors group-hover:text-zinc-500 disabled:opacity-30 disabled:cursor-not-allowed"
                                title={isCurrentUser ? 'Cannot delete your own account' : 'Remove member'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>}

        {/* Bento Cards */}
        {view === 'bento' && (
          loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 animate-pulse space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-800" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3.5 bg-zinc-800 rounded w-28" />
                      <div className="h-3 bg-zinc-800 rounded w-40" />
                    </div>
                  </div>
                  <div className="h-6 bg-zinc-800 rounded-full w-24" />
                </div>
              ))}
            </div>
          ) : visibleUsers.length === 0 ? (
            <div className="py-20 text-center text-zinc-500">
              <Users className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No team members yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleUsers.map(user => {
                const isCurrentUser = user.id === currentUserId
                const pendingRole = editingRole[user.id]
                const isSaving = savingRole[user.id] ?? false
                const isToggling = togglingActive === user.id
                return (
                  <div
                    key={user.id}
                    className={`group relative rounded-2xl border bg-zinc-900/40 p-5 space-y-3 transition-colors ${
                      user.active
                        ? 'border-zinc-800/60 hover:border-zinc-700'
                        : 'border-zinc-800/40 opacity-50'
                    }`}
                  >
                    {/* Avatar + Name */}
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        user.active
                          ? 'bg-gradient-to-br from-indigo-500/30 to-purple-500/20 border border-indigo-500/20'
                          : 'bg-zinc-800 border border-zinc-700'
                      }`}>
                        {user.active
                          ? <span className="text-sm font-semibold text-indigo-300">{user.name.charAt(0).toUpperCase()}</span>
                          : <UserX className="w-4 h-4 text-zinc-600" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-medium text-zinc-100 truncate">{user.name}</p>
                          {isCurrentUser && <span className="text-[10px] text-zinc-600">(you)</span>}
                          {user.larkOpenId && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />Lark
                            </span>
                          )}
                          {!user.active && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-500">Inactive</span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                      </div>
                    </div>

                    {/* Role */}
                    <div>
                      {pendingRole !== undefined ? (
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <select
                              value={pendingRole}
                              onChange={e => setEditingRole(prev => ({ ...prev, [user.id]: e.target.value as Role }))}
                              className="w-full appearance-none bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500/60 pr-7"
                            >
                              {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
                          </div>
                          <button type="button" onClick={() => handleRoleSave(user.id)} disabled={isSaving}
                            className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-600/30 transition-colors">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => handleRoleCancel(user.id)}
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getRoleBadgeClass(user.role)}`}>
                          {ROLE_LABELS[user.role]}
                        </span>
                      )}
                    </div>

                    {/* Joined */}
                    <p className="text-[11px] text-zinc-600">Joined {formatDate(user.createdAt)}</p>

                    {/* Actions */}
                    <div className="flex items-center gap-1 pt-1 border-t border-zinc-800/60 opacity-0 group-hover:opacity-100 transition-opacity">
                      {pendingRole === undefined && (
                        <button type="button"
                          onClick={() => setEditingRole(prev => ({ ...prev, [user.id]: user.role }))}
                          className="p-1.5 rounded-lg text-zinc-600 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors" title="Change role">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!isCurrentUser && (
                        <button type="button"
                          onClick={() => void handleToggleActive(user.id, user.active)}
                          disabled={isToggling}
                          className={`p-1.5 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-40 ${user.active ? 'text-zinc-600 hover:text-amber-400' : 'text-zinc-600 hover:text-emerald-400'}`}
                          title={user.active ? 'Deactivate' : 'Activate'}>
                          {user.active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      <button type="button"
                        onClick={() => setConfirmDelete(user.id)}
                        disabled={isCurrentUser}
                        className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Remove member">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    </div>
  )
}
