'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'
import {
  TrendingUp,
  AlertTriangle,
  Briefcase,
  Users,
  DollarSign,
  ArrowUp,
  Crown,
  Zap,
  Calendar,
  Shield,
  ChevronDown,
  ChevronUp,
  Target,
} from 'lucide-react'

interface RevenueOverview {
  projected: number
  ongoing: number
  unbilled: number
  billed: number
  paid: number
  target: number
  gap: number
}

interface DesignerUtilisation {
  userId: string
  name: string
  utilisation: number
  status: 'healthy' | 'warning' | 'critical'
}

interface SeasonalAlert {
  event: string
  daysAway: number
  expectedDemandMultiplier: number
  recommendation: string
}

interface ChurnClient {
  id: string
  companyName: string
  risk: 'HIGH' | 'MEDIUM' | 'LOW'
}

interface TopClient {
  id: string
  companyName: string
  tier: string
  ltv: number
}

interface Target {
  id: string
  metric: string
  targetValue: number
  currentValue: number
  period: string
}

const TIER_COLORS: Record<string, string> = {
  PLATINUM: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  GOLD: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  SILVER: 'text-zinc-300 bg-zinc-500/10 border-zinc-500/20',
  BRONZE: 'text-orange-300 bg-orange-500/10 border-orange-500/20',
}

function RevenueCard({
  label,
  value,
  alert,
  accent,
}: {
  label: string
  value: number
  alert?: boolean
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        alert
          ? 'border-red-500/30 bg-red-500/5'
          : accent
          ? 'border-[#6366f1]/30 bg-[#6366f1]/5'
          : 'border-zinc-800/60 bg-zinc-900/40'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">{label}</p>
      <p
        className={`text-xl font-bold tabular-nums ${
          alert ? 'text-red-400' : accent ? 'text-[#818cf8]' : 'text-zinc-100'
        }`}
      >
        RM {value.toLocaleString()}
      </p>
    </div>
  )
}

