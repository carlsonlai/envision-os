'use client'

import { useState } from 'react'
import {
  Users,
  Briefcase,
  FolderSync,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Link2,
  UserCheck,
  Info,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffSyncResult {
  created: number
  updated: number
  deactivated: number
  skipped: number
  errors: string[]
}

interface JobSyncProject {
  name: string
  code: string
  chatId: string
  isNew: boolean
}

interface JobSyncResult {
  total: number
  created: number
  skipped: number
  errors: string[]
  projects: JobSyncProject[]
}

interface DriveLinkedItem {
  code: string
  status: string
}

interface DriveSyncResult {
  total: number
  linked: number
  alreadyLinked: number
  unmatched: Array<{ name: string; token: string }>
  dbOnly: DriveLinkedItem[]
  errors: string[]
}

type SyncState = 'idle' | 'running' | 'done' | 'error'

interface Toast {
  id: number
  type: 'success' | 'error'
  message: string
}

let toastId = 0

// ─── Reusable components ──────────────────────────────────────────────────────

function SyncCard({
  icon: Icon,
  title,
  description,
  state,
  onSync,
  children,
  accent = 'indigo',
  extra,
}: {
  icon: React.ElementType
  title: string
  description: string
  state: SyncState
  onSync: () => void
  children?: React.ReactNode
  accent?: 'indigo' | 'sky' | 'violet'
  extra?: React.ReactNode
}) {
  const accentMap = {
    indigo: {
      icon: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
      btn: 'bg-indigo-600 hover:bg-indigo-500',
      badge: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300',
    },
    sky: {
      icon: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
      btn: 'bg-sky-600 hover:bg-sky-500',
      badge: 'bg-sky-500/10 border-sky-500/20 text-sky-300',
    },
    violet: {
      icon: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
      btn: 'bg-violet-600 hover:bg-violet-500',
      badge: 'bg-violet-500/10 border-violet-500/20 text-violet-300',
    },
  }
  const colors = accentMap[accent]

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <div className="px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl border ${colors.icon} shrink-0`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
              <p className="text-sm text-zinc-500 mt-0.5 leading-relaxed">{description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {extra}
            <button
              type="button"
              onClick={onSync}
              disabled={state === 'running'}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${colors.btn}`}
            >
              <RefreshCw className={`w-4 h-4 ${state === 'running' ? 'animate-spin' : ''}`} />
              {state === 'running' ? 'Syncing…' : 'Run Sync'}
            </button>
          </div>
        </div>

        {/* Status badge */}
        {state === 'done' && (
          <div className="mt-4 flex items-center gap-2 text-sm text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Sync completed successfully
          </div>
        )}
        {state === 'error' && (
          <div className="mt-4 flex items-center gap-2 text-sm text-red-400">
            <XCircle className="w-4 h-4 shrink-0" />
            Sync encountered errors — see details below
          </div>
        )}
      </div>

      {children && (
        <div className="border-t border-zinc-800 px-6 py-4 bg-zinc-900/30">
          {children}
        </div>
      )}
    </div>
  )
}

function StatPill({
  label,
  value,
  variant = 'default',
}: {
  label: string
  value: number | string
  variant?: 'default' | 'success' | 'warn' | 'muted'
}) {
  const cls = {
    default: 'bg-zinc-800/60 border-zinc-700/60 text-zinc-200',
    success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
    warn:    'bg-amber-500/10 border-amber-500/20 text-amber-300',
    muted:   'bg-zinc-800/40 border-zinc-700/40 text-zinc-500',
  }[variant]

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${cls}`}>
      <span className="text-zinc-500">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LarkImportPage() {
  // Staff sync state
  const [staffState, setStaffState]           = useState<SyncState>('idle')
  const [staffResult, setStaffResult]         = useState<StaffSyncResult | null>(null)
  const [deactivateMissing, setDeactivateMissing] = useState(false)
  const [staffExpanded, setStaffExpanded]     = useState(false)

  // Jobs sync state
  const [jobsState, setJobsState]             = useState<SyncState>('idle')
  const [jobsResult, setJobsResult]           = useState<JobSyncResult | null>(null)
  const [monthsFilter, setMonthsFilter]       = useState<string>('')
  const [jobsExpanded, setJobsExpanded]       = useState(false)

  // Drive sync state
  const [driveState, setDriveState]           = useState<SyncState>('idle')
  const [driveResult, setDriveResult]         = useState<DriveSyncResult | null>(null)
  const [driveExpanded, setDriveExpanded]     = useState(false)

  // Toasts
  const [toasts, setToasts]                   = useState<Toast[]>([])

  function addToast(type: 'success' | 'error', message: string) {
    const id = ++toastId
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }

  // ── Staff sync ──────────────────────────────────────────────────────────────
  async function runStaffSync() {
    setStaffState('running')
    setStaffResult(null)
    try {
      const url = `/api/admin/sync-lark${deactivateMissing ? '?deactivate=true' : ''}`
      const res = await fetch(url, { method: 'POST' })
      const json = await res.json() as { success: boolean; result?: StaffSyncResult; error?: string; message?: string }

      if (!res.ok || !json.success) throw new Error(json.error ?? 'Sync failed')

      setStaffResult(json.result ?? null)
      setStaffState('done')
      setStaffExpanded(true)
      addToast('success', json.message ?? `Staff sync done — ${json.result?.created ?? 0} created, ${json.result?.updated ?? 0} updated.`)
    } catch (err) {
      setStaffState('error')
      addToast('error', err instanceof Error ? err.message : 'Staff sync failed')
    }
  }

  // ── Jobs sync ───────────────────────────────────────────────────────────────
  async function runJobsSync() {
    setJobsState('running')
    setJobsResult(null)
    try {
      const url = `/api/admin/sync-lark-groups${monthsFilter ? `?months=${monthsFilter}` : ''}`
      const res = await fetch(url, { method: 'POST' })
      const json = await res.json() as { data?: JobSyncResult; error?: string }

      if (!res.ok) throw new Error(json.error ?? 'Jobs sync failed')

      setJobsResult(json.data ?? null)
      setJobsState(json.data && json.data.errors.length > 0 ? 'error' : 'done')
      setJobsExpanded(true)
      const created = json.data?.created ?? 0
      addToast(
        created > 0 ? 'success' : 'success',
        created > 0
          ? `Jobs sync done — ${created} new project(s) imported from Lark.`
          : 'Jobs sync done — all projects already up to date.'
      )
    } catch (err) {
      setJobsState('error')
      addToast('error', err instanceof Error ? err.message : 'Jobs sync failed')
    }
  }

  // ── Drive folder sync ───────────────────────────────────────────────────────
  async function runDriveSync() {
    setDriveState('running')
    setDriveResult(null)
    try {
      const res = await fetch('/api/admin/sync-lark-projects', { method: 'POST' })
      const json = await res.json() as { data?: DriveSyncResult; error?: string }

      if (!res.ok) throw new Error(json.error ?? 'Drive sync failed')

      setDriveResult(json.data ?? null)
      setDriveState(json.data && json.data.errors.length > 0 ? 'error' : 'done')
      setDriveExpanded(true)
      const linked = json.data?.linked ?? 0
      addToast('success', `Drive sync done — ${linked} folder(s) linked to projects.`)
    } catch (err) {
      setDriveState('error')
      addToast('error', err instanceof Error ? err.message : 'Drive sync failed')
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl transition-all ${
              t.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-500/40 text-emerald-300'
                : 'bg-red-950/95 border-red-500/40 text-red-300'
            }`}
          >
            {t.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
            {t.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <Link2 className="w-5 h-5 text-indigo-400" />
          </div>
          <h1 className="text-xl font-semibold text-zinc-100">Lark Import</h1>
        </div>
        <p className="text-sm text-zinc-500 ml-[52px]">
          Sync your team and jobs from Lark into Envicion OS. Run each sync independently.
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-zinc-700/50 bg-zinc-800/30 text-sm text-zinc-400">
        <Info className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
        <span>
          All syncs are <strong className="text-zinc-300">non-destructive</strong> by default — existing records are updated, not overwritten.
          Use the deactivate toggle under Staff if you want to disable members no longer in Lark.
        </span>
      </div>

      {/* ── 1. Staff Sync ─────────────────────────────────────────────────────── */}
      <SyncCard
        icon={Users}
        title="Import Staff (Users)"
        description="Fetches all active members from your Lark directory and creates or updates their accounts in Envicion OS. Roles are mapped automatically from Lark job titles."
        state={staffState}
        onSync={runStaffSync}
        accent="indigo"
        extra={
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
            <div
              onClick={() => setDeactivateMissing(v => !v)}
              className={`relative w-8 h-4.5 rounded-full border transition-colors cursor-pointer ${
                deactivateMissing ? 'bg-indigo-600 border-indigo-500' : 'bg-zinc-700 border-zinc-600'
              }`}
              role="switch"
              aria-checked={deactivateMissing}
            >
              <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${deactivateMissing ? 'translate-x-3' : ''}`} />
            </div>
            Deactivate missing
          </label>
        }
      >
        {staffResult && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <StatPill label="Created" value={staffResult.created} variant={staffResult.created > 0 ? 'success' : 'muted'} />
              <StatPill label="Updated" value={staffResult.updated} variant={staffResult.updated > 0 ? 'success' : 'muted'} />
              <StatPill label="Skipped (no email)" value={staffResult.skipped} variant={staffResult.skipped > 0 ? 'warn' : 'muted'} />
              {staffResult.deactivated > 0 && (
                <StatPill label="Deactivated" value={staffResult.deactivated} variant="warn" />
              )}
            </div>

            {staffResult.errors.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setStaffExpanded(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {staffResult.errors.length} error(s)
                  {staffExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {staffExpanded && (
                  <ul className="mt-2 space-y-1">
                    {staffResult.errors.map((e, i) => (
                      <li key={i} className="text-xs text-red-400/80 font-mono bg-red-950/30 rounded px-2.5 py-1.5">{e}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </SyncCard>

      {/* ── 2. Jobs (Projects) Sync ──────────────────────────────────────────── */}
      <SyncCard
        icon={Briefcase}
        title="Import Jobs (Projects)"
        description="Scans all Lark group chats the bot belongs to and creates a Project + Client record for each group not already in Envicion OS. Use the months filter to limit how far back to look."
        state={jobsState}
        onSync={runJobsSync}
        accent="sky"
        extra={
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-zinc-500 whitespace-nowrap">Last</label>
            <select
              value={monthsFilter}
              onChange={e => setMonthsFilter(e.target.value)}
              className="appearance-none bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-sky-500/60 pr-6"
            >
              <option value="">All time</option>
              <option value="1">1 month</option>
              <option value="3">3 months</option>
              <option value="6">6 months</option>
              <option value="12">12 months</option>
            </select>
          </div>
        }
      >
        {jobsResult && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <StatPill label="Groups found" value={jobsResult.total} />
              <StatPill label="Imported" value={jobsResult.created} variant={jobsResult.created > 0 ? 'success' : 'muted'} />
              <StatPill label="Already exist" value={jobsResult.skipped} variant="muted" />
            </div>

            {/* Newly imported projects */}
            {jobsResult.projects.filter(p => p.isNew).length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setJobsExpanded(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition-colors mb-2"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  {jobsResult.projects.filter(p => p.isNew).length} new project(s) imported
                  {jobsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {jobsExpanded && (
                  <div className="flex flex-wrap gap-2">
                    {jobsResult.projects.filter(p => p.isNew).map(p => (
                      <span
                        key={p.chatId}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-xs text-sky-300"
                      >
                        <span className="font-mono font-semibold text-sky-200">{p.code}</span>
                        <span className="text-sky-400/70">—</span>
                        {p.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {jobsResult.errors.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-400 mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {jobsResult.errors.length} error(s)
                </p>
                <ul className="space-y-1">
                  {jobsResult.errors.map((e, i) => (
                    <li key={i} className="text-xs text-red-400/80 font-mono bg-red-950/30 rounded px-2.5 py-1.5">{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </SyncCard>

      {/* ── 3. Drive Folder Sync ─────────────────────────────────────────────── */}
      <SyncCard
        icon={FolderSync}
        title="Link Drive Folders"
        description="Matches Lark Drive project folders (by folder name = project code) to existing Envicion OS projects and stores the folder token for file uploads."
        state={driveState}
        onSync={runDriveSync}
        accent="violet"
      >
        {driveResult && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <StatPill label="Folders in Lark" value={driveResult.total} />
              <StatPill label="Linked" value={driveResult.linked} variant={driveResult.linked > 0 ? 'success' : 'muted'} />
              <StatPill label="Already linked" value={driveResult.alreadyLinked} variant="muted" />
              {driveResult.unmatched.length > 0 && (
                <StatPill label="No DB match" value={driveResult.unmatched.length} variant="warn" />
              )}
              {driveResult.dbOnly.length > 0 && (
                <StatPill label="DB-only (no folder)" value={driveResult.dbOnly.length} variant="warn" />
              )}
            </div>

            {(driveResult.unmatched.length > 0 || driveResult.dbOnly.length > 0) && (
              <div>
                <button
                  type="button"
                  onClick={() => setDriveExpanded(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  View unmatched items
                  {driveExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {driveExpanded && (
                  <div className="mt-2 space-y-3">
                    {driveResult.unmatched.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-amber-400 mb-1.5">Lark folders with no matching DB project:</p>
                        <div className="flex flex-wrap gap-2">
                          {driveResult.unmatched.map(f => (
                            <span key={f.token} className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono">
                              {f.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {driveResult.dbOnly.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-zinc-400 mb-1.5">DB projects with no Lark folder:</p>
                        <div className="flex flex-wrap gap-2">
                          {driveResult.dbOnly.map(p => (
                            <span key={p.code} className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 font-mono">
                              {p.code}
                              <span className="ml-1.5 text-zinc-600">({p.status})</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {driveResult.errors.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-400 mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {driveResult.errors.length} error(s)
                </p>
                <ul className="space-y-1">
                  {driveResult.errors.map((e, i) => (
                    <li key={i} className="text-xs text-red-400/80 font-mono bg-red-950/30 rounded px-2.5 py-1.5">{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </SyncCard>
    </div>
  )
}
