'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Users, Search, Plus, TrendingUp, AlertTriangle, ChevronRight,
  X, Heart, Sparkles, RefreshCw, CheckCircle2, MessageSquare,
  LayoutGrid, List,
} from 'lucide-react'
import { ClientTier, TierBadge } from '@/components/ui/TierBadge'

type LeadStatus = 'NEW' | 'QUALIFIED' | 'PROPOSAL_SENT' | 'NEGOTIATING' | 'WON' | 'LOST' | 'NURTURE'
type PageView = 'list' | 'bento' | 'health'

interface ClientRow {
  id: string
  companyName: string
  contactPerson: string
  email: string
  tier: ClientTier
  ltv: number
  assignedCSId: string | null
  assignedSalesId: string | null
  createdAt: string
  _count?: { projects: number }
}

interface PipelineSummary {
  NEW: number
  QUALIFIED: number
  PROPOSAL_SENT: number
  NEGOTIATING: number
  WON: number
  LOST: number
  NURTURE: number
}

interface SatisfactionResult {
  score: number
  status: 'HAPPY' | 'NEUTRAL' | 'AT_RISK' | 'CRITICAL'
  signals: string[]
  recommendedAction: string
  urgency: string
  retentionRisk: number
}

interface ClientHealth {
  satisfaction: SatisfactionResult | null
  analysing: boolean
}