function UtilBar({
  name,
  utilisation,
  status,
}: {
  name: string
  utilisation: number
  status: 'healthy' | 'warning' | 'critical'
}) {
  const color =
    status === 'critical' ? 'bg-red-500' : status === 'warning' ? 'bg-amber-400' : 'bg-[#6366f1]'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-400 truncate max-w-[120px]">{name}</span>
        <span className={`font-semibold ${status === 'critical' ? 'text-red-400' : status === 'warning' ? 'text-amber-400' : 'text-zinc-300'}`}>
          {utilisation}%
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(100, utilisation)}%` }}
        />
      </div>
    </div>
  )
}

export default function CommandPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const [revenue, setRevenue] = useState<RevenueOverview | null>(null)
  const [utilisation, setUtilisation] = useState<DesignerUtilisation[]>([])
  const [overallUtil, setOverallUtil] = useState(0)
  const [seasonal, setSeasonal] = useState<SeasonalAlert[]>([])
  const [churnClients, setChurnClients] = useState<ChurnClient[]>([])
  const [topClients, setTopClients] = useState<TopClient[]>([])
  const [targets, setTargets] = useState<Target[]>([])
  const [weeklyBrief, setWeeklyBrief] = useState('')
  const [briefExpanded, setBriefExpanded] = useState(false)
  const [loadingBrief, setLoadingBrief] = useState(false)
  const [loading, setLoading] = useState(true)

  // Monthly revenue trend data (static for now — real data from API in production)
  const revenueTrend = [
    { month: 'Jan', revenue: 42000, target: 50000 },
    { month: 'Feb', revenue: 38000, target: 50000 },
    { month: 'Mar', revenue: 55000, target: 50000 },
    { month: 'Apr', revenue: 61000, target: 60000 },
    { month: 'May', revenue: 47000, target: 60000 },
    { month: 'Jun', revenue: revenue?.paid ?? 0, target: revenue?.target ?? 60000 },
  ]

  useEffect(() => {
    if (session?.user?.role && session.user.role !== 'ADMIN') {
      router.replace('/')
    }
  }, [session, router])

  useEffect(() => {
    async function load() {
      try {
        // Fire all three KPI requests in parallel — the previous code awaited
        // /api/targets sequentially after the Promise.all, adding a full
        // round-trip to the dashboard's time-to-content.
        const [revenueRes, teamRes, targetsRes] = await Promise.all([
          fetch('/api/kpi/revenue?period=MONTH'),
          fetch('/api/kpi/team'),
          fetch('/api/targets'),
        ])

        if (revenueRes.ok) {
          const data = (await revenueRes.json()) as { data: RevenueOverview }
          setRevenue(data.data)
        }

        if (teamRes.ok) {
          const data = (await teamRes.json()) as {
            data: { overall: number; byDesigner: DesignerUtilisation[] }
          }
          setOverallUtil(data.data.overall)
          setUtilisation(data.data.byDesigner)
        }

        if (targetsRes.ok) {
          const data = (await targetsRes.json()) as { data: Target[] }
          setTargets(data.data)
        }

        // Load seasonal forecasts from KPI service
        // (embedded in client for now)
        setSeasonal([
          { event: 'Hari Raya Aidiladha', daysAway: 45, expectedDemandMultiplier: 2.0, recommendation: 'Prepare team roster — 2x demand expected' },
          { event: 'Malaysia Day', daysAway: 55, expectedDemandMultiplier: 2.0, recommendation: 'Monitor capacity — demand spike in 55 days' },
        ])
      } catch (error) {
        console.error('Command centre load error:', error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function loadWeeklyBrief() {
    if (weeklyBrief) {
      setBriefExpanded((v) => !v)
      return
    }
    setLoadingBrief(true)
    try {
      const res = await fetch('/api/ai/weekly-brief')
      if (res.ok) {
        const data = (await res.json()) as { data: { brief: string } }
        setWeeklyBrief(data.data.brief)
        setBriefExpanded(true)
      }
    } catch (error) {
      console.error('Weekly brief error:', error)
    } finally {
      setLoadingBrief(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  const revenueProgress = revenue?.target
    ? Math.min(100, Math.round((revenue.paid / revenue.target) * 100))
    : 0

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Command Centre</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'},{' '}
          {session?.user?.name?.split(' ')[0]}.
        </p>
      </div>

      {/* Row 1 — Revenue Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <RevenueCard label="Projected" value={revenue?.projected ?? 0} accent />
        <RevenueCard label="Ongoing" value={revenue?.ongoing ?? 0} />
        <RevenueCard label="Unbilled" value={revenue?.unbilled ?? 0} alert={(revenue?.unbilled ?? 0) > 0} />
        <RevenueCard label="Billed" value={revenue?.billed ?? 0} />
        <RevenueCard label="Collected" value={revenue?.paid ?? 0} />
      </div>

      {/* Revenue progress bar */}
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[#818cf8]" />
            <span className="text-sm font-semibold text-zinc-200">Monthly Target</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-zinc-100">
              RM {(revenue?.paid ?? 0).toLocaleString()} / RM {(revenue?.target ?? 0).toLocaleString()}
            </span>
            <span className="text-xs text-emerald-400 flex items-center gap-0.5">
              <ArrowUp className="h-3 w-3" /> {revenueProgress}%
            </span>
          </div>
        </div>
        <div className="h-2.5 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] transition-all duration-700"
            style={{ width: `${revenueProgress}%` }}
          />
        </div>
        {(revenue?.gap ?? 0) > 0 && (
          <p className="text-xs text-zinc-500 mt-1.5">Gap: RM {(revenue?.gap ?? 0).toLocaleString()} remaining</p>
        )}
      </div>

      {/* Row 2 — Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Revenue trend chart */}
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5">
          <h2 className="text-sm font-semibold text-zinc-200 mb-4">Monthly Revenue vs Target</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={revenueTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="month" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: '#71717a', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `RM ${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                labelStyle={{ color: '#a1a1aa' }}
                formatter={(value) => [`RM ${Number(value).toLocaleString()}`, '']}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#71717a' }} />
              <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 3 }} name="Revenue" />
              <Line type="monotone" dataKey="target" stroke="#3f3f46" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Target" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Team utilisation */}
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-200">Team Utilisation</h2>
            <span className={`text-sm font-bold ${overallUtil >= 90 ? 'text-red-400' : overallUtil >= 70 ? 'text-amber-400' : 'text-[#818cf8]'}`}>
              {overallUtil}% avg
            </span>
          </div>
          {utilisation.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-6 w-6 text-zinc-700 mb-2" />
              <p className="text-xs text-zinc-600">No workload data for today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {utilisation.slice(0, 8).map((d) => (
                <UtilBar key={d.userId} name={d.name} utilisation={d.utilisation} status={d.status} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 3 — Intelligence */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* AI Weekly Brief */}
        <div className="lg:col-span-2 rounded-xl border border-[#6366f1]/20 bg-[#6366f1]/5 p-5">
          <button type="button"
            onClick={loadWeeklyBrief}
            className="cursor-pointer w-full flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#818cf8]" />
              <h2 className="text-sm font-semibold text-zinc-200">AI Weekly Strategy Brief</h2>
            </div>
            <div className="flex items-center gap-2 text-zinc-500 group-hover:text-zinc-300 transition-colors">
              <span className="text-xs">
                {loadingBrief ? 'Generating...' : weeklyBrief ? (briefExpanded ? 'Collapse' : 'Expand') : 'Generate'}
              </span>
              {briefExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </div>
          </button>
          {briefExpanded && weeklyBrief && (
            <div className="mt-4 prose prose-sm prose-invert max-w-none">
              <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {weeklyBrief}
              </div>
            </div>
          )}
        </div>

        {/* Seasonal Forecast */}
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-zinc-200">Seasonal Forecast</h2>
          </div>
          {seasonal.length === 0 ? (
            <p className="text-xs text-zinc-600 text-center py-4">No events in next 60 days</p>
          ) : (
            <div className="space-y-3">
              {seasonal.map((event, i) => (
                <div key={i} className="rounded-lg border border-amber-500/15 bg-amber-500/5 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-amber-300">{event.event}</p>
                    <span className="text-[10px] text-amber-400/70">{event.daysAway}d away</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">{event.recommendation}</p>
                  <div className="mt-1.5 flex items-center gap-1">
                    <div className="h-1 flex-1 rounded-full bg-zinc-700">
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{ width: `${Math.min(100, event.expectedDemandMultiplier * 25)}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-amber-400">{event.expectedDemandMultiplier}x</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 4 — Targets + Top Clients */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Target Setting */}
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[#818cf8]" />
              <h2 className="text-sm font-semibold text-zinc-200">Monthly Targets</h2>
            </div>
          </div>
          {targets.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs text-zinc-600">No targets set. Set them in the Packages section.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {targets.slice(0, 5).map((t) => {
                const pct = t.targetValue > 0 ? Math.min(100, Math.round((t.currentValue / t.targetValue) * 100)) : 0
                return (
                  <div key={t.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400 capitalize">{t.metric}</span>
                      <span className="text-zinc-300">{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-[#6366f1]'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top Clients by LTV */}
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Crown className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-zinc-200">Top Clients by LTV</h2>
          </div>
          {topClients.length === 0 ? (
            <div className="text-center py-6">
              <Shield className="mx-auto h-6 w-6 text-zinc-700 mb-2" />
              <p className="text-xs text-zinc-600">LTV data will appear here once clients are set up</p>
            </div>
          ) : (
            <div className="space-y-2">
              {topClients.map((client, i) => (
                <div key={client.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-zinc-600 w-4">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-200">{client.companyName}</p>
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${TIER_COLORS[client.tier] ?? 'text-zinc-400 bg-zinc-800 border-zinc-700'}`}>
                    {client.tier}
                  </span>
                  <span className="text-sm font-semibold text-zinc-300 tabular-nums">
                    RM {client.ltv.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Unbilled Alert */}
      {(revenue?.unbilled ?? 0) > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-300">Unbilled Revenue Alert</p>
            <p className="text-xs text-red-400/70 mt-0.5">
              RM {(revenue?.unbilled ?? 0).toLocaleString()} in completed projects awaiting invoice. Action required in CS.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
