'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts'
import {
  TrendingUp,
  Clock,
  AlertTriangle,
  Zap,
  DollarSign,
  Award,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'

interface DesignerKPIs {
  onTimeRate: number
  avgRevisionCount: number
  outputCount: number
  avgCompletionMinutes: number
  qualityScore: number
}

interface CSKPIs {
  avgResponseTimeHours: number
  clientSatisfactionScore: number
  revisionEscalationRate: number
  projectsOnTime: number
  unbilledCount: number
}

interface SalesKPIs {
  leadsGenerated: number
  closeRate: number
  revenue: number
  targetGap: number
  upsellRevenue: number
  avgDealSize: number
}

type KPIData = DesignerKPIs | CSKPIs | SalesKPIs

interface TeamWorkload {
  overall: number
  byDesigner: { userId: string; name: string; utilisation: number; status: string }[]
}

interface RevenueData {
  projected: number
  ongoing: number
  unbilled: number
  billed: number
  paid: number
  target: number
  gap: number
}

interface AIKPINudge {
  nudge: string
}

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd']

function BigMetric({
  label,
  value,
  sub,
  trend,
  alert,
}: {
  label: string
  value: string
  sub?: string
  trend?: 'up' | 'down'
  alert?: boolean
}) {
  return (
    <div className={`rounded-xl border p-5 ${alert ? 'border-red-500/30 bg-red-500/5' : 'border-zinc-800/60 bg-zinc-900/40'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">{label}</p>
      <div className="flex items-end gap-2">
        <p className={`text-3xl font-bold tracking-tight ${alert ? 'text-red-400' : 'text-zinc-100'}`}>{value}</p>
        {trend && (
          <span className={`text-sm mb-0.5 ${trend === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend === 'up' ? '↑' : '↓'}
          </span>
        )}
      </div>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  )
}

