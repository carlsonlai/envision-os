'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Users,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Zap,
  Target,
  Eye,
} from 'lucide-react'
import type { StaffMetricItem } from '@/app/api/admin/staff-metrics/route'
import { ViewToggle, type ViewMode } from '@/components/ui/view-toggle'

const ROLE_LABELS: Record<string, string> = {
  SALES: 'Sales',
  CLIENT_SERVICING: 'Client Services',
  CREATIVE_DIRECTOR: 'Creative Director',
  SENIOR_ART_DIRECTOR: 'Senior Art Director',
  JUNIOR_ART_DIRECTOR: 'Junior Art Director',
  GRAPHIC_DESIGNER: 'Graphic Designer',
  JUNIOR_DESIGNER: 'Junior Designer',
  DESIGNER_3D: '3D Designer',
  DIGITAL_MARKETING: 'Digital Marketing',
  AI_SALES_AGENT: 'AI Sales Agent',
  AI_CS_AGENT: 'AI CS Agent',
}

const ACTIVITY_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  ACTIVE: { label: 'Active', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', dot: 'bg-emerald-400' },
  IDLE: { label: 'Idle', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', dot: 'bg-amber-400' },
  OVERLOADED: { label: 'Overloaded', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', dot: 'bg-red-400' },
  OFFLINE: { label: 'Offline', color: 'text-zinc-500', bg: 'bg-zinc-800/40 border-zinc-700', dot: 'bg-zinc-600' },
}

function ScoreBar({ value, alert }: { value: number; alert?: boolean }) {
  if (value === 0) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-zinc-800" />
        <span className="text-xs text-zinc-600 w-8 text-right">N/A</span>
      </div>
    )
  }
  const color = value >= 80 ? 'bg-emerald-500' : value >= 60 ? 'bg-[#6366f1]' : value >= 40 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className={`text-xs font-bold w-8 text-right ${alert && value < 60 ? 'text-red-400' : 'text-zinc-300'}`}>{value}</span>
    </div>
  )
}