const HEALTH_CONFIG = {
  HAPPY:    { label: 'Happy',    color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', icon: CheckCircle2 },
  NEUTRAL:  { label: 'Neutral',  color: 'text-zinc-400',    bg: 'bg-zinc-800/40 border-zinc-700',          icon: CheckCircle2 },
  AT_RISK:  { label: 'At Risk',  color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30',     icon: AlertTriangle },
  CRITICAL: { label: 'Critical', color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30',         icon: AlertTriangle },
}

function PipelineStageChip({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-zinc-800/40 px-3 py-1.5">
      <span className={`text-xs font-semibold ${color}`}>{count}</span>
      <span className="text-[10px] text-zinc-500">{label}</span>
    </div>
  )
}

function HealthBadge({ health }: { health: ClientHealth }) {
  if (!health.satisfaction) return null
  const cfg = HEALTH_CONFIG[health.satisfaction.status]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cfg.color} ${cfg.bg}`}>
      <Icon className="h-2.5 w-2.5" />
      {cfg.label} · {health.satisfaction.score}/10
    </span>
  )
}

export default function CRMPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const [clients, setClients] = useState<ClientRow[]>([])
  const [pipeline, setPipeline] = useState<PipelineSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<ClientTier | 'ALL'>('ALL')
  const [showAddClient, setShowAddClient] = useState(false)
  const [view, setView] = useState<PageView>('list')
  const [newClient, setNewClient] = useState({ name: '', company: '', email: '', phone: '', tier: 'BRONZE' })
  const [addingClient, setAddingClient] = useState(false)
  const [addClientError, setAddClientError] = useState('')

  // Client Health state — keyed by clientId
  const [healthMap, setHealthMap] = useState<Record<string, ClientHealth>>({})
  const [analysingAll, setAnalysingAll] = useState(false)

  const allowedRoles = ['ADMIN', 'SALES', 'CLIENT_SERVICING']

  useEffect(() => {
    if (session?.user?.role && !allowedRoles.includes(session.user.role)) {
      router.replace('/')
    }
  }, [session, router])

  async function loadClients() {
    const res = await fetch('/api/crm/clients')
    if (res.ok) {
      const data = (await res.json()) as { data: ClientRow[] }
      setClients(data.data ?? [])
    }
  }

  async function loadPipeline() {
    const res = await fetch('/api/crm/pipeline')
    if (res.ok) {
      const pipelineData = (await res.json()) as { data: Record<LeadStatus, unknown[]> }
      const counts = Object.entries(pipelineData.data).reduce(
        (acc, [key, val]) => ({ ...acc, [key]: (val as unknown[]).length }),
        {} as PipelineSummary
      )
      setPipeline(counts)
    }
  }

  useEffect(() => {
    Promise.all([loadClients(), loadPipeline()])
      .catch(() => {})
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleAddClient(e: React.FormEvent) {
    e.preventDefault()
    setAddingClient(true)
    setAddClientError('')
    try {
      const res = await fetch('/api/crm/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactPerson: newClient.name,
          companyName:   newClient.company,
          email:         newClient.email,
          ...(newClient.phone ? { phone: newClient.phone } : {}),
          tier:          newClient.tier,
        }),
      })
      const data = (await res.json()) as { data?: ClientRow; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to add client')
      setClients(prev => [data.data!, ...prev])
      setShowAddClient(false)
      setNewClient({ name: '', company: '', email: '', phone: '', tier: 'BRONZE' })
      await fetch('/api/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactPerson: newClient.name,
          companyName:   newClient.company,
          email:         newClient.email,
          status:        'NEW',
        }),
      })
      await loadPipeline()
    } catch (err) {
      setAddClientError(err instanceof Error ? err.message : 'Failed to add client')
    } finally {
      setAddingClient(false)
    }
  }

  // ─── Health Analysis ───────────────────────────────────────────────────────

  async function analyseClient(client: ClientRow) {
    setHealthMap(prev => ({
      ...prev,
      [client.id]: { satisfaction: prev[client.id]?.satisfaction ?? null, analysing: true },
    }))
    try {
      const res = await fetch('/api/ai/cs-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ANALYSE_SATISFACTION',
          clientId: client.id,
          clientName: client.companyName,
          recentMessages: [],
          revisionCount: 2,
          projectDaysOverdue: 0,
          lastContactDays: 5,
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as { data: SatisfactionResult }
        setHealthMap(prev => ({ ...prev, [client.id]: { satisfaction: data.data, analysing: false } }))
      } else {
        setHealthMap(prev => ({ ...prev, [client.id]: { ...prev[client.id], analysing: false } }))
      }
    } catch {
      setHealthMap(prev => ({ ...prev, [client.id]: { ...prev[client.id], analysing: false } }))
    }
  }

  async function analyseAll() {
    setAnalysingAll(true)
    for (const client of clients) {
      if (!healthMap[client.id]?.satisfaction) {
        await analyseClient(client)
        await new Promise(r => setTimeout(r, 600))
      }
    }
    setAnalysingAll(false)
  }

  const analysedCount = Object.values(healthMap).filter(h => h.satisfaction !== null).length
  const atRiskCount = Object.values(healthMap).filter(
    h => h.satisfaction?.status === 'AT_RISK' || h.satisfaction?.status === 'CRITICAL'
  ).length
  const happyCount = Object.values(healthMap).filter(h => h.satisfaction?.status === 'HAPPY').length

  const filteredClients = clients.filter(c => {
    const matchesSearch =
      !search ||
      c.companyName.toLowerCase().includes(search.toLowerCase()) ||
      c.contactPerson.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
    const matchesTier = tierFilter === 'ALL' || c.tier === tierFilter
    return matchesSearch && matchesTier
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">CRM &amp; Client Health</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{clients.length} clients</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-800/60 p-0.5">
            {([
              { v: 'list',   Icon: List,        title: 'List view' },
              { v: 'bento',  Icon: LayoutGrid,  title: 'Card view' },
              { v: 'health', Icon: Heart,        title: 'Health monitor' },
            ] as { v: PageView; Icon: React.ElementType; title: string }[]).map(({ v, Icon, title }) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                title={title}
                className={`rounded-md p-1.5 transition-colors ${view === v ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>

          {view === 'health' && (
            <button
              type="button"
              onClick={() => void analyseAll()}
              disabled={analysingAll || (analysedCount === clients.length && clients.length > 0)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-60"
            >
              {analysingAll ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {analysingAll ? 'Analysing…' : analysedCount === clients.length && clients.length > 0 ? 'All Analysed ✓' : 'Analyse All'}
            </button>
          )}

          <button
            type="button"
            onClick={() => { setShowAddClient(true); setAddClientError('') }}
            className="flex items-center gap-2 rounded-lg bg-[#6366f1] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#5558e3] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Client
          </button>
        </div>
      </div>

      {/* Add Client Modal */}
      {showAddClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-[#0d0d14] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">Add New Client</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Client will also appear in the lead pipeline for tracking.</p>
              </div>
              <button type="button" onClick={() => setShowAddClient(false)} className="text-zinc-500 hover:text-zinc-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddClient} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Contact Name *</label>
                <input required value={newClient.name} onChange={e => setNewClient(p => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-[#6366f1] focus:outline-none"
                  placeholder="Ahmad Razif" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Company Name *</label>
                <input required value={newClient.company} onChange={e => setNewClient(p => ({ ...p, company: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-[#6366f1] focus:outline-none"
                  placeholder="Sunway Property Sdn Bhd" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email *</label>
                <input required type="email" value={newClient.email} onChange={e => setNewClient(p => ({ ...p, email: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-[#6366f1] focus:outline-none"
                  placeholder="ahmad@sunway.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Phone</label>
                <input value={newClient.phone} onChange={e => setNewClient(p => ({ ...p, phone: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-[#6366f1] focus:outline-none"
                  placeholder="+60 12-345 6789" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Client Tier</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['BRONZE','SILVER','GOLD','PLATINUM'] as const).map(t => (
                    <button key={t} type="button"
                      onClick={() => setNewClient(p => ({ ...p, tier: t }))}
                      className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                        newClient.tier === t
                          ? t === 'PLATINUM' ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300'
                          : t === 'GOLD'     ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
                          : t === 'SILVER'   ? 'border-zinc-400/60 bg-zinc-400/10 text-zinc-200'
                          :                    'border-orange-500/60 bg-orange-500/10 text-orange-300'
                          : 'border-zinc-700 bg-zinc-800/40 text-zinc-500 hover:border-zinc-600'
                      }`}>
                      {t[0] + t.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
              {addClientError && <p className="text-xs text-red-400">{addClientError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowAddClient(false)}
                  className="flex-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={addingClient}
                  className="cursor-pointer flex-1 rounded-lg bg-[#6366f1] px-3 py-2 text-sm font-medium text-white hover:bg-[#5558e3] disabled:opacity-50 transition-colors">
                  {addingClient ? 'Saving…' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pipeline Summary */}
      {pipeline && (
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-[#818cf8]" />
            <h2 className="text-sm font-semibold text-zinc-200">Lead Pipeline</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <PipelineStageChip label="New"         count={pipeline.NEW ?? 0}           color="text-zinc-300" />
            <PipelineStageChip label="Qualified"   count={pipeline.QUALIFIED ?? 0}     color="text-blue-300" />
            <PipelineStageChip label="Proposal"    count={pipeline.PROPOSAL_SENT ?? 0} color="text-purple-300" />
            <PipelineStageChip label="Negotiating" count={pipeline.NEGOTIATING ?? 0}   color="text-amber-300" />
            <PipelineStageChip label="Won"         count={pipeline.WON ?? 0}           color="text-emerald-300" />
            <PipelineStageChip label="Lost"        count={pipeline.LOST ?? 0}          color="text-red-300" />
            <PipelineStageChip label="Nurture"     count={pipeline.NURTURE ?? 0}       color="text-zinc-500" />
          </div>
        </div>
      )}

      {/* Search + Tier filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search clients…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 py-2 pl-9 pr-4 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-[#6366f1]/50 focus:ring-1 focus:ring-[#6366f1]/20"
          />
        </div>
        <select
          value={tierFilter}
          onChange={e => setTierFilter(e.target.value as ClientTier | 'ALL')}
          className="rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-[#6366f1]/50"
        >
          <option value="ALL">All Tiers</option>
          <option value="PLATINUM">Platinum</option>
          <option value="GOLD">Gold</option>
          <option value="SILVER">Silver</option>
          <option value="BRONZE">Bronze</option>
        </select>
      </div>

      {/* Empty state */}
      {filteredClients.length === 0 && (
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 text-center py-12">
          <Users className="mx-auto h-8 w-8 text-zinc-700 mb-2" />
          <p className="text-sm text-zinc-500 font-medium">
            {search || tierFilter !== 'ALL' ? 'No clients match your filters' : 'No clients yet'}
          </p>
          {!search && tierFilter === 'ALL' && (
            <p className="text-xs text-zinc-600 mt-1">
              Click{' '}
              <button type="button" onClick={() => setShowAddClient(true)} className="text-indigo-400 hover:underline">
                + Add Client
              </button>{' '}
              to get started.
            </p>
          )}
        </div>
      )}

      {/* ── Health Monitor view ────────────────────────────────────────────── */}
      {filteredClients.length > 0 && view === 'health' && (
        <>
          {analysedCount > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-center">
                <p className="text-2xl font-bold text-zinc-100">{analysedCount}</p>
                <p className="text-xs text-zinc-500">Clients Analysed</p>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
                <p className="text-2xl font-bold text-amber-400">{atRiskCount}</p>
                <p className="text-xs text-zinc-500">At Risk / Critical</p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                <p className="text-2xl font-bold text-emerald-400">{happyCount}</p>
                <p className="text-xs text-zinc-500">Happy Clients</p>
              </div>
            </div>
          )}
          <div className="space-y-3">
            {filteredClients.map(client => {
              const health = healthMap[client.id]
              const cfg = health?.satisfaction ? HEALTH_CONFIG[health.satisfaction.status] : null
              const StatusIcon = cfg?.icon ?? CheckCircle2
              return (
                <div
                  key={client.id}
                  className={`rounded-xl border p-4 ${cfg ? cfg.bg : 'border-zinc-800/60 bg-zinc-900/40'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-zinc-800/60 text-sm font-semibold text-zinc-300">
                        {client.companyName[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-zinc-200">{client.companyName}</p>
                          <TierBadge tier={client.tier} />
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {client.contactPerson} · RM {client.ltv.toLocaleString()} LTV · {client._count?.projects ?? 0} projects
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {health?.satisfaction ? (
                        <div className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <StatusIcon className={`h-3.5 w-3.5 ${cfg?.color}`} />
                            <span className={`text-xs font-semibold ${cfg?.color}`}>{cfg?.label}</span>
                          </div>
                          <p className="text-xs font-bold text-zinc-200">{health.satisfaction.score}/10</p>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void analyseClient(client)}
                          disabled={health?.analysing}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-60"
                        >
                          {health?.analysing
                            ? <RefreshCw className="h-3 w-3 animate-spin" />
                            : <Heart className="h-3 w-3" />}
                          {health?.analysing ? 'Analysing…' : 'Analyse'}
                        </button>
                      )}
                      <Link href={`/crm/${client.id}`} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                  {health?.satisfaction && (
                    <div className="mt-3 space-y-2 pt-3 border-t border-zinc-800/30">
                      <p className="text-xs text-zinc-400">{health.satisfaction.recommendedAction}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {health.satisfaction.signals.slice(0, 3).map((s, i) => (
                          <span key={i} className="text-[10px] text-zinc-500 bg-zinc-800/40 rounded-full px-2 py-0.5 border border-zinc-700/40">{s}</span>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        <Link
                          href="/ai-cs/comms"
                          className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                        >
                          <MessageSquare className="h-3 w-3" />
                          Draft Message
                        </Link>
                        <span className="text-[10px] text-zinc-600">Retention risk: {health.satisfaction.retentionRisk}%</span>
                        <button
                          type="button"
                          onClick={() => void analyseClient(client)}
                          className="ml-auto text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                        >
                          Re-analyse
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── List view ────────────────────────────────────────────────────────── */}
      {filteredClients.length > 0 && view === 'list' && (
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_120px_1fr_40px] gap-4 px-5 py-3 border-b border-zinc-800/60">
            {['Client', 'Tier', 'LTV', 'Projects', 'Health', 'Since', ''].map(h => (
              <span key={h} className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{h}</span>
            ))}
          </div>
          <div className="divide-y divide-zinc-800/40">
            {filteredClients.map(client => {
              const health = healthMap[client.id]
              return (
                <div
                  key={client.id}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_120px_1fr_40px] gap-4 px-5 py-3.5 hover:bg-zinc-800/20 transition-colors items-center"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{client.companyName}</p>
                    <p className="text-xs text-zinc-500">{client.contactPerson} · {client.email}</p>
                  </div>
                  <TierBadge tier={client.tier} />
                  <span className="text-sm font-semibold text-zinc-200">RM {(client.ltv ?? 0).toLocaleString()}</span>
                  <span className="text-sm text-zinc-400">{client._count?.projects ?? '—'}</span>
                  <div>
                    {health?.satisfaction ? (
                      <HealthBadge health={health} />
                    ) : (
                      <button
                        type="button"
                        onClick={() => void analyseClient(client)}
                        disabled={health?.analysing}
                        className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-emerald-400 transition-colors disabled:opacity-60"
                      >
                        {health?.analysing ? <RefreshCw className="h-2.5 w-2.5 animate-spin" /> : <Heart className="h-2.5 w-2.5" />}
                        {health?.analysing ? 'Analysing…' : 'Analyse'}
                      </button>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500">
                    {new Date(client.createdAt).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </span>
                  <Link href={`/crm/${client.id}`} className="flex items-center justify-center text-zinc-600 hover:text-zinc-300 transition-colors">
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Card / Bento view ────────────────────────────────────────────────── */}
      {filteredClients.length > 0 && view === 'bento' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map(client => {
            const health = healthMap[client.id]
            return (
              <div
                key={client.id}
                className="group rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 space-y-3 hover:border-zinc-700 hover:bg-zinc-900/60 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-100 truncate">{client.companyName}</p>
                    <p className="text-xs text-zinc-500 truncate mt-0.5">{client.contactPerson}</p>
                  </div>
                  <TierBadge tier={client.tier} />
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wide">LTV</p>
                    <p className="text-sm font-semibold text-zinc-200 mt-0.5">RM {(client.ltv ?? 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Projects</p>
                    <p className="text-sm font-semibold text-zinc-200 mt-0.5">{client._count?.projects ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Since</p>
                    <p className="text-sm text-zinc-400 mt-0.5">{new Date(client.createdAt).toLocaleDateString('en-MY', { month: 'short', year: '2-digit' })}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-zinc-800/40">
                  {health?.satisfaction ? (
                    <HealthBadge health={health} />
                  ) : (
                    <button
                      type="button"
                      onClick={e => { e.preventDefault(); void analyseClient(client) }}
                      disabled={health?.analysing}
                      className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-emerald-400 transition-colors disabled:opacity-60"
                    >
                      {health?.analysing ? <RefreshCw className="h-2.5 w-2.5 animate-spin" /> : <Heart className="h-2.5 w-2.5" />}
                      {health?.analysing ? 'Analysing…' : 'Analyse Health'}
                    </button>
                  )}
                  <Link href={`/crm/${client.id}`} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