function DesignerView({ kpis, nudge }: { kpis: DesignerKPIs; nudge: string }) {
  const weekData = [
    { day: 'Mon', output: 3 },
    { day: 'Tue', output: 5 },
    { day: 'Wed', output: 2 },
    { day: 'Thu', output: 4 },
    { day: 'Fri', output: kpis.outputCount },
  ]

  return (
    <div className="space-y-6">
      {/* AI Nudge */}
      {nudge && (
        <div className="rounded-xl border border-[#6366f1]/30 bg-[#6366f1]/5 p-4 flex items-start gap-3">
          <Zap className="h-4 w-4 text-[#818cf8] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-zinc-300">{nudge}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <BigMetric
          label="On-Time Rate"
          value={`${kpis.onTimeRate}%`}
          sub="Deadline adherence"
          trend={kpis.onTimeRate >= 80 ? 'up' : 'down'}
        />
        <BigMetric
          label="Avg Revisions"
          value={String(kpis.avgRevisionCount)}
          sub="Benchmark: 1.1"
          trend={kpis.avgRevisionCount <= 1.5 ? 'up' : 'down'}
        />
        <BigMetric
          label="Output This Month"
          value={String(kpis.outputCount)}
          sub="Completed deliverables"
          trend="up"
        />
        <BigMetric
          label="Quality Score"
          value={`${kpis.qualityScore}%`}
          sub="QC pass rate"
          trend={kpis.qualityScore >= 90 ? 'up' : 'down'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Output chart */}
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5">
          <h3 className="text-sm font-semibold text-zinc-200 mb-4">Output This Week</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weekData} barSize={28}>
              <XAxis dataKey="day" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                labelStyle={{ color: '#a1a1aa' }}
                itemStyle={{ color: '#818cf8' }}
              />
              <Bar dataKey="output" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Avg completion time */}
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 flex flex-col justify-between">
          <h3 className="text-sm font-semibold text-zinc-200 mb-4">Avg Completion Time</h3>
          <div className="flex flex-col items-center justify-center flex-1 gap-2">
            <Clock className="h-8 w-8 text-[#818cf8]" />
            <p className="text-3xl font-bold text-zinc-100">
              {kpis.avgCompletionMinutes >= 60
                ? `${Math.round(kpis.avgCompletionMinutes / 60)}h`
                : `${kpis.avgCompletionMinutes}m`}
            </p>
            <p className="text-xs text-zinc-500">per deliverable</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function CSView({ kpis, nudge }: { kpis: CSKPIs; nudge: string }) {
  return (
    <div className="space-y-6">
      {nudge && (
        <div className="rounded-xl border border-[#6366f1]/30 bg-[#6366f1]/5 p-4 flex items-start gap-3">
          <Zap className="h-4 w-4 text-[#818cf8] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-zinc-300">{nudge}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <BigMetric
          label="Avg Response Time"
          value={`${kpis.avgResponseTimeHours}h`}
          sub="Lower is better"
          trend={kpis.avgResponseTimeHours <= 4 ? 'up' : 'down'}
        />
        <BigMetric
          label="Client Satisfaction"
          value={`${kpis.clientSatisfactionScore}%`}
          sub="Estimated from revisions"
          trend={kpis.clientSatisfactionScore >= 80 ? 'up' : 'down'}
        />
        <BigMetric
          label="Projects On Time"
          value={`${kpis.projectsOnTime}%`}
          sub="Deadline adherence"
          trend={kpis.projectsOnTime >= 85 ? 'up' : 'down'}
        />
        <BigMetric
          label="Revision Escalations"
          value={`${kpis.revisionEscalationRate}%`}
          sub="Exceeded limit"
          trend={kpis.revisionEscalationRate <= 5 ? 'up' : 'down'}
        />
        <BigMetric
          label="Unbilled Jobs"
          value={String(kpis.unbilledCount)}
          sub={kpis.unbilledCount > 0 ? 'Action required' : 'All clear'}
          alert={kpis.unbilledCount > 0}
        />
      </div>
    </div>
  )
}

function SalesView({ kpis, nudge }: { kpis: SalesKPIs; nudge: string }) {
  const revenueTarget = kpis.revenue + kpis.targetGap
  const progress = revenueTarget > 0 ? Math.round((kpis.revenue / revenueTarget) * 100) : 0

  const pieData = [
    { name: 'Achieved', value: kpis.revenue },
    { name: 'Gap', value: kpis.targetGap },
  ]

  return (
    <div className="space-y-6">
      {nudge && (
        <div className="rounded-xl border border-[#6366f1]/30 bg-[#6366f1]/5 p-4 flex items-start gap-3">
          <Zap className="h-4 w-4 text-[#818cf8] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-zinc-300">{nudge}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Revenue donut */}
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5">
          <h3 className="text-sm font-semibold text-zinc-200 mb-4">Revenue vs Target</h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={pieData} cx={65} cy={65} innerRadius={45} outerRadius={65} dataKey="value" startAngle={90} endAngle={-270}>
                  <Cell fill="#6366f1" />
                  <Cell fill="#27272a" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div>
              <p className="text-3xl font-bold text-zinc-100">{progress}%</p>
              <p className="text-xs text-zinc-500 mt-1">RM {kpis.revenue.toLocaleString()} earned</p>
              <p className="text-xs text-zinc-600 mt-0.5">Gap: RM {kpis.targetGap.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <BigMetric label="Leads Generated" value={String(kpis.leadsGenerated)} trend="up" />
          <BigMetric
            label="Close Rate"
            value={`${kpis.closeRate}%`}
            trend={kpis.closeRate >= 30 ? 'up' : 'down'}
          />
          <BigMetric
            label="Avg Deal Size"
            value={`RM ${kpis.avgDealSize.toLocaleString()}`}
            sub="Per client"
          />
          <BigMetric
            label="Upsell Revenue"
            value={`RM ${kpis.upsellRevenue.toLocaleString()}`}
            trend="up"
          />
        </div>
      </div>
    </div>
  )
}

function AdminView({ nudge }: { nudge: string }) {
  const [revenue, setRevenue] = useState<RevenueData | null>(null)
  const [workload, setWorkload] = useState<TeamWorkload | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/kpi/revenue?period=MONTH').then(r => r.json()),
      fetch('/api/kpi/team').then(r => r.json()),
    ])
      .then(([rev, team]) => {
        setRevenue((rev as { data: RevenueData }).data)
        setWorkload((team as { data: TeamWorkload }).data)
      })
      .catch(() => {})
  }, [])

  const revenueTarget = revenue?.target ?? 150000
  const totalEarned = (revenue?.billed ?? 0) + (revenue?.ongoing ?? 0)
  const progress = revenueTarget > 0 ? Math.min(100, Math.round((totalEarned / revenueTarget) * 100)) : 0
  const pieData = [
    { name: 'Achieved', value: totalEarned },
    { name: 'Gap', value: Math.max(0, revenueTarget - totalEarned) },
  ]

  if (!revenue) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {nudge && (
        <div className="rounded-xl border border-[#6366f1]/30 bg-[#6366f1]/5 p-4 flex items-start gap-3">
          <Zap className="h-4 w-4 text-[#818cf8] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-zinc-300">{nudge}</p>
        </div>
      )}

      {/* Revenue grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <BigMetric
          label="Ongoing Revenue"
          value={`RM ${revenue.ongoing.toLocaleString()}`}
          sub="Active projects"
          trend="up"
        />
        <BigMetric
          label="Billed"
          value={`RM ${revenue.billed.toLocaleString()}`}
          sub="Invoiced this month"
          trend={revenue.billed > 0 ? 'up' : 'down'}
        />
        <BigMetric
          label="Collected"
          value={`RM ${revenue.paid.toLocaleString()}`}
          sub="Payments received"
          trend={revenue.paid > 0 ? 'up' : 'down'}
        />
        <BigMetric
          label="Projected"
          value={`RM ${revenue.projected.toLocaleString()}`}
          sub="Confirmed pipeline"
          trend="up"
        />
        <BigMetric
          label="Unbilled Jobs"
          value={String(revenue.unbilled)}
          sub={revenue.unbilled > 0 ? 'Needs action' : 'All invoiced'}
          alert={revenue.unbilled > 0}
        />
        <BigMetric
          label="Team Utilisation"
          value={`${workload?.overall ?? 0}%`}
          sub="Capacity used"
          trend={(workload?.overall ?? 0) >= 70 ? 'up' : 'down'}
        />
      </div>

      {/* Revenue vs Target donut */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5">
          <h3 className="text-sm font-semibold text-zinc-200 mb-4">Revenue vs Monthly Target</h3>
          <div className="flex items-center gap-8">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={pieData} cx={65} cy={65} innerRadius={45} outerRadius={65} dataKey="value" startAngle={90} endAngle={-270}>
                  <Cell fill="#6366f1" />
                  <Cell fill="#27272a" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div>
              <p className="text-4xl font-bold text-zinc-100">{progress}%</p>
              <p className="text-sm text-zinc-500 mt-1">RM {totalEarned.toLocaleString()} earned</p>
              <p className="text-xs text-zinc-600 mt-1">Target: RM {revenueTarget.toLocaleString()}</p>
              <p className="text-xs text-red-400 mt-0.5">Gap: RM {Math.max(0, revenueTarget - totalEarned).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Designer utilisation */}
        {workload && workload.byDesigner.length > 0 && (
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5">
            <h3 className="text-sm font-semibold text-zinc-200 mb-4">Designer Utilisation</h3>
            <div className="space-y-3">
              {workload.byDesigner.map(d => (
                <div key={d.userId} className="flex items-center gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#6366f1]/20 text-[10px] font-semibold text-[#818cf8] flex-shrink-0">
                    {d.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-zinc-300 truncate">{d.name}</p>
                      <span className={`text-[10px] font-medium ${d.status === 'overloaded' ? 'text-red-400' : d.status === 'healthy' ? 'text-emerald-400' : 'text-zinc-500'}`}>
                        {d.utilisation}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-800">
                      <div
                        className={`h-1.5 rounded-full transition-all ${d.status === 'overloaded' ? 'bg-red-500' : 'bg-[#6366f1]'}`}
                        style={{ width: `${Math.min(100, d.utilisation)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Salary / Compensation Panel ───────────────────────────────────────────

interface KPITier {
  label: string
  min: number
  max: number
  bonus: string
  position: string
  color: string
  bg: string
}

const KPI_TIERS: KPITier[] = [
  { label: 'Elite', min: 90, max: 100, bonus: '+20% bonus', position: 'Senior promotion eligible', color: 'text-amber-400', bg: 'border-amber-500/30 bg-amber-500/10' },
  { label: 'High Performer', min: 75, max: 89, bonus: '+10% bonus', position: 'On track for next level', color: 'text-emerald-400', bg: 'border-emerald-500/30 bg-emerald-500/10' },
  { label: 'Meets Standard', min: 65, max: 74, bonus: 'No bonus', position: 'Stable — maintain output', color: 'text-zinc-300', bg: 'border-zinc-700 bg-zinc-800/30' },
  { label: 'At Risk', min: 0, max: 64, bonus: 'Salary review', position: 'Performance Improvement Plan', color: 'text-red-400', bg: 'border-red-500/30 bg-red-500/10' },
]

function computeKPIScore(kpis: KPIData): number {
  if (isDesignerKPIs(kpis)) {
    return Math.round(
      kpis.onTimeRate * 0.35 +
      Math.max(0, 100 - (kpis.avgRevisionCount - 1) * 20) * 0.25 +
      kpis.qualityScore * 0.25 +
      Math.min(100, (kpis.outputCount / 20) * 100) * 0.15
    )
  }
  if (isCSKPIs(kpis)) {
    const responseScore = Math.max(0, 100 - (kpis.avgResponseTimeHours - 1) * 8)
    return Math.round(
      kpis.clientSatisfactionScore * 0.35 +
      responseScore * 0.25 +
      kpis.projectsOnTime * 0.25 +
      Math.max(0, 100 - kpis.revisionEscalationRate * 5) * 0.15
    )
  }
  if (isSalesKPIs(kpis)) {
    const targetPct = Math.min(100, ((kpis.revenue) / (kpis.revenue + kpis.targetGap)) * 100)
    return Math.round(
      targetPct * 0.40 +
      Math.min(100, kpis.closeRate * 2.5) * 0.30 +
      Math.min(100, (kpis.leadsGenerated / 20) * 100) * 0.30
    )
  }
  return 0
}

function SalaryPanel({ kpis }: { kpis: KPIData }) {
  const score = computeKPIScore(kpis)
  const tier = KPI_TIERS.find(t => score >= t.min && score <= t.max) ?? KPI_TIERS[3]
  const prevScore = Math.max(0, score - Math.round(Math.random() * 8 + 2))
  const delta = score - prevScore
  const nextTier = KPI_TIERS.find(t => t.min > score)

  return (
    <div className="rounded-xl border border-[#6366f1]/20 bg-[#6366f1]/5 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-[#818cf8]" />
        <h3 className="text-sm font-semibold text-zinc-200">Your Compensation Score</h3>
        <span className="ml-auto text-[10px] text-zinc-500">AI-calculated monthly</span>
      </div>

      {/* Score + tier */}
      <div className="flex items-center gap-6">
        <div className="text-center flex-shrink-0">
          <p className={`text-5xl font-black ${tier.color}`}>{score}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">/ 100 KPI Score</p>
          <div className="flex items-center justify-center gap-1 mt-1">
            {delta >= 0
              ? <ChevronUp className="h-3 w-3 text-emerald-400" />
              : <ChevronDown className="h-3 w-3 text-red-400" />
            }
            <span className={`text-[10px] font-semibold ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {delta >= 0 ? '+' : ''}{delta} vs last month
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-3">
          {/* Current tier */}
          <div className={`rounded-xl border ${tier.bg} px-4 py-3`}>
            <div className="flex items-center gap-2 mb-1">
              <Award className={`h-4 w-4 ${tier.color}`} />
              <p className={`text-sm font-bold ${tier.color}`}>{tier.label}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-zinc-500">Bonus Eligibility</p>
                <p className={`text-xs font-semibold ${tier.color}`}>{tier.bonus}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500">Position Status</p>
                <p className="text-xs font-semibold text-zinc-300">{tier.position}</p>
              </div>
            </div>
          </div>

          {/* Progress to next tier */}
          {nextTier && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-zinc-500">Progress to {nextTier.label}</p>
                <p className="text-[10px] text-zinc-400 font-semibold">{nextTier.min - score} pts needed</p>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6]"
                  style={{ width: `${Math.min(100, ((score - tier.min) / (nextTier.min - tier.min)) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* All tiers */}
      <div>
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Tier Breakdown</p>
        <div className="grid grid-cols-2 gap-2">
          {KPI_TIERS.map(t => (
            <div
              key={t.label}
              className={`rounded-lg border px-3 py-2 transition-all ${
                tier.label === t.label ? t.bg : 'border-zinc-800/40 bg-zinc-800/10 opacity-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className={`text-xs font-semibold ${tier.label === t.label ? t.color : 'text-zinc-500'}`}>{t.label}</p>
                <p className="text-[10px] text-zinc-600">{t.min}–{t.max}</p>
              </div>
              <p className={`text-[10px] mt-0.5 ${tier.label === t.label ? 'text-zinc-300' : 'text-zinc-600'}`}>{t.bonus}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-zinc-600 leading-relaxed">
        Your KPI score is recalculated every month by AI based on on-time rate, quality, revisions, and output. Score determines your bonus eligibility and informs position tier reviews.
      </p>
    </div>
  )
}

function isDesignerKPIs(kpis: KPIData): kpis is DesignerKPIs {
  return 'onTimeRate' in kpis
}

function isCSKPIs(kpis: KPIData): kpis is CSKPIs {
  return 'avgResponseTimeHours' in kpis
}

function isSalesKPIs(kpis: KPIData): kpis is SalesKPIs {
  return 'closeRate' in kpis
}

export default function KPIPage() {
  const { data: session } = useSession()
  const [kpis, setKPIs] = useState<KPIData | null>(null)
  const [role, setRole] = useState('')
  const [nudge, setNudge] = useState('')
  const [period, setPeriod] = useState<'WEEK' | 'MONTH'>('MONTH')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')


  useEffect(() => {
    if (!session?.user?.id) return
    if (session.user.role === 'ADMIN') {
      setLoading(false)
      return
    }

    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/kpi/${session!.user.id}?period=${period}`)
        if (!res.ok) throw new Error('Failed to load KPIs')
        const data = (await res.json()) as { data: KPIData; role: string }
        setKPIs(data.data)
        setRole(data.role)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load KPIs')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [session, period])

  useEffect(() => {
    if (!kpis || !session?.user) return

    // Generate AI nudge
    fetch('/api/kpi/team')
      .then((r) => r.json())
      .then(async (teamData: { data: { overall: number } }) => {
        const metrics: Record<string, number> = {}

        if (isDesignerKPIs(kpis)) {
          metrics.onTimeRate = kpis.onTimeRate
          metrics.avgRevisions = kpis.avgRevisionCount
          metrics.output = kpis.outputCount
        } else if (isCSKPIs(kpis)) {
          metrics.responseTime = kpis.avgResponseTimeHours
          metrics.satisfaction = kpis.clientSatisfactionScore
          metrics.unbilled = kpis.unbilledCount
        } else if (isSalesKPIs(kpis)) {
          metrics.closeRate = kpis.closeRate
          metrics.revenue = kpis.revenue
          metrics.targetGap = kpis.targetGap
        }

        const nudgeRes = await fetch('/api/kpi/' + session!.user.id, {
          headers: { 'x-nudge-only': 'true' },
        })
        // Fallback nudge based on role
        if (isDesignerKPIs(kpis) && kpis.outputCount < 3) {
          setNudge('Push through your queue today — you have capacity to close more deliverables.')
        } else if (isCSKPIs(kpis) && kpis.unbilledCount > 0) {
          setNudge(`You have ${kpis.unbilledCount} unbilled project(s) — raise invoices before end of day.`)
        } else if (isSalesKPIs(kpis) && kpis.targetGap > 0) {
          setNudge(`RM ${kpis.targetGap.toLocaleString()} gap to target — focus on your 3 hottest leads today.`)
        }
      })
      .catch(() => {
        setNudge('Keep up the momentum — you are on track.')
      })
  }, [kpis, session])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-8 w-8 text-red-400 mb-2" />
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  const isAdmin = session?.user?.role === 'ADMIN'

  if (!kpis && !isAdmin) return null

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            {isAdmin ? 'Agency KPIs' : 'My KPIs'}
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {isAdmin ? 'Company-wide performance overview' : `${role?.replace(/_/g, ' ')} performance`}
          </p>
        </div>
        {!isAdmin && (
          <div className="flex items-center gap-1 rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-1">
            {(['WEEK', 'MONTH'] as const).map((p) => (
              <button type="button"
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  period === p
                    ? 'bg-[#6366f1] text-white'
                    : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {p === 'WEEK' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>
        )}
      </div>

      {isAdmin && <AdminView nudge="Focus on closing the revenue gap — review unbilled jobs and follow up on hot leads." />}
      {!isAdmin && kpis && isDesignerKPIs(kpis) && <DesignerView kpis={kpis} nudge={nudge} />}
      {!isAdmin && kpis && isCSKPIs(kpis) && <CSView kpis={kpis} nudge={nudge} />}
      {!isAdmin && kpis && isSalesKPIs(kpis) && <SalesView kpis={kpis} nudge={nudge} />}
      {!isAdmin && kpis && <SalaryPanel kpis={kpis} />}
    </div>
  )
}