export default function StaffMonitorPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [metrics, setMetrics] = useState<StaffMetricItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStaff, setSelectedStaff] = useState<StaffMetricItem | null>(null)
  const [filter, setFilter] = useState<'ALL' | 'IDLE' | 'AT_RISK' | 'AI'>('ALL')
  const [view, setView] = useState<ViewMode>('list')

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated' && session.user.role !== 'ADMIN') { router.push('/command'); return }
  }, [status, session, router])

  const loadMetrics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/staff-metrics')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as { data: StaffMetricItem[] }
      setMetrics(json.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load staff metrics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      void loadMetrics()
    }
  }, [status, loadMetrics])

  const filtered = metrics.filter((m) => {
    if (filter === 'IDLE') return m.activityStatus === 'IDLE' || m.activityStatus === 'OFFLINE'
    if (filter === 'AT_RISK') return m.productivityScore > 0 && m.productivityScore < 65
    if (filter === 'AI') return m.role.startsWith('AI_')
    return true
  })

  const idleCount = metrics.filter((m) => ['IDLE', 'OFFLINE'].includes(m.activityStatus)).length
  const atRiskCount = metrics.filter((m) => m.productivityScore > 0 && m.productivityScore < 65).length
  const scoredMembers = metrics.filter((m) => m.productivityScore > 0)
  const avgScore = scoredMembers.length > 0
    ? Math.round(scoredMembers.reduce((s, m) => s + m.productivityScore, 0) / scoredMembers.length)
    : 0
  const bonusCount = metrics.filter((m) => m.bonusEligible).length
  const humanStaffCount = metrics.filter((m) => !m.role.startsWith('AI_')).length

  const TrendIcon = ({ trend }: { trend: StaffMetricItem['kpiTrend'] }) => {
    if (trend === 'UP') return <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
    if (trend === 'DOWN') return <TrendingDown className="h-3.5 w-3.5 text-red-400" />
    return <Minus className="h-3.5 w-3.5 text-zinc-500" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-red-400">{error}</p>
        <button
          type="button"
          onClick={() => void loadMetrics()}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Staff Performance Monitor</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Live productivity metrics sourced from deliverable activity and workload data</p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle view={view} onChange={setView} />
          <button
            type="button"
            onClick={() => void loadMetrics()}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total Staff', value: metrics.length, icon: Users, color: 'bg-[#6366f1]/15 text-[#818cf8]' },
          { label: 'Idle / Offline', value: idleCount, icon: Clock, color: idleCount > 0 ? 'bg-amber-500/15 text-amber-400' : 'bg-zinc-800/40 text-zinc-500' },
          { label: 'At Risk (Score < 65)', value: atRiskCount, icon: AlertTriangle, color: atRiskCount > 0 ? 'bg-red-500/15 text-red-400' : 'bg-zinc-800/40 text-zinc-500' },
          { label: 'Bonus Eligible', value: `${bonusCount}/${humanStaffCount}`, icon: Target, color: 'bg-emerald-500/15 text-emerald-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 flex items-center gap-3">
            <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xl font-bold text-zinc-100">{value}</p>
              <p className="text-xs text-zinc-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Agency Score Bar */}
      {avgScore > 0 && (
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-zinc-300">Agency Productivity Score</span>
            <span className={`text-lg font-bold ${avgScore >= 75 ? 'text-emerald-400' : avgScore >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{avgScore}/100</span>
          </div>
          <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${avgScore >= 75 ? 'bg-emerald-500' : avgScore >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${avgScore}%` }}
            />
          </div>
          <p className="text-xs text-zinc-600 mt-1.5">
            {avgScore >= 80
              ? '✓ Team is performing well — no immediate action needed'
              : avgScore >= 65
                ? '⚠ Some staff below benchmark — review idle and at-risk flags'
                : '⚠ Agency performance is below target — immediate review required'}
          </p>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {(['ALL', 'IDLE', 'AT_RISK', 'AI'] as const).map((f) => {
          const counts = {
            ALL: metrics.length,
            IDLE: idleCount,
            AT_RISK: atRiskCount,
            AI: metrics.filter((m) => m.role.startsWith('AI_')).length,
          }
          return (
            <button
              type="button"
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-[#6366f1]/15 border-[#6366f1]/40 text-[#818cf8]'
                  : 'border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
              }`}
            >
              {f === 'IDLE' ? 'Idle / Offline' : f === 'AT_RISK' ? 'At Risk' : f}
              <span className="rounded-full bg-zinc-800/60 px-1.5 text-[10px]">{counts[f]}</span>
            </button>
          )
        })}
      </div>

      {/* Staff — empty */}
      {filtered.length === 0 && (
        <div className="rounded-xl border border-zinc-800/40 bg-zinc-900/20 p-8 text-center">
          <p className="text-sm text-zinc-500">No staff match this filter.</p>
        </div>
      )}

      {/* Bento / Card view */}
      {filtered.length > 0 && view === 'bento' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => {
            const activity = ACTIVITY_CONFIG[m.activityStatus]
            const isAI = m.role.startsWith('AI_')
            const scoreColor = m.productivityScore >= 80 ? 'text-emerald-400' : m.productivityScore >= 60 ? 'text-amber-400' : m.productivityScore > 0 ? 'text-red-400' : 'text-zinc-600'
            return (
              <div key={m.userId} className={`rounded-xl border p-4 space-y-3 transition-colors ${
                isAI ? 'border-emerald-500/20 bg-emerald-500/3' :
                m.productivityScore > 0 && m.productivityScore < 65 ? 'border-red-500/20 bg-red-500/3' :
                'border-zinc-800/60 bg-zinc-900/40'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`relative flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold flex-shrink-0 ${isAI ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#6366f1]/20 text-[#818cf8]'}`}>
                      {isAI ? '🤖' : m.name[0]}
                      <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0d0d14] ${activity.dot}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">{m.name}</p>
                      <p className="text-[10px] text-zinc-500">{ROLE_LABELS[m.role] ?? m.role}</p>
                    </div>
                  </div>
                  <span className={`text-xl font-bold ${scoreColor}`}>
                    {m.productivityScore > 0 ? m.productivityScore : '—'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-sm font-bold text-emerald-400">{m.tasksCompleted}</p>
                    <p className="text-[9px] text-zinc-600">Done</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#818cf8]">{m.tasksInProgress}</p>
                    <p className="text-[9px] text-zinc-600">Active</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-zinc-400">{m.tasksPending}</p>
                    <p className="text-[9px] text-zinc-600">Pending</p>
                  </div>
                </div>
                <ScoreBar value={m.productivityScore} alert />
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${activity.bg} ${activity.color}`}>
                    {m.utilizationToday > 0 ? `${m.utilizationToday}% util` : activity.label}
                  </span>
                  {!isAI && m.productivityScore > 0 && (
                    m.bonusEligible
                      ? <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">Bonus ✓</span>
                      : <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5">No Bonus</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* List / Expandable rows view */}
      {filtered.length > 0 && view === 'list' && (
        <div className="space-y-2">
          {filtered.map((m) => {
            const activity = ACTIVITY_CONFIG[m.activityStatus]
            const isAI = m.role.startsWith('AI_')
            const hasTaskData = m.tasksCompleted > 0 || m.tasksInProgress > 0 || m.tasksPending > 0
            return (
              <div
                key={m.userId}
                onClick={() => setSelectedStaff(selectedStaff?.userId === m.userId ? null : m)}
                className={`rounded-xl border cursor-pointer transition-colors ${
                  selectedStaff?.userId === m.userId
                    ? 'border-[#6366f1]/40 bg-[#6366f1]/5'
                    : isAI
                      ? 'border-emerald-500/20 bg-emerald-500/3 hover:border-emerald-500/30'
                      : m.productivityScore > 0 && m.productivityScore < 65
                        ? 'border-red-500/20 bg-red-500/3 hover:border-red-500/30'
                        : 'border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-700'
                }`}
              >
                {/* Main Row */}
                <div className="flex items-center gap-4 px-4 py-3">
                  {/* Avatar + Status */}
                  <div className="relative flex-shrink-0">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${isAI ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#6366f1]/20 text-[#818cf8]'}`}>
                      {isAI ? '🤖' : m.name[0]}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0d0d14] ${activity.dot}`} />
                  </div>

                  {/* Name + Role */}
                  <div className="min-w-0 w-36 flex-shrink-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">{m.name}</p>
                    <p className="text-[10px] text-zinc-500">{ROLE_LABELS[m.role] ?? m.role}</p>
                  </div>

                  {/* Activity status */}
                  <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${activity.bg} ${activity.color}`}>
                    {m.utilizationToday > 0 ? `${m.utilizationToday}% util` : activity.label}
                  </span>

                  {/* Tasks */}
                  <div className="hidden lg:flex items-center gap-4 flex-1 min-w-0">
                    <div className="text-center">
                      <p className="text-sm font-bold text-emerald-400">{m.tasksCompleted}</p>
                      <p className="text-[9px] text-zinc-600">Done</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-[#818cf8]">{m.tasksInProgress}</p>
                      <p className="text-[9px] text-zinc-600">In Progress</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-zinc-400">{m.tasksPending}</p>
                      <p className="text-[9px] text-zinc-600">Pending</p>
                    </div>
                  </div>

                  {/* Score + trend */}
                  <div className="ml-auto flex items-center gap-3 flex-shrink-0">
                    <div className="hidden lg:block w-32">
                      <ScoreBar value={m.productivityScore} alert />
                    </div>
                    {hasTaskData && <TrendIcon trend={m.kpiTrend} />}
                    {hasTaskData && !isAI && (
                      m.bonusEligible ? (
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5 font-semibold">Bonus ✓</span>
                      ) : (
                        <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5 font-semibold">No Bonus</span>
                      )
                    )}
                    <Eye className="h-3.5 w-3.5 text-zinc-600" />
                  </div>
                </div>

                {/* Expanded Detail */}
                {selectedStaff?.userId === m.userId && (
                  <div className="px-4 pb-4 space-y-3 border-t border-zinc-800/40 pt-3">
                    {/* AI Verdict */}
                    <div className="flex items-start gap-2 rounded-lg bg-[#6366f1]/5 border border-[#6366f1]/20 p-3">
                      <Zap className="h-3.5 w-3.5 text-[#818cf8] flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-zinc-300">{m.aiVerdict}</p>
                    </div>

                    {/* Detailed Metrics */}
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                      {[
                        { label: 'QC Pass Rate', value: m.qcPassRate > 0 ? `${m.qcPassRate}%` : '—', good: m.qcPassRate >= 90 || m.qcPassRate === 0 },
                        { label: 'Revision Rate', value: hasTaskData ? `${m.revisionRate}%` : '—', good: m.revisionRate <= 15 },
                        { label: 'Utilization', value: `${m.utilizationToday}%`, good: m.utilizationToday < 90 },
                        { label: 'Est. Load (hrs)', value: m.totalEstimatedHours > 0 ? `${m.totalEstimatedHours}h` : '—', good: m.totalEstimatedHours <= 40 },
                      ].map(({ label, value, good }) => (
                        <div key={label} className="rounded-lg bg-zinc-900/60 border border-zinc-800/40 p-3 text-center">
                          <p className={`text-sm font-bold ${value === '—' ? 'text-zinc-600' : good ? 'text-emerald-400' : 'text-amber-400'}`}>{value}</p>
                          <p className="text-[10px] text-zinc-600 mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* KPI → Salary Signal */}
                    {!isAI && hasTaskData && (
                      <div className={`rounded-lg border p-3 ${
                        m.productivityScore >= 85 ? 'border-emerald-500/30 bg-emerald-500/5' :
                        m.productivityScore >= 65 ? 'border-zinc-700 bg-zinc-800/20' :
                        'border-red-500/30 bg-red-500/5'
                      }`}>
                        <p className="text-xs font-semibold text-zinc-300 mb-1">KPI → Salary Signal</p>
                        <p className={`text-xs ${
                          m.productivityScore >= 85 ? 'text-emerald-400' :
                          m.productivityScore >= 75 ? 'text-zinc-300' :
                          m.productivityScore >= 65 ? 'text-amber-400' :
                          'text-red-400'
                        }`}>
                          {m.productivityScore >= 85
                            ? `Score ${m.productivityScore}/100 — Full bonus + eligible for promotion review`
                            : m.productivityScore >= 75
                              ? `Score ${m.productivityScore}/100 — Full salary, partial bonus (${Math.round((m.productivityScore - 75) * 4)}%)`
                              : m.productivityScore >= 65
                                ? `Score ${m.productivityScore}/100 — Full salary only, no bonus this month`
                                : `Score ${m.productivityScore}/100 — Performance Improvement Plan (PIP) recommended`}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Bottom note */}
      <div className="rounded-xl border border-zinc-800/40 bg-zinc-900/20 p-4">
        <p className="text-xs text-zinc-600">
          <span className="text-zinc-400 font-semibold">How scores are calculated:</span>{' '}
          Productivity Score = 45% QC Pass Rate + 35% Revision Quality + 20% Output Volume.
          Bonus eligibility threshold: 75/100. PIP trigger: below 65/100.
          Staff without deliverable task assignments show N/A scores.
        </p>
      </div>
    </div>
  )
}
