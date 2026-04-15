'use client'

import { useEffect, useState } from 'react'
import {
  Users,
  Sparkles,
  RefreshCw,
  Flame,
  Thermometer,
  Wind,
  Plus,
  MessageSquare,
  Phone,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Bot,
} from 'lucide-react'

type LeadScore = 'HOT' | 'WARM' | 'COLD'
type LeadStatus = 'NEW' | 'QUALIFIED' | 'PROPOSAL_SENT' | 'NEGOTIATING' | 'WON' | 'LOST' | 'NURTURE'

interface Lead {
  id: string
  name: string
  company: string
  email: string
  phone: string | null
  score: LeadScore
  status: LeadStatus
  notes: string | null
  source: string | null
  createdAt: string
}

interface QualificationResult {
  qualified: boolean
  score: number
  signals: string[]
  redFlags: string[]
  recommendedAction: string
  estimatedDealSize: string
  priorityLevel: string
}

const SCORE_CONFIG: Record<LeadScore, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  HOT: { label: 'Hot', icon: Flame, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  WARM: { label: 'Warm', icon: Thermometer, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  COLD: { label: 'Cold', icon: Wind, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
}

const PRIORITY_COLOURS: Record<string, string> = {
  IMMEDIATE: 'text-red-400 bg-red-500/10 border-red-500/30',
  THIS_WEEK: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  THIS_MONTH: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  NURTURE: 'text-zinc-400 bg-zinc-800/40 border-zinc-700',
}

export default function AILeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [qualifications, setQualifications] = useState<Record<string, QualificationResult>>({})
  const [loading, setLoading] = useState(true)
  const [qualifying, setQualifying] = useState<string | null>(null)
  const [qualifyingAll, setQualifyingAll] = useState(false)
  const [filterScore, setFilterScore] = useState<LeadScore | 'ALL'>('ALL')

  useEffect(() => {
    void fetch('/api/crm/leads')
      .then(async (r) => r.ok ? (await r.json() as { data: Lead[] }).data ?? [] : [])
      .then((data) => { setLeads(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function qualifyLead(lead: Lead) {
    setQualifying(lead.id)
    try {
      const res = await fetch('/api/ai/sales-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'AUTO_QUALIFY_LEAD',
          leadId: lead.id,
          name: lead.name,
          company: lead.company,
          industry: 'Unknown',
          budget: 'Unknown',
          timeline: 'Unknown',
          source: lead.source ?? 'Unknown',
          notes: lead.notes ?? '',
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as { data: QualificationResult }
        setQualifications((prev) => ({ ...prev, [lead.id]: data.data }))
        // Update lead in list with new score
        setLeads((prev) => prev.map((l) => l.id === lead.id ? {
          ...l,
          score: data.data.score >= 70 ? 'HOT' : data.data.score >= 40 ? 'WARM' : 'COLD',
        } : l))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setQualifying(null)
    }
  }

  async function qualifyAll() {
    setQualifyingAll(true)
    const unqualified = leads.filter((l) => !qualifications[l.id])
    for (const lead of unqualified) {
      await qualifyLead(lead)
      await new Promise((r) => setTimeout(r, 500))
    }
    setQualifyingAll(false)
  }

  const filtered = filterScore === 'ALL' ? leads : leads.filter((l) => l.score === filterScore)
  const qualifiedCount = Object.keys(qualifications).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Lead Pipeline</h1>
          <p className="text-sm text-zinc-500 mt-0.5">AI-qualified leads with automated action recommendations</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button"
            onClick={() => void qualifyAll()}
            disabled={qualifyingAll || qualifiedCount === leads.length}
            className="flex items-center gap-2 rounded-lg bg-[#6366f1] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#5558e3] transition-colors disabled:opacity-60"
          >
            {qualifyingAll ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {qualifyingAll ? 'Qualifying…' : qualifiedCount === leads.length && leads.length > 0 ? 'All Qualified ✓' : 'AI Qualify All'}
          </button>
        </div>
      </div>

      {/* Score Filter */}
      <div className="flex items-center gap-2">
        {(['ALL', 'HOT', 'WARM', 'COLD'] as const).map((score) => {
          const config = score !== 'ALL' ? SCORE_CONFIG[score] : null
          const Icon = config?.icon
          const count = score === 'ALL' ? leads.length : leads.filter((l) => l.score === score).length
          return (
            <button type="button"
              key={score}
              onClick={() => setFilterScore(score)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                filterScore === score
                  ? score === 'ALL' ? 'bg-[#6366f1]/15 border-[#6366f1]/40 text-[#818cf8]' : `${config?.bg} ${config?.border} ${config?.color}`
                  : 'border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
              }`}
            >
              {Icon && <Icon className="h-3 w-3" />}
              {score === 'ALL' ? 'All' : SCORE_CONFIG[score].label}
              <span className="rounded-full bg-zinc-800/60 px-1.5 text-[10px]">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Leads List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-12 text-center space-y-3">
          <Users className="h-10 w-10 text-zinc-700 mx-auto" />
          <p className="text-sm text-zinc-500">No leads found</p>
          <a href="/sales" className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
            <Plus className="h-3 w-3" />
            Add leads in Sales Pipeline
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((lead) => {
            const config = SCORE_CONFIG[lead.score]
            const ScoreIcon = config.icon
            const qual = qualifications[lead.id]
            return (
              <div key={lead.id} className={`rounded-xl border p-4 space-y-3 ${config.bg} ${config.border}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${config.bg} ${config.color} text-sm font-semibold`}>
                      {lead.name[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-zinc-200">{lead.name}</p>
                        <span className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${config.bg} ${config.border} border ${config.color}`}>
                          <ScoreIcon className="h-2.5 w-2.5" />
                          {config.label}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">{lead.company} · {lead.status.replace(/_/g, ' ')}</p>
                      {lead.source && <p className="text-[10px] text-zinc-600 mt-0.5">Source: {lead.source}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {!qual ? (
                      <button type="button"
                        onClick={() => void qualifyLead(lead)}
                        disabled={qualifying === lead.id}
                        className="flex items-center gap-1.5 rounded-lg bg-[#6366f1]/15 border border-[#6366f1]/30 px-2.5 py-1.5 text-xs text-[#818cf8] hover:bg-[#6366f1]/25 transition-colors disabled:opacity-60"
                      >
                        {qualifying === lead.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Bot className="h-3 w-3" />}
                        {qualifying === lead.id ? 'Qualifying…' : 'AI Qualify'}
                      </button>
                    ) : (
                      <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${PRIORITY_COLOURS[qual.priorityLevel]}`}>
                        {qual.qualified ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
                        {qual.priorityLevel.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </div>

                {/* AI Qualification Details */}
                {qual && (
                  <div className="pt-2 border-t border-zinc-800/30 space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">AI Score</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                            <div className="h-full rounded-full bg-[#6366f1]" style={{ width: `${qual.score}%` }} />
                          </div>
                          <span className="text-xs font-bold text-zinc-200">{qual.score}/100</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Est. Deal Size</p>
                        <p className="text-xs font-semibold text-zinc-300">{qual.estimatedDealSize}</p>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-400">{qual.recommendedAction}</p>
                    {qual.signals.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {qual.signals.slice(0, 3).map((s, i) => (
                          <span key={i} className="text-[10px] text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-0.5 border border-emerald-500/20">{s}</span>
                        ))}
                        {qual.redFlags.slice(0, 2).map((f, i) => (
                          <span key={i} className="text-[10px] text-red-400 bg-red-500/10 rounded-full px-2 py-0.5 border border-red-500/20">{f}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Quick Actions */}
                <div className="flex items-center gap-1.5 pt-1">
                  <button type="button" className="cursor-pointer flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-[10px] text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                    <MessageSquare className="h-2.5 w-2.5" />
                    WhatsApp
                  </button>
                  <a
                    href={`/ai-sales/prospects`}
                    className="flex items-center gap-1 rounded-md bg-[#6366f1]/10 border border-[#6366f1]/20 px-2 py-1 text-[10px] text-[#818cf8] hover:bg-[#6366f1]/20 transition-colors"
                  >
                    <FileText className="h-2.5 w-2.5" />
                    Draft Script
                  </a>
                  {lead.email && (
                    <a
                      href={`mailto:${lead.email}`}
                      className="flex items-center gap-1 rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-1 text-[10px] text-blue-400 hover:bg-blue-500/20 transition-colors"
                    >
                      <Phone className="h-2.5 w-2.5" />
                      Email
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
