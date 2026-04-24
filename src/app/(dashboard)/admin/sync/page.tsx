'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Building2,
  CreditCard,
  ClipboardList,
  Users,
  FolderSync,
  BarChart3,
  Play,
  AlertTriangle,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type SyncStatus = 'idle' | 'running' | 'success' | 'error'

interface ModuleState {
  status: SyncStatus
  summary: string
  lastSynced: string | null
  duration: number | null
}

interface SyncModule {
  id: string
  label: string
  description: string
  icon: React.ElementType
  color: string
  bg: string
  border: string
  group: string
  apiParam: string
}

// ─── Module definitions ────────────────────────────────────────────────────────

const MODULES: SyncModule[] = [
  {
    id: 'bukku-finance',
    label: 'Bukku Invoices & Quotations',
    description: 'Pull new invoices and quotations from Bukku and create projects',
    icon: Building2,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    group: 'Bukku',
    apiParam: 'bukku-finance',
  },
  {
    id: 'bukku-payments',
    label: 'Bukku Payment Reconciliation',
    description: 'Reconcile payments from Bukku — updates invoice paid status',
    icon: CreditCard,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    group: 'Bukku',
    apiParam: 'bukku-payments',
  },
  {
    id: 'bukku-jobtrack',
    label: 'Bukku Job Track',
    description: 'Sync quotation & invoice line items into the job tracking system',
    icon: ClipboardList,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    group: 'Bukku',
    apiParam: 'bukku-jobtrack',
  },
  {
    id: 'lark-staff',
    label: 'Lark Staff',
    description: 'Sync active staff members from Lark into Envicion OS user accounts',
    icon: Users,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    group: 'Lark',
    apiParam: 'lark-staff',
  },
  {
    id: 'lark-projects',
    label: 'Lark Project Folders',
    description: 'Link Lark Drive project folders to projects in Envicion OS',
    icon: FolderSync,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    group: 'Lark',
    apiParam: 'lark-projects',
  },
  {
    id: 'social-analytics',
    label: 'Social Platform Analytics',
    description: 'Pull live follower, reach, and engagement data from all connected platforms',
    icon: BarChart3,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    group: 'Social',
    apiParam: 'social-analytics',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string | null): string {
  if (!iso) return 'Never'
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function StatusIcon({ status }: { status: SyncStatus }) {
  if (status === 'running') return <RefreshCw className="h-4 w-4 animate-spin text-[#818cf8]" />
  if (status === 'success') return <CheckCircle2 className="h-4 w-4 text-emerald-400" />
  if (status === 'error') return <XCircle className="h-4 w-4 text-red-400" />
  return <Clock className="h-4 w-4 text-zinc-600" />
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SyncCentrePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [moduleStates, setModuleStates] = useState<Record<string, ModuleState>>(
    Object.fromEntries(MODULES.map(m => [m.id, { status: 'idle', summary: '', lastSynced: null, duration: null }]))
  )
  const [syncingAll, setSyncingAll] = useState(false)
  const [allResult, setAllResult] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      router.replace('/command')
    }
  }, [session, status, router])

  // Load last-synced timestamps on mount
  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/sync-centre')
      if (!res.ok) return
      const data = await res.json() as { modules: Record<string, { lastSynced: string | null }> }
      setModuleStates(prev => {
        const next = { ...prev }
        for (const [id, info] of Object.entries(data.modules)) {
          if (next[id]) {
            next[id] = { ...next[id], lastSynced: info.lastSynced }
          }
        }
        return next
      })
    } catch { /* non-critical */ }
  }, [])

  useEffect(() => { void loadStatus() }, [loadStatus])

  async function syncModule(moduleId: string, apiParam: string) {
    setModuleStates(prev => ({ ...prev, [moduleId]: { ...prev[moduleId], status: 'running', summary: 'Syncing…' } }))
    const t = Date.now()
    try {
      // 25-second client timeout — prevents UI hanging if Vercel kills the function
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 25000)
      const res = await fetch(`/api/admin/sync-centre?module=${apiParam}`, { method: 'POST', signal: controller.signal })
      clearTimeout(timeoutId)
      const data = await res.json() as { success: boolean; summary: string }
      setModuleStates(prev => ({
        ...prev,
        [moduleId]: {
          status: data.success ? 'success' : 'error',
          summary: data.summary,
          lastSynced: data.success ? new Date().toISOString() : prev[moduleId].lastSynced,
          duration: Date.now() - t,
        },
      }))
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError'
      setModuleStates(prev => ({
        ...prev,
        [moduleId]: {
          ...prev[moduleId],
          status: 'error',
          summary: isTimeout
            ? 'Timed out — Bukku/Lark APIs are slow. Try again in 30s or check your integration credentials.'
            : err instanceof Error ? err.message : 'Network error',
          duration: Date.now() - t,
        },
      }))
    }
  }

  async function syncAll() {
    setSyncingAll(true)
    setAllResult(null)
    // Set all to running
    setModuleStates(prev => {
      const next = { ...prev }
      for (const m of MODULES) next[m.id] = { ...next[m.id], status: 'running', summary: 'Queued…' }
      return next
    })

    // Run each sequentially so progress is visible
    for (const m of MODULES) {
      await syncModule(m.id, m.apiParam)
    }

    setSyncingAll(false)
    setAllResult('All modules synced.')
  }

  const groups = Array.from(new Set(MODULES.map(m => m.group)))

  const runningCount = Object.values(moduleStates).filter(s => s.status === 'running').length
  const successCount = Object.values(moduleStates).filter(s => s.status === 'success').length
  const errorCount = Object.values(moduleStates).filter(s => s.status === 'error').length

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Zap className="h-5 w-5 text-[#818cf8]" />
            Sync Centre
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Pull fresh data from all connected services into Envicion OS
          </p>
        </div>
        <button
          type="button"
          onClick={() => void syncAll()}
          disabled={syncingAll}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#6366f1]/25 hover:opacity-90 disabled:opacity-60 transition-all"
        >
          {syncingAll
            ? <RefreshCw className="h-4 w-4 animate-spin" />
            : <Play className="h-4 w-4" />}
          {syncingAll ? 'Syncing All…' : 'Sync All'}
        </button>
      </div>

      {/* Status bar */}
      {(successCount > 0 || errorCount > 0 || runningCount > 0) && (
        <div className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-xs">
          {runningCount > 0 && (
            <span className="flex items-center gap-1.5 text-[#818cf8]">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              {runningCount} running
            </span>
          )}
          {successCount > 0 && (
            <span className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {successCount} synced
            </span>
          )}
          {errorCount > 0 && (
            <span className="flex items-center gap-1.5 text-red-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {errorCount} failed
            </span>
          )}
          {allResult && <span className="ml-auto text-zinc-500">{allResult}</span>}
        </div>
      )}

      {/* Module groups */}
      {groups.map(group => {
        const groupModules = MODULES.filter(m => m.group === group)
        const groupColor = groupModules[0].color
        const groupBorder = groupModules[0].border
        const groupBg = groupModules[0].bg

        return (
          <div key={group} className={`rounded-xl border ${groupBorder} ${groupBg} overflow-hidden`}>
            <div className={`px-5 py-3 border-b ${groupBorder}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider ${groupColor}`}>{group}</p>
            </div>
            <div className="divide-y divide-zinc-800/60">
              {groupModules.map(mod => {
                const state = moduleStates[mod.id]
                const Icon = mod.icon

                return (
                  <div key={mod.id} className="flex items-center gap-4 px-5 py-4">
                    {/* Icon */}
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${mod.bg} ${mod.border} border`}>
                      <Icon className={`h-4 w-4 ${mod.color}`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-zinc-200">{mod.label}</p>
                        <StatusIcon status={state.status} />
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5 truncate">
                        {state.summary || mod.description}
                      </p>
                      {state.status === 'success' && state.duration && (
                        <p className="text-[10px] text-emerald-600 mt-0.5">{(state.duration / 1000).toFixed(1)}s</p>
                      )}
                      {state.status === 'error' && (
                        <p className="text-[10px] text-red-500 mt-0.5">Check Bukku / Lark credentials in integrations settings</p>
                      )}
                    </div>

                    {/* Last synced + button */}
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <p className="text-[10px] text-zinc-600">
                        {formatTime(state.lastSynced)}
                      </p>
                      <button
                        type="button"
                        onClick={() => void syncModule(mod.id, mod.apiParam)}
                        disabled={state.status === 'running' || syncingAll}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                          state.status === 'success'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                            : state.status === 'error'
                            ? 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                            : `${mod.border} ${mod.bg} ${mod.color} hover:opacity-80`
                        }`}
                      >
                        {state.status === 'running'
                          ? <RefreshCw className="h-3 w-3 animate-spin" />
                          : <RefreshCw className="h-3 w-3" />}
                        {state.status === 'running' ? 'Syncing…' : 'Sync Now'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Footer note */}
      <p className="text-xs text-zinc-600 text-center">
        Syncs run automatically via scheduled jobs. Use Sync Now to force a fresh pull immediately.
      </p>
    </div>
  )
}
