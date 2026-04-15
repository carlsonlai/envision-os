'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import {
  Bot,
  User2,
  Zap,
  Bell,
  BarChart3,
  Calendar,
  Settings,
  Check,
  X,
  Loader2,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
  Info,
  Link2,
  Users,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SystemSettings {
  id: string
  autopilotMode: boolean
  autoAssignEnabled: boolean
  larkGanttEnabled: boolean
  larkBriefEnabled: boolean
  autoImportQuotes: boolean
  autoImportInvoices: boolean
  overloadThreshold: number
  weeklyDigestDay: number
  salesAutopilotEnabled: boolean
  updatedAt: string
  updatedById: string | null
}

interface WorkloadSummary {
  totalPendingTasks: number
  totalEstimatedHours: number
  overloadedDesigners: string[]
  criticalDeadlines: Array<{ description: string | null; projectCode: string; deadline: string | null }>
  unassignedTasks: number
  activeProjects: number
}

type SettingKey = keyof Omit<SystemSettings, 'id' | 'updatedAt' | 'updatedById'>

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast {
  id: number
  type: 'success' | 'error'
  message: string
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const { data: session } = useSession()
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [workload, setWorkload] = useState<WorkloadSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<SettingKey | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)
  const [syncingLarkStaff, setSyncingLarkStaff] = useState(false)
  const [syncingLarkGroups, setSyncingLarkGroups] = useState(false)
  const [reconciling, setReconciling] = useState(false)

  function addToast(type: 'success' | 'error', message: string) {
    const id = ++toastId.current
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const [settingsRes, workloadRes] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch('/api/admin/workload'),
      ])
      const settingsJson = await settingsRes.json() as { success: boolean; data: SystemSettings }
      const workloadJson = await workloadRes.json() as {
        success: boolean
        data: {
          totalPendingTasks: number
          totalEstimatedHours: number
          overloadedDesigners: string[]
          criticalDeadlines: Array<{ description: string | null; projectCode: string; deadline: string | null }>
          unassignedTasks: Array<unknown>
          activeProjects: Array<unknown>
        }
      }

      if (settingsJson.success) setSettings(settingsJson.data)
      if (workloadJson.success) {
        setWorkload({
          totalPendingTasks: workloadJson.data.totalPendingTasks,
          totalEstimatedHours: workloadJson.data.totalEstimatedHours,
          overloadedDesigners: workloadJson.data.overloadedDesigners,
          criticalDeadlines: workloadJson.data.criticalDeadlines,
          unassignedTasks: workloadJson.data.unassignedTasks.length,
          activeProjects: workloadJson.data.activeProjects.length,
        })
      }
    } catch {
      addToast('error', 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchSettings()
  }, [fetchSettings])

  async function handleLarkStaffSync() {
    setSyncingLarkStaff(true)
    try {
      const res = await fetch('/api/admin/sync-lark', { method: 'POST' })
      const json = await res.json() as { success: boolean; message?: string; error?: string }
      addToast(json.success ? 'success' : 'error', json.message ?? json.error ?? 'Staff sync done.')
    } catch {
      addToast('error', 'Network error during staff sync.')
    } finally {
      setSyncingLarkStaff(false)
    }
  }

  async function handleLarkGroupSync() {
    setSyncingLarkGroups(true)
    try {
      const res = await fetch('/api/admin/sync-lark-groups?months=6', { method: 'POST' })
      const json = await res.json() as { data?: { created: number; skipped: number; errors: string[] }; error?: string }
      if (json.data) {
        addToast('success', `Groups synced — ${json.data.created} new projects, ${json.data.skipped} skipped.`)
      } else {
        addToast('error', json.error ?? 'Group sync failed.')
      }
    } catch {
      addToast('error', 'Network error during group sync.')
    } finally {
      setSyncingLarkGroups(false)
    }
  }

  async function handleReconcile() {
    setReconciling(true)
    try {
      const res = await fetch('/api/admin/reconcile', { method: 'POST' })
      const json = await res.json() as { success: boolean; message?: string; error?: string }
      addToast(json.success ? 'success' : 'error', json.message ?? json.error ?? 'Reconcile done.')
    } catch {
      addToast('error', 'Network error during reconcile.')
    } finally {
      setReconciling(false)
    }
  }

  async function patch(key: SettingKey, value: boolean | number) {
    if (!settings) return
    setSaving(key)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      })
      const json = await res.json() as { success: boolean; data: SystemSettings; error?: string }
      if (json.success) {
        setSettings(json.data)
        addToast('success', 'Setting saved.')
      } else {
        addToast('error', json.error ?? 'Save failed.')
      }
    } catch {
      addToast('error', 'Network error.')
    } finally {
      setSaving(null)
    }
  }

  if (!session?.user || session.user.role !== 'ADMIN') {
    return <div className="p-10 text-red-400">Access denied.</div>
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    )
  }

  if (!settings) {
    return <div className="p-10 text-zinc-400">Settings unavailable.</div>
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium shadow-xl ${
              t.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300'
                : 'bg-red-950/90 border-red-500/40 text-red-300'
            }`}
          >
            {t.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {t.message}
          </div>
        ))}
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <Settings className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">System Settings</h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                Last updated: {new Date(settings.updatedAt).toLocaleString('en-MY')}
              </p>
            </div>
          </div>
          <button
            onClick={() => void fetchSettings()}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Workload Snapshot */}
        {workload && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Active Projects', value: workload.activeProjects, colour: 'indigo' },
              { label: 'Pending Tasks', value: workload.totalPendingTasks, colour: 'blue' },
              { label: 'Unassigned', value: workload.unassignedTasks, colour: workload.unassignedTasks > 0 ? 'amber' : 'zinc' },
              { label: 'Critical Deadlines', value: workload.criticalDeadlines.length, colour: workload.criticalDeadlines.length > 0 ? 'red' : 'zinc' },
            ].map(({ label, value, colour }) => (
              <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
                <div className={`text-2xl font-bold text-${colour}-400`}>{value}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        )}

        {workload && workload.overloadedDesigners.length > 0 && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/5">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-300">
              <span className="font-semibold">Overloaded:</span>{' '}
              {workload.overloadedDesigners.join(', ')} — consider rebalancing before enabling Autopilot.
            </p>
          </div>
        )}

        {/* ── AUTOPILOT / COPILOT ────────────────────────────────────────────── */}
        <Section icon={<Bot className="w-5 h-5" />} title="AI Mode" colour="indigo">
          <ModeToggle
            autopilot={settings.autopilotMode}
            saving={saving === 'autopilotMode'}
            onChange={(value) => void patch('autopilotMode', value)}
          />

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoCard
              icon={<User2 className="w-4 h-4 text-yellow-400" />}
              label="Copilot Mode"
              description="AI creates the project brief and Gantt, sends to Lark for CS review. Designers are suggested but not auto-assigned. CS activates the project manually."
              active={!settings.autopilotMode}
            />
            <InfoCard
              icon={<Bot className="w-4 h-4 text-indigo-400" />}
              label="Autopilot Mode"
              description="AI creates the project, auto-assigns deliverables to the least-loaded designer, marks project ONGOING, and sends Gantt to Lark — zero human steps required."
              active={settings.autopilotMode}
            />
          </div>
        </Section>

        {/* ── AUTOMATION SETTINGS ────────────────────────────────────────────── */}
        <Section icon={<Zap className="w-5 h-5" />} title="Automation" colour="amber">
          <div className="divide-y divide-zinc-800">
            <Toggle
              label="Auto-assign designers"
              description="When a project is created, automatically assign each deliverable to the most available designer based on skill and workload."
              value={settings.autoAssignEnabled}
              settingKey="autoAssignEnabled"
              saving={saving === 'autoAssignEnabled'}
              onChange={(v) => void patch('autoAssignEnabled', v)}
            />
            <Toggle
              label="Auto-import accepted quotations"
              description="When cron detects a quotation with status 'accepted' or 'approved' in Bukku, automatically create a project without manual import."
              value={settings.autoImportQuotes}
              settingKey="autoImportQuotes"
              saving={saving === 'autoImportQuotes'}
              onChange={(v) => void patch('autoImportQuotes', v)}
            />
            <Toggle
              label="Auto-import invoices"
              description="Automatically create projects for all new Bukku invoices detected during polling (every 5 minutes)."
              value={settings.autoImportInvoices}
              settingKey="autoImportInvoices"
              saving={saving === 'autoImportInvoices'}
              onChange={(v) => void patch('autoImportInvoices', v)}
            />
          </div>
        </Section>

        {/* ── SALES AUTOPILOT ───────────────────────────────────────────────── */}
        <Section icon={<Zap className="w-5 h-5" />} title="Sales Autopilot" colour="emerald">
          <div className="flex items-start gap-4 mb-4">
            <div className="flex-1">
              <p className="text-sm text-zinc-300 font-medium mb-1">Fully automated sales pipeline</p>
              <p className="text-xs text-zinc-500 leading-relaxed">
                When ON, AI automatically responds to new prospects, progresses leads through stages, sends proposals, and follows up — without waiting for human input. Admin can override or take manual control at any time from the AI Sales dashboard.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-1 rounded-xl bg-zinc-800/60 border border-zinc-700 w-fit">
            <button
              onClick={() => settings.salesAutopilotEnabled ? void patch('salesAutopilotEnabled', false) : undefined}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                !settings.salesAutopilotEnabled
                  ? 'bg-yellow-500 text-black shadow-lg'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <User2 className="w-4 h-4" />
              Manual Control
            </button>
            <button
              onClick={() => !settings.salesAutopilotEnabled ? void patch('salesAutopilotEnabled', true) : undefined}
              disabled={saving === 'salesAutopilotEnabled'}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                settings.salesAutopilotEnabled
                  ? 'bg-emerald-600 text-white shadow-lg'
                  : 'text-zinc-400 hover:text-zinc-200'
              } disabled:opacity-60`}
            >
              {saving === 'salesAutopilotEnabled' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
              Full Autopilot
            </button>
          </div>
          {settings.salesAutopilotEnabled && (
            <div className="mt-4 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-300">
                AI Sales Autopilot is <strong>active</strong>. The AI agent is handling prospect responses and lead progression automatically. Go to <strong>AI Sales</strong> to monitor activity or take manual control of any lead.
              </p>
            </div>
          )}
        </Section>

        {/* ── LARK NOTIFICATIONS ────────────────────────────────────────────── */}
        <Section icon={<Bell className="w-5 h-5" />} title="Lark Notifications" colour="blue">
          <div className="divide-y divide-zinc-800">
            <Toggle
              label="Send Gantt chart to Lark"
              description="When a project is created, send a full timeline card (Gantt table) to the CREATIVE Lark channel showing all deliverables, assignees, and deadlines."
              value={settings.larkGanttEnabled}
              settingKey="larkGanttEnabled"
              saving={saving === 'larkGanttEnabled'}
              onChange={(v) => void patch('larkGanttEnabled', v)}
            />
            <Toggle
              label="Send project brief summary to Lark"
              description="Send a project summary card to the CS channel when a new project is created, with a link to review and complete the brief."
              value={settings.larkBriefEnabled}
              settingKey="larkBriefEnabled"
              saving={saving === 'larkBriefEnabled'}
              onChange={(v) => void patch('larkBriefEnabled', v)}
            />
          </div>
        </Section>

        {/* ── WORKLOAD THRESHOLDS ────────────────────────────────────────────── */}
        <Section icon={<BarChart3 className="w-5 h-5" />} title="Workload Thresholds" colour="emerald">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-zinc-300 font-medium">
                  Overload alert threshold
                </label>
                <span className="text-sm font-mono text-emerald-400">{settings.overloadThreshold}%</span>
              </div>
              <p className="text-xs text-zinc-500 mb-3">
                Alert management when a designer&apos;s daily utilisation exceeds this percentage.
              </p>
              <input
                type="range"
                min={50}
                max={100}
                step={5}
                value={settings.overloadThreshold}
                onChange={(e) => setSettings({ ...settings, overloadThreshold: Number(e.target.value) })}
                onMouseUp={(e) => void patch('overloadThreshold', Number((e.target as HTMLInputElement).value))}
                onTouchEnd={(e) => void patch('overloadThreshold', Number((e.target as HTMLInputElement).value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-xs text-zinc-600 mt-1">
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        </Section>

        {/* ── WEEKLY DIGEST ────────────────────────────────────────────────── */}
        <Section icon={<Calendar className="w-5 h-5" />} title="Weekly Digest" colour="purple">
          <div>
            <p className="text-sm text-zinc-400 mb-3">
              Day of week for the automated team capacity digest sent to Management channel.
            </p>
            <div className="flex flex-wrap gap-2">
              {DAY_NAMES.map((day, i) => (
                <button
                  key={day}
                  onClick={() => void patch('weeklyDigestDay', i)}
                  disabled={saving === 'weeklyDigestDay'}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                    settings.weeklyDigestDay === i
                      ? 'bg-purple-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 border border-zinc-700'
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* ── DATA SYNC ─────────────────────────────────────────────────────── */}
        <Section icon={<Link2 className="w-5 h-5" />} title="Data Sync" colour="indigo">
          <div className="p-5 space-y-4">
            <p className="text-xs text-zinc-500 leading-relaxed">
              Run these in order: <span className="text-zinc-300 font-medium">Sync Staff → Sync Projects → Reconcile with Bukku.</span> Each step is safe to re-run — it only fills gaps, never overwrites existing data.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Sync Staff */}
              <button
                type="button"
                onClick={() => void handleLarkStaffSync()}
                disabled={syncingLarkStaff}
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700/60 hover:border-indigo-500/40 text-sm font-medium text-zinc-300 hover:text-indigo-300 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Users className={`w-4 h-4 shrink-0 ${syncingLarkStaff ? 'animate-spin' : ''}`} />
                <div className="text-left">
                  <div>{syncingLarkStaff ? 'Syncing…' : 'Sync Staff'}</div>
                  <div className="text-[10px] text-zinc-500 font-normal">Import Lark team members</div>
                </div>
              </button>

              {/* Sync Projects */}
              <button
                type="button"
                onClick={() => void handleLarkGroupSync()}
                disabled={syncingLarkGroups}
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700/60 hover:border-indigo-500/40 text-sm font-medium text-zinc-300 hover:text-indigo-300 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4 shrink-0 ${syncingLarkGroups ? 'animate-spin' : ''}`} />
                <div className="text-left">
                  <div>{syncingLarkGroups ? 'Syncing…' : 'Sync Projects'}</div>
                  <div className="text-[10px] text-zinc-500 font-normal">Last 6 months of Lark groups</div>
                </div>
              </button>

              {/* Reconcile */}
              <button
                type="button"
                onClick={() => void handleReconcile()}
                disabled={reconciling}
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700/60 hover:border-emerald-500/40 text-sm font-medium text-zinc-300 hover:text-emerald-300 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Link2 className={`w-4 h-4 shrink-0 ${reconciling ? 'animate-pulse' : ''}`} />
                <div className="text-left">
                  <div>{reconciling ? 'Reconciling…' : 'Reconcile Bukku'}</div>
                  <div className="text-[10px] text-zinc-500 font-normal">Match clients to Bukku contacts</div>
                </div>
              </button>
            </div>
          </div>
        </Section>

        {/* ── PIPELINE OVERVIEW ────────────────────────────────────────────────── */}
        {workload && workload.criticalDeadlines.length > 0 && (
          <Section icon={<AlertTriangle className="w-5 h-5" />} title="Critical Deadlines (≤ 3 days)" colour="red">
            <div className="divide-y divide-zinc-800">
              {workload.criticalDeadlines.slice(0, 8).map((d, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5">
                  <ChevronRight className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-zinc-200 truncate block">
                      {d.description ?? 'Deliverable'} — <span className="text-zinc-500">{d.projectCode}</span>
                    </span>
                  </div>
                  <span className="text-xs text-red-400 font-mono shrink-0">
                    {d.deadline ? new Date(d.deadline).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' }) : 'TBD'}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

interface SectionProps {
  icon: React.ReactNode
  title: string
  colour: string
  children: React.ReactNode
}

function Section({ icon, title, colour, children }: SectionProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <div className={`flex items-center gap-3 px-5 py-4 border-b border-zinc-800 bg-${colour}-500/5`}>
        <span className={`text-${colour}-400`}>{icon}</span>
        <h2 className="font-semibold text-sm text-zinc-100">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

// ── Mode Toggle ────────────────────────────────────────────────────────────────

interface ModeToggleProps {
  autopilot: boolean
  saving: boolean
  onChange: (value: boolean) => void
}

function ModeToggle({ autopilot, saving, onChange }: ModeToggleProps) {
  return (
    <div className="flex items-center gap-3 p-1 rounded-xl bg-zinc-800/60 border border-zinc-700 w-fit">
      <button
        onClick={() => !autopilot ? undefined : onChange(false)}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
          !autopilot
            ? 'bg-yellow-500 text-black shadow-lg'
            : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <User2 className="w-4 h-4" />
        Copilot
      </button>
      <button
        onClick={() => autopilot ? undefined : onChange(true)}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
          autopilot
            ? 'bg-indigo-600 text-white shadow-lg'
            : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
        Autopilot
      </button>
    </div>
  )
}

// ── Toggle Row ─────────────────────────────────────────────────────────────────

interface ToggleProps {
  label: string
  description: string
  value: boolean
  settingKey: SettingKey
  saving: boolean
  onChange: (value: boolean) => void
}

function Toggle({ label, description, value, saving, onChange }: ToggleProps) {
  return (
    <div className="flex items-start gap-4 py-3.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-zinc-200">{label}</span>
          {value && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">ON</span>}
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        disabled={saving}
        className={`relative shrink-0 mt-0.5 w-11 h-6 rounded-full overflow-hidden transition-colors duration-200 focus:outline-none ${
          value ? 'bg-indigo-600' : 'bg-zinc-700'
        } disabled:opacity-60`}
        role="switch"
        aria-checked={value}
      >
        {saving ? (
          <Loader2 className="absolute top-1 left-1 w-4 h-4 text-white animate-spin" />
        ) : (
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
              value ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        )}
      </button>
    </div>
  )
}

// ── Info Card ──────────────────────────────────────────────────────────────────

interface InfoCardProps {
  icon: React.ReactNode
  label: string
  description: string
  active: boolean
}

function InfoCard({ icon, label, description, active }: InfoCardProps) {
  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        active
          ? 'border-indigo-500/40 bg-indigo-500/5'
          : 'border-zinc-800 bg-zinc-800/20 opacity-50'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium text-zinc-200">{label}</span>
        {active && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">ACTIVE</span>}
      </div>
      <p className="text-xs text-zinc-500 leading-relaxed">{description}</p>
    </div>
  )
}
