'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Activity, AlertTriangle, Clock, Cpu, Loader2,
  Pause, Play, RefreshCw, ShieldCheck,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

type AgentKind =
  | 'DEMAND_INTEL' | 'CONTENT_GENERATOR' | 'DISTRIBUTION_ENGINE' | 'PERFORMANCE_OPTIMIZER'
  | 'LEAD_ENGINE' | 'SALES_AGENT' | 'PAYMENT_AGENT' | 'ONBOARDING_AGENT'
  | 'PM_AI' | 'QA_AGENT' | 'DELIVERY_AGENT' | 'REVENUE_EXPANSION'

type AgentDecisionStatus =
  | 'AUTO_EXECUTED' | 'PENDING_APPROVAL' | 'APPROVED'
  | 'REJECTED' | 'OVERRIDDEN' | 'FAILED' | 'SKIPPED'

type AgentRunStatus = 'STARTED' | 'COMPLETED' | 'FAILED'

interface AgentConfig {
  id: string
  agent: AgentKind
  enabled: boolean
  autonomyEnabled: boolean
  confidenceThreshold: number
  valueCapCents: number | null
  pausedReason: string | null
  pausedAt: string | null
}

interface AgentRun {
  id: string
  agent: AgentKind
  triggerKind: string
  status: AgentRunStatus
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  summary: string | null
  error: string | null
}

interface AgentSummary {
  agent: AgentKind
  implemented: boolean
  config: AgentConfig | null
  lastRun: AgentRun | null
  pendingCount: number
  recentRuns: AgentRun[]
}

interface AgentDecision {
  id: string
  agent: AgentKind
  status: AgentDecisionStatus
  action: string
  rationale: string
  confidence: number
  entityType: string | null
  entityId: string | null
  valueCents: number | null
  requiresReview: boolean
  reviewNote: string | null
  createdAt: string
}

interface AgentsPayload {
  agents: AgentSummary[]
  recentDecisions: AgentDecision[]
}

// ─── Static metadata for the 12-agent grid ─────────────────────────────────────

const AGENT_META: Record<AgentKind, { label: string; tagline: string }> = {
  DEMAND_INTEL:          { label: 'Demand Intel',         tagline: 'Scores & qualifies leads' },
  CONTENT_GENERATOR:     { label: 'Content Generator',    tagline: 'Drafts ad / social copy' },
  DISTRIBUTION_ENGINE:   { label: 'Distribution Engine',  tagline: 'Schedules & posts content' },
  PERFORMANCE_OPTIMIZER: { label: 'Performance Optimizer',tagline: 'Tunes ad spend & creatives' },
  LEAD_ENGINE:           { label: 'Lead Engine',          tagline: 'Routes leads to reps / nurtures' },
  SALES_AGENT:           { label: 'Sales Agent',          tagline: 'Drafts proposals & follow-ups' },
  PAYMENT_AGENT:         { label: 'Payment Agent',        tagline: 'Invoices & dunning' },
  ONBOARDING_AGENT:      { label: 'Onboarding Agent',     tagline: 'Welcomes new clients' },
  PM_AI:                 { label: 'PM AI',                tagline: 'Schedules & re-balances work' },
  QA_AGENT:              { label: 'QA Agent',             tagline: 'Reviews deliverables' },
  DELIVERY_AGENT:        { label: 'Delivery Agent',       tagline: 'Hands off to clients' },
  REVENUE_EXPANSION:     { label: 'Revenue Expansion',    tagline: 'Spots upsells & renewals' },
}

