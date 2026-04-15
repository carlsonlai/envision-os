'use client'

import { useEffect, useState } from 'react'
import { Heart, Sparkles, RefreshCw, AlertTriangle, CheckCircle2, Users, TrendingUp, MessageSquare } from 'lucide-react'

interface Client {
  id: string
  companyName: string
  contactPerson: string
  email: string
  tier: string
  ltv: number
  projects?: Array<{ status: string; deadline: string | null }>
}

interface SatisfactionResult {
  score: number
  status: 'HAPPY' | 'NEUTRAL' | 'AT_RISK' | 'CRITICAL'
  signals: string[]
  recommendedAction: string
  urgency: string
  retentionRisk: number
}

interface ClientAnalysis {
  client: Client
  satisfaction: SatisfactionResult | null
  analysing: boolean
}

const STATUS_CONFIG = {
  HAPPY: { label: 'Happy', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', icon: CheckCircle2 },
  NEUTRAL: { label: 'Neutral', color: 'text-zinc-400', bg: 'bg-zinc-800/40 border-zinc-700', icon: CheckCircle2 },
  AT_RISK: { label: 'At Risk', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', icon: AlertTriangle },
  CRITICAL: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', icon: AlertTriangle },
}

const TIER_COLOURS: Record<string, string> = {
  PLATINUM: 'text-cyan-400 bg-cyan-500/10',
  GOLD: 'text-amber-400 bg-amber-500/10',
  SILVER: 'text-zinc-300 bg-zinc-700/40',
  BRONZE: 'text-orange-400 bg-orange-500/10',
}

export default function AICSClientsPage() {
  const [analyses, setAnalyses] = useState<ClientAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [analysingAll, setAnalysingAll] = useState(false)

  useEffect(() => {
    void fetch('/api/crm/clients')
      .then(async (r) => r.ok ? (await r.json() as { data: Client[] }).data ?? [] : [])
      .then((clients) => {
        setAnalyses(clients.map((c) => ({ client: c, satisfaction: null, analysing: false })))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function analyseClient(clientId: string) {
    setAnalyses((prev) => prev.map((a) => a.client.id === clientId ? { ...a, analysing: true } : a))
    try {
      const res = await fetch('/api/ai/cs-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ANALYSE_SATISFACTION',
          clientId,
          clientName: analyses.find((a) => a.client.id === clientId)?.client.companyName ?? '',
          recentMessages: [],
          revisionCount: 2,
          projectDaysOverdue: 0,
          lastContactDays: 5,
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as { data: SatisfactionResult }
        setAnalyses((prev) => prev.map((a) => a.client.id === clientId ? { ...a, satisfaction: data.data, analysing: false } : a))
      }
    } catch (e) {
      console.error(e)
      setAnalyses((prev) => prev.map((a) => a.client.id === clientId ? { ...a, analysing: false } : a))
    }
  }

  async function analyseAll() {
    setAnalysingAll(true)
    for (const analysis of analyses) {
      if (!analysis.satisfaction) {
        await analyseClient(analysis.client.id)
        await new Promise((r) => setTimeout(r, 600))
      }
    }
    setAnalysingAll(false)
  }

  const analysedCount = analyses.filter((a) => a.satisfaction !== null).length
  const atRisk = analyses.filter((a) => a.satisfaction?.status === 'AT_RISK' || a.satisfaction?.status === 'CRITICAL').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Client Health Monitor</h1>
          <p className="text-sm text-zinc-500 mt-0.5">AI-driven satisfaction analysis for all clients</p>
        </div>
        <button type="button"
          onClick={() => void analyseAll()}
          disabled={analysingAll || analysedCount === analyses.length}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
        >
          {analysingAll ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {analysingAll ? 'Analysing…' : analysedCount === analyses.length && analysedCount > 0 ? 'All Analysed ✓' : 'Analyse All Clients'}
        </button>
      </div>

      {/* Summary */}
      {analysedCount > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 text-center">
            <p className="text-2xl font-bold text-zinc-100">{analysedCount}</p>
            <p className="text-xs text-zinc-500">Clients Analysed</p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{atRisk}</p>
            <p className="text-xs text-zinc-500">At Risk / Critical</p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{analyses.filter((a) => a.satisfaction?.status === 'HAPPY').length}</p>
            <p className="text-xs text-zinc-500">Happy Clients</p>
          </div>
        </div>
      )}

      {/* Client List */}
      {analyses.length === 0 ? (
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-12 text-center">
          <Users className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No clients found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {analyses.map(({ client, satisfaction, analysing }) => {
            const config = satisfaction ? STATUS_CONFIG[satisfaction.status] : null
            const StatusIcon = config?.icon ?? CheckCircle2
            return (
              <div key={client.id} className={`rounded-xl border p-4 ${config ? `${config.bg}` : 'border-zinc-800/60 bg-zinc-900/40'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-zinc-800/60 text-sm font-semibold text-zinc-300">
                      {client.companyName[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-zinc-200">{client.companyName}</p>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${TIER_COLOURS[client.tier] ?? 'text-zinc-500 bg-zinc-800'}`}>
                          {client.tier}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">{client.contactPerson} · RM {client.ltv.toLocaleString()} LTV</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {satisfaction ? (
                      <div className="text-right space-y-1">
                        <div className="flex items-center justify-end gap-1.5">
                          <StatusIcon className={`h-3.5 w-3.5 ${config?.color}`} />
                          <span className={`text-xs font-semibold ${config?.color}`}>{config?.label}</span>
                        </div>
                        <p className="text-xs font-bold text-zinc-200">{satisfaction.score}/10</p>
                      </div>
                    ) : (
                      <button type="button"
                        onClick={() => void analyseClient(client.id)}
                        disabled={analysing}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-60"
                      >
                        {analysing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Heart className="h-3 w-3" />}
                        {analysing ? 'Analysing…' : 'Analyse'}
                      </button>
                    )}
                  </div>
                </div>

                {satisfaction && (
                  <div className="mt-3 space-y-2 pt-3 border-t border-zinc-800/30">
                    <p className="text-xs text-zinc-400">{satisfaction.recommendedAction}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {satisfaction.signals.slice(0, 3).map((s, i) => (
                        <span key={i} className="text-[10px] text-zinc-500 bg-zinc-800/40 rounded-full px-2 py-0.5 border border-zinc-700/40">{s}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <a
                        href="/ai-cs/comms"
                        className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                      >
                        <MessageSquare className="h-3 w-3" />
                        Draft Message
                      </a>
                      <span className="text-[10px] text-zinc-600">Retention risk: {satisfaction.retentionRisk}%</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
