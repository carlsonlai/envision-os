'use client'

/**
 * /admin/brain — The Boss cockpit.
 *
 * Single-screen view of Envicion OS as a goal-driven organism:
 *   • Revenue target vs. paid-this-month, with pace.
 *   • Latest AI Brain decisions (what the system wants to do next).
 *   • Per-project profitability heatmap (worst margin first).
 *   • Client-level margin erosion table.
 *   • Margin leaks queue (action + severity).
 *   • Recent agent runs + open failsafe incidents.
 *
 * Manual trigger buttons for Brain run + Profit sweep. Reads from
 * /api/ai/brain/state; mutates via /api/ai/brain/run and /api/cron/profit-sweep.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Cpu,
  DollarSign,
  Gauge,
  Loader2,
  RefreshCw,
  Shield,
  Target as TargetIcon,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DecisionRow {
  id: string
  agent: string
  status: string
  action: string
  rationale: string
  confidence: number
  valueCents: number | null
  entityType: string | null
  entityId: string | null
  requiresReview: boolean
  createdAt: string
}

interface ProjectProfitRow {
  projectId: string
  projectCode: string
  clientId: string | null
  revenue: number
  cost: number
  profit: number
  margin: number
  actualMinutes: number
  estimatedMinutes: number
  revisionSum: number
  revisionLimitSum: number
  overdueUnbilled: boolean
}

interface ClientProfitRow {
  clientId: string
  clientName: string
  projectCount: number
  revenue: number
  cost: number
  profit: number
  margin: number
}

interface AgentRunRow {
  id: string
  agent: string
  status: string
  triggerKind: string
  summary: string | null
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
}

interface BrainState {
  generatedAt: string
  revenue: {
    target: number
    paidThisMonth: number
    gap: number
    daysElapsed: number
    daysInMonth: number
  }
  latestBrainRun: {
    id: string
    status: string
    summary: string | null
    startedAt: string
    finishedAt: string | null
    decisions: DecisionRow[]
  } | null
  profitability: {
    projects: ProjectProfitRow[]
    clients: ClientProfitRow[]
  }
  recentDecisions: DecisionRow[]
  recentRuns: AgentRunRow[]
  openIncidents: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRM(value: number): string {
  return `RM ${Math.round(value).toLocaleString('en-MY')}`
}

function fmtPct(value: number): string {
  return `${Math.round(value * 100)}%`
}

function fmtCents(cents: number | null): string {
  if (cents === null || cents === undefined) return '—'
  return fmtRM(cents / 100)
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}

function marginTint(margin: number): string {
  if (margin < 0) return 'bg-red-500/15 text-red-300 border-red-500/30'
  if (margin < 0.2) return 'bg-amber-500/15 text-amber-300 border-amber-500/30'
  if (margin < 0.35) return 'bg-yellow-500/10 text-yellow-200 border-yellow-500/30'
  return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
}

function agentPillColor(agent: string): string {
  switch (agent) {
    case 'PM_AI':
      return 'bg-[#6366f1]/15 text-[#a5b4fc] border-[#6366f1]/30'
    case 'SALES_AGENT':
      return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
    case 'PAYMENT_AGENT':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    case 'LEAD_ENGINE':
      return 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30'
    case 'DELIVERY_AGENT':
      return 'bg-violet-500/15 text-violet-300 border-violet-500/30'
    case 'QA_AGENT':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30'
    default:
      return 'bg-zinc-700/40 text-zinc-300 border-zinc-600/40'
  }
}

function decisionStatusTint(status: string): string {
  switch (status) {
    case 'AUTO_EXECUTED':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    case 'PENDING_APPROVAL':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30'
    case 'APPROVED':
      return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
    case 'REJECTED':
    case 'FAILED':
      return 'bg-red-500/15 text-red-300 border-red-500/30'
    default:
      return 'bg-zinc-700/40 text-zinc-300 border-zinc-600/40'
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BrainCockpitPage() {
  const { data: session, status } = useSession()
  const [state, setState] = useState<BrainState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [runningBrain, setRunningBrain] = useState(false)
  const [runningSweep, setRunningSweep] = useState(false)
  const [lastRunMessage, setLastRunMessage] = useState<string | null>(null)

  const fetchState = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/ai/brain/state', { cache: 'no-store' })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`${res.status}: ${text.slice(0, 200)}`)
      }
      const payload = (await res.json()) as { data: BrainState }
      setState(payload.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') fetchState()
  }, [fetchState, status])

  const runBrain = useCallback(async () => {
    setRunningBrain(true)
    setLastRunMessage(null)
    try {
      const res = await fetch('/api/ai/brain/run', { method: 'POST' })
      const body = (await res.json()) as {
        data?: { summary: string; decisionCount: number }
        error?: string
      }
      if (!res.ok) throw new Error(body.error ?? 'Brain run failed')
      setLastRunMessage(
        `Brain: ${body.data?.summary ?? 'ok'} (${body.data?.decisionCount ?? 0} decisions)`
      )
      await fetchState()
    } catch (err) {
      setLastRunMessage(
        `Brain failed: ${err instanceof Error ? err.message : 'unknown'}`
      )
    } finally {
      setRunningBrain(false)
    }
  }, [fetchState])

  const runSweep = useCallback(async () => {
    setRunningSweep(true)
    setLastRunMessage(null)
    try {
      const res = await fetch('/api/cron/profit-sweep', { method: 'POST' })
      const body = (await res.json()) as {
        data?: { summary: string; leakCount: number }
        error?: string
      }
      if (!res.ok) throw new Error(body.error ?? 'Sweep failed')
      setLastRunMessage(
        `Sweep: ${body.data?.summary ?? 'ok'} (${body.data?.leakCount ?? 0} leaks)`
      )
      await fetchState()
    } catch (err) {
      setLastRunMessage(
        `Sweep failed: ${err instanceof Error ? err.message : 'unknown'}`
      )
    } finally {
      setRunningSweep(false)
    }
  }, [fetchState])

  const revenuePace = useMemo(() => {
    if (!state || state.revenue.target <= 0) return null
    const pctClosed = state.revenue.paidThisMonth / state.revenue.target
    const pctElapsed = state.revenue.daysElapsed / state.revenue.daysInMonth
    return {
      pctClosed,
      pctElapsed,
      onPace: pctClosed >= pctElapsed - 0.1,
      severelyBehind: pctClosed < pctElapsed - 0.3,
    }
  }, [state])

  // ── Loading / auth guards ──

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="ml-2">Loading Brain cockpit…</span>
      </div>
    )
  }

  if (status === 'unauthenticated' || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-300">
        Please sign in.
      </div>
    )
  }

  if (session.user.role !== 'ADMIN') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-300">
        <div className="max-w-md text-center">
          <Shield className="mx-auto mb-3 h-8 w-8 text-zinc-500" />
          <h1 className="text-lg font-semibold">Boss-only view</h1>
          <p className="mt-1 text-sm text-zinc-500">
            The Brain cockpit is restricted to ADMIN.
          </p>
        </div>
      </div>
    )
  }

  if (error || !state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-red-300">
        <div className="max-w-md rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" /> Failed to load
          </div>
          <p className="mt-1 text-sm text-red-200/80">
            {error ?? 'No state available'}
          </p>
          <button
            onClick={fetchState}
            className="mt-3 rounded-md border border-red-500/40 px-3 py-1 text-xs hover:bg-red-500/20"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const { revenue, latestBrainRun, profitability, recentDecisions, recentRuns, openIncidents } =
    state

  // ── Render ──

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] p-2">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">AI Brain Cockpit</h1>
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              Envicion OS — CEO+COO layer. Decisions, margin guard, pace.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runBrain}
              disabled={runningBrain}
              className="flex items-center gap-2 rounded-md border border-[#6366f1]/40 bg-[#6366f1]/10 px-3 py-2 text-sm text-[#a5b4fc] hover:bg-[#6366f1]/20 disabled:opacity-50"
            >
              {runningBrain ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Brain className="h-4 w-4" />
              )}
              Run Brain
            </button>
            <button
              onClick={runSweep}
              disabled={runningSweep}
              className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {runningSweep ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Gauge className="h-4 w-4" />
              )}
              Profit Sweep
            </button>
            <button
              onClick={fetchState}
              className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </div>

        {lastRunMessage && (
          <div className="mb-4 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
            {lastRunMessage}
          </div>
        )}

        {/* Revenue pace band */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard
            icon={<TargetIcon className="h-4 w-4" />}
            label="Monthly target"
            value={revenue.target > 0 ? fmtRM(revenue.target) : 'Not set'}
            sub={
              revenue.target > 0
                ? `${revenue.daysElapsed}/${revenue.daysInMonth} days elapsed`
                : 'Set a target to enable brain pacing'
            }
            tone="indigo"
          />
          <StatCard
            icon={<DollarSign className="h-4 w-4" />}
            label="Paid this month"
            value={fmtRM(revenue.paidThisMonth)}
            sub={
              revenuePace
                ? `${fmtPct(revenuePace.pctClosed)} of target`
                : undefined
            }
            tone="emerald"
          />
          <StatCard
            icon={
              revenuePace?.onPace ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )
            }
            label="Pace"
            value={
              revenuePace
                ? revenuePace.severelyBehind
                  ? 'Critical'
                  : revenuePace.onPace
                    ? 'On pace'
                    : 'Behind'
                : '—'
            }
            sub={
              revenuePace
                ? `Month ${fmtPct(revenuePace.pctElapsed)} elapsed`
                : undefined
            }
            tone={
              revenuePace?.severelyBehind
                ? 'red'
                : revenuePace?.onPace
                  ? 'emerald'
                  : 'amber'
            }
          />
          <StatCard
            icon={<Shield className="h-4 w-4" />}
            label="Open incidents"
            value={openIncidents.toString()}
            sub={openIncidents > 0 ? 'Failsafe tripped' : 'All green'}
            tone={openIncidents > 0 ? 'red' : 'emerald'}
          />
        </div>

        {/* Latest Brain decisions */}
        <section className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-[#a5b4fc]" />
              <h2 className="text-sm font-semibold">Latest Brain pass</h2>
            </div>
            {latestBrainRun && (
              <div className="text-xs text-zinc-500">
                {timeAgo(latestBrainRun.startedAt)} · {latestBrainRun.status}
              </div>
            )}
          </div>
          <div className="p-4">
            {!latestBrainRun && (
              <div className="text-sm text-zinc-500">
                No Brain runs yet. Click{' '}
                <span className="text-[#a5b4fc]">Run Brain</span> to trigger one.
              </div>
            )}
            {latestBrainRun && latestBrainRun.decisions.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                {latestBrainRun.summary ?? 'No decisions — all targets on pace.'}
              </div>
            )}
            {latestBrainRun && latestBrainRun.decisions.length > 0 && (
              <ul className="space-y-3">
                {latestBrainRun.decisions.map((d) => (
                  <li
                    key={d.id}
                    className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${agentPillColor(d.agent)}`}
                      >
                        {d.agent}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${decisionStatusTint(d.status)}`}
                      >
                        {d.status.replace('_', ' ')}
                      </span>
                      <span className="rounded-full border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-[10px] text-zinc-300">
                        {Math.round(d.confidence * 100)}% conf
                      </span>
                      {d.valueCents !== null && (
                        <span className="rounded-full border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-[10px] text-zinc-300">
                          {fmtCents(d.valueCents)} impact
                        </span>
                      )}
                      <span className="ml-auto text-[11px] text-zinc-500">
                        {timeAgo(d.createdAt)}
                      </span>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-zinc-100">
                      {d.action.replace(/_/g, ' ')}
                    </div>
                    <div className="mt-1 text-xs text-zinc-400">{d.rationale}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Grid: Profit projects + clients */}
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Worst-margin projects */}
          <section className="rounded-lg border border-zinc-800 bg-zinc-900/60">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-emerald-300" />
                <h2 className="text-sm font-semibold">Project margin (worst first)</h2>
              </div>
              <div className="text-xs text-zinc-500">
                {profitability.projects.length} scanned
              </div>
            </div>
            <div className="max-h-[420px] overflow-y-auto p-4">
              {profitability.projects.length === 0 ? (
                <div className="text-sm text-zinc-500">
                  No active projects to score.
                </div>
              ) : (
                <ul className="space-y-2">
                  {profitability.projects.slice(0, 15).map((p) => (
                    <li
                      key={p.projectId}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2"
                    >
                      <Link
                        href={`/projects/${p.projectId}`}
                        className="font-mono text-sm text-[#a5b4fc] hover:underline"
                      >
                        {p.projectCode}
                      </Link>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] ${marginTint(p.margin)}`}
                      >
                        {fmtPct(p.margin)} margin
                      </span>
                      {p.overdueUnbilled && (
                        <span className="rounded-full border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[10px] text-red-300">
                          overdue + unbilled
                        </span>
                      )}
                      {p.revisionLimitSum > 0 &&
                        p.revisionSum >= p.revisionLimitSum && (
                          <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">
                            revisions {p.revisionSum}/{p.revisionLimitSum}
                          </span>
                        )}
                      <span className="ml-auto text-xs text-zinc-400">
                        rev {fmtRM(p.revenue)} · cost {fmtRM(p.cost)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Client margin */}
          <section className="rounded-lg border border-zinc-800 bg-zinc-900/60">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-amber-300" />
                <h2 className="text-sm font-semibold">Client margin</h2>
              </div>
              <div className="text-xs text-zinc-500">
                {profitability.clients.length} clients
              </div>
            </div>
            <div className="max-h-[420px] overflow-y-auto p-4">
              {profitability.clients.length === 0 ? (
                <div className="text-sm text-zinc-500">
                  No clients yet with billed projects.
                </div>
              ) : (
                <ul className="space-y-2">
                  {profitability.clients.slice(0, 15).map((c) => (
                    <li
                      key={c.clientId}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2"
                    >
                      <span className="text-sm font-medium text-zinc-100">
                        {c.clientName}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] ${marginTint(c.margin)}`}
                      >
                        {fmtPct(c.margin)}
                      </span>
                      <span className="rounded-full border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-[10px] text-zinc-300">
                        {c.projectCount} proj
                      </span>
                      <span className="ml-auto text-xs text-zinc-400">
                        rev {fmtRM(c.revenue)} · profit {fmtRM(c.profit)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        {/* Recent decisions feed */}
        <section className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#a5b4fc]" />
              <h2 className="text-sm font-semibold">Agent decisions feed</h2>
            </div>
            <div className="text-xs text-zinc-500">
              last {recentDecisions.length}
            </div>
          </div>
          <div className="max-h-[360px] overflow-y-auto p-4">
            {recentDecisions.length === 0 ? (
              <div className="text-sm text-zinc-500">
                No agent decisions recorded yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {recentDecisions.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2"
                  >
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${agentPillColor(d.agent)}`}
                    >
                      {d.agent}
                    </span>
                    <span className="text-xs font-medium text-zinc-100">
                      {d.action.replace(/_/g, ' ')}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] ${decisionStatusTint(d.status)}`}
                    >
                      {d.status.replace('_', ' ')}
                    </span>
                    {d.valueCents !== null && (
                      <span className="text-xs text-zinc-400">
                        {fmtCents(d.valueCents)}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-zinc-500">
                      {timeAgo(d.createdAt)}
                    </span>
                    <div className="basis-full text-xs text-zinc-400">
                      {d.rationale}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Recent agent runs */}
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-zinc-400" />
              <h2 className="text-sm font-semibold">Recent agent runs</h2>
            </div>
          </div>
          <div className="p-4">
            {recentRuns.length === 0 ? (
              <div className="text-sm text-zinc-500">No runs yet.</div>
            ) : (
              <ul className="divide-y divide-zinc-800">
                {recentRuns.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center gap-2 py-2 text-xs"
                  >
                    <span
                      className={`rounded-full border px-2 py-0.5 uppercase ${agentPillColor(r.agent)}`}
                    >
                      {r.agent}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 ${
                        r.status === 'COMPLETED'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : r.status === 'FAILED'
                            ? 'bg-red-500/15 text-red-300 border-red-500/30'
                            : 'bg-zinc-700/40 text-zinc-300 border-zinc-600/40'
                      }`}
                    >
                      {r.status}
                    </span>
                    <span className="text-zinc-400">{r.triggerKind}</span>
                    <span className="flex-1 text-zinc-300">
                      {r.summary ?? '—'}
                    </span>
                    <span className="text-zinc-500">{timeAgo(r.startedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="mt-6 text-center text-xs text-zinc-600">
          Generated {timeAgo(state.generatedAt)} · All currency in RM
        </div>
      </div>
    </div>
  )
}

// ─── Small components ─────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  tone: 'indigo' | 'emerald' | 'amber' | 'red'
}

function StatCard({ icon, label, value, sub, tone }: StatCardProps) {
  const toneClass: Record<StatCardProps['tone'], string> = {
    indigo: 'border-[#6366f1]/30 bg-[#6366f1]/10 text-[#a5b4fc]',
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    red: 'border-red-500/30 bg-red-500/10 text-red-300',
  }
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-zinc-500">
          {label}
        </span>
        <span className={`rounded-md border p-1.5 ${toneClass[tone]}`}>
          {icon}
        </span>
      </div>
      <div className="mt-3 text-2xl font-bold text-zinc-100">{value}</div>
      {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
    </div>
  )
}