const STATUS_BADGE: Record<AgentDecisionStatus, string> = {
  AUTO_EXECUTED:    'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  PENDING_APPROVAL: 'bg-amber-500/15  text-amber-300  border-amber-500/30',
  APPROVED:         'bg-sky-500/15    text-sky-300    border-sky-500/30',
  REJECTED:         'bg-rose-500/15   text-rose-300   border-rose-500/30',
  OVERRIDDEN:       'bg-violet-500/15 text-violet-300 border-violet-500/30',
  FAILED:           'bg-red-500/15    text-red-400    border-red-500/30',
  SKIPPED:          'bg-zinc-500/15   text-zinc-400   border-zinc-500/30',
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AgentControlPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [data, setData] = useState<AgentsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyAgent, setBusyAgent] = useState<AgentKind | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Auth guard
  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user) router.replace('/login')
    else if (session.user.role !== 'ADMIN') router.replace('/')
  }, [session, status, router])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/agents', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: AgentsPayload = await res.json()
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const updateConfig = useCallback(async (
    agent: AgentKind,
    patch: Partial<Pick<AgentConfig, 'enabled' | 'autonomyEnabled' | 'confidenceThreshold' | 'valueCapCents'>>,
  ) => {
    setBusyAgent(agent)
    try {
      const res = await fetch(`/api/admin/agents/${agent}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusyAgent(null)
    }
  }, [load])

  const triggerRun = useCallback(async (agent: AgentKind) => {
    setBusyAgent(agent)
    try {
      const res = await fetch(`/api/admin/agents/${agent}/run`, { method: 'POST' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Run failed')
    } finally {
      setBusyAgent(null)
    }
  }, [load])

  const totals = useMemo(() => {
    if (!data) return { live: 0, paused: 0, pending: 0, planned: 0 }
    let live = 0, paused = 0, pending = 0, planned = 0
    for (const a of data.agents) {
      if (!a.implemented) { planned++; continue }
      if (a.config?.enabled === false) paused++
      else live++
      pending += a.pendingCount
    }
    return { live, paused, pending, planned }
  }, [data])

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-zinc-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading agents…
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Cpu className="w-6 h-6 text-indigo-400" /> Agent Control
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Autonomous agents — auto-with-override. Tune confidence and value caps per agent. Pause anything that misbehaves.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 px-4 py-3 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Summary row */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Live agents"   value={totals.live}    tone="emerald" icon={<Activity className="w-4 h-4" />} />
        <SummaryCard label="Paused"        value={totals.paused}  tone="amber"   icon={<Pause className="w-4 h-4" />} />
        <SummaryCard label="Pending review" value={totals.pending} tone="sky"    icon={<ShieldCheck className="w-4 h-4" />} />
        <SummaryCard label="Planned (not built)" value={totals.planned} tone="zinc" icon={<Clock className="w-4 h-4" />} />
      </section>

      {/* Agent grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.agents.map((a) => (
          <AgentCard
            key={a.agent}
            data={a}
            busy={busyAgent === a.agent}
            onUpdate={(patch) => updateConfig(a.agent, patch)}
            onRun={() => triggerRun(a.agent)}
          />
        ))}
      </section>

      {/* Decision log */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
        <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-medium text-white">Recent decisions</h2>
          <span className="text-xs text-zinc-500">{data.recentDecisions.length} shown</span>
        </header>
        {data.recentDecisions.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-zinc-500">
            No agent decisions yet. Trigger Demand Intel above to seed the log.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {data.recentDecisions.map((d) => (
              <li key={d.id} className="px-4 py-3 flex items-start justify-between gap-4 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded border ${STATUS_BADGE[d.status]}`}>
                      {d.status.replace('_', ' ')}
                    </span>
                    <span className="text-zinc-300 font-medium">{AGENT_META[d.agent]?.label ?? d.agent}</span>
                    <span className="text-zinc-500">·</span>
                    <span className="text-zinc-400">{d.action}</span>
                    {d.entityType && d.entityId && (
                      <span className="text-zinc-600 text-xs">
                        · {d.entityType}:{d.entityId.slice(0, 8)}
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-400 mt-1 truncate">{d.rationale}</p>
                </div>
                <div className="text-right text-xs text-zinc-500 shrink-0">
                  <div>{(d.confidence * 100).toFixed(0)}%</div>
                  <div className="mt-0.5">{new Date(d.createdAt).toLocaleString()}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string
  value: number
  tone: 'emerald' | 'amber' | 'sky' | 'zinc'
  icon: React.ReactNode
}

function SummaryCard({ label, value, tone, icon }: SummaryCardProps) {
  const toneCls: Record<SummaryCardProps['tone'], string> = {
    emerald: 'text-emerald-300',
    amber:   'text-amber-300',
    sky:     'text-sky-300',
    zinc:    'text-zinc-300',
  }
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center gap-2 text-xs text-zinc-400">{icon} {label}</div>
      <div className={`mt-1 text-2xl font-semibold ${toneCls[tone]}`}>{value}</div>
    </div>
  )
}

interface AgentCardProps {
  data: AgentSummary
  busy: boolean
  onUpdate: (patch: Partial<Pick<AgentConfig, 'enabled' | 'autonomyEnabled' | 'confidenceThreshold' | 'valueCapCents'>>) => void
  onRun: () => void
}

function AgentCard({ data, busy, onUpdate, onRun }: AgentCardProps) {
  const meta = AGENT_META[data.agent]
  const enabled = data.config?.enabled ?? true
  const autonomy = data.config?.autonomyEnabled ?? true
  const threshold = data.config?.confidenceThreshold ?? 0.75
  const cap = data.config?.valueCapCents ?? null

  return (
    <div className={`rounded-xl border p-4 ${data.implemented ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-800/50 bg-zinc-900/20 opacity-70'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-white font-medium">{meta.label}</h3>
          <p className="text-xs text-zinc-400 mt-0.5">{meta.tagline}</p>
        </div>
        {data.implemented ? (
          <span className={`text-[10px] px-2 py-0.5 rounded border ${enabled ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'}`}>
            {enabled ? 'LIVE' : 'PAUSED'}
          </span>
        ) : (
          <span className="text-[10px] px-2 py-0.5 rounded border bg-zinc-800 text-zinc-400 border-zinc-700">PLANNED</span>
        )}
      </div>

      {data.implemented && (
        <>
          <dl className="grid grid-cols-2 gap-2 text-xs mt-3">
            <div><dt className="text-zinc-500">Last run</dt><dd className="text-zinc-300 truncate">{data.lastRun ? new Date(data.lastRun.startedAt).toLocaleString() : '—'}</dd></div>
            <div><dt className="text-zinc-500">Pending review</dt><dd className="text-zinc-300">{data.pendingCount}</dd></div>
            <div><dt className="text-zinc-500">Confidence ≥</dt><dd className="text-zinc-300">{(threshold * 100).toFixed(0)}%</dd></div>
            <div><dt className="text-zinc-500">Value cap</dt><dd className="text-zinc-300">{cap === null ? 'none' : `${(cap / 100).toFixed(2)}`}</dd></div>
          </dl>

          {data.lastRun?.summary && (
            <p className="mt-2 text-xs text-zinc-500 truncate">↳ {data.lastRun.summary}</p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              disabled={busy}
              onClick={onRun}
              className="text-xs px-2.5 py-1 rounded bg-indigo-600/80 hover:bg-indigo-600 text-white disabled:opacity-50 flex items-center gap-1"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />} Run now
            </button>
            <button
              disabled={busy}
              onClick={() => onUpdate({ enabled: !enabled })}
              className="text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-50 flex items-center gap-1"
            >
              {enabled ? <><Pause className="w-3 h-3" /> Pause</> : <><Play className="w-3 h-3" /> Resume</>}
            </button>
            <button
              disabled={busy}
              onClick={() => onUpdate({ autonomyEnabled: !autonomy })}
              className="text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-50"
            >
              {autonomy ? 'Switch to manual' : 'Enable autonomy'}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-xs text-zinc-400">
              Confidence threshold
              <input
                type="range" min={0} max={1} step={0.05}
                defaultValue={threshold}
                onMouseUp={(e) => onUpdate({ confidenceThreshold: parseFloat((e.target as HTMLInputElement).value) })}
                onTouchEnd={(e) => onUpdate({ confidenceThreshold: parseFloat((e.target as HTMLInputElement).value) })}
                className="w-full mt-1 accent-indigo-500"
              />
            </label>
            <label className="text-xs text-zinc-400">
              Value cap (RM)
              <input
                type="number" min={0} step={50}
                defaultValue={cap === null ? '' : (cap / 100).toFixed(2)}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  onUpdate({ valueCapCents: v === '' ? null : Math.round(parseFloat(v) * 100) })
                }}
                placeholder="none"
                className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-200"
              />
            </label>
          </div>
        </>
      )}

      {!data.implemented && (
        <p className="mt-3 text-xs text-zinc-500">Coming in Phase 2–4. See the migration roadmap.</p>
      )}
    </div>
  )
}
