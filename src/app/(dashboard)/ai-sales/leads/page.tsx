'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Users,
  Sparkles,
  RefreshCw,
  Flame,
  Thermometer,
  Wind,
  Plus,
  MessageSquare,
  Mail,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronUp,
  Trash2,
  StickyNote,
  Phone,
  ArrowRight,
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
  HOT:  { label: 'Hot',  icon: Flame,       color: 'text-red-400',   bg: 'bg-red-500/10',   border: 'border-red-500/30'   },
  WARM: { label: 'Warm', icon: Thermometer, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  COLD: { label: 'Cold', icon: Wind,        color: 'text-blue-400',  bg: 'bg-blue-500/10',  border: 'border-blue-500/30'  },
}

const SCORE_CYCLE: LeadScore[] = ['HOT', 'WARM', 'COLD']

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW:           'New',
  QUALIFIED:     'Qualified',
  PROPOSAL_SENT: 'Proposal Sent',
  NEGOTIATING:   'Negotiating',
  WON:           'Won ✓',
  LOST:          'Lost',
  NURTURE:       'Nurture',
}

const STATUS_CYCLE: LeadStatus[] = ['NEW', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATING', 'WON', 'NURTURE', 'LOST']

const PRIORITY_COLOURS: Record<string, string> = {
  IMMEDIATE:  'text-red-400 bg-red-500/10 border-red-500/30',
  THIS_WEEK:  'text-amber-400 bg-amber-500/10 border-amber-500/30',
  THIS_MONTH: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  NURTURE:    'text-zinc-400 bg-zinc-800/40 border-zinc-700',
}

export default function AILeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [qualifications, setQualifications] = useState<Record<string, QualificationResult>>({})
  const [loading, setLoading] = useState(true)
  const [qualifying, setQualifying] = useState<string | null>(null)
  const [qualifyingAll, setQualifyingAll] = useState(false)
  const [filterScore, setFilterScore] = useState<LeadScore | 'ALL'>('ALL')
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({})
  const [savingNotes, setSavingNotes] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchLeads = useCallback(() => {
    setLoading(true)
    void fetch('/api/crm/leads')
      .then(async (r) => r.ok ? (await r.json() as { data: Lead[] }).data ?? [] : [])
      .then((data) => { setLeads(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { fetchLeads() }, [fetchLeads])

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
        setLeads((prev) => prev.map((l) => l.id === lead.id ? {
          ...l,
          score: data.data.score >= 70 ? 'HOT' : data.data.score >= 40 ? 'WARM' : 'COLD',
        } : l))
      }
    } finally {
      setQualifying(null)
    }
  }

  async function qualifyAll() {
    setQualifyingAll(true)
    const unqualified = leads.filter((l) => !qualifications[l.id])
    // Run in parallel batches of 3
    for (let i = 0; i < unqualified.length; i += 3) {
      await Promise.all(unqualified.slice(i, i + 3).map((l) => qualifyLead(l)))
    }
    setQualifyingAll(false)
  }

  async function cycleScore(lead: Lead) {
    const nextIdx = (SCORE_CYCLE.indexOf(lead.score) + 1) % SCORE_CYCLE.length
    const nextScore = SCORE_CYCLE[nextIdx]
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, score: nextScore } : l))
    await fetch(`/api/crm/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: nextScore }),
    })
  }

  async function cycleStatus(lead: Lead) {
    setUpdatingStatus(lead.id)
    const nextIdx = (STATUS_CYCLE.indexOf(lead.status) + 1) % STATUS_CYCLE.length
    const nextStatus = STATUS_CYCLE[nextIdx]
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, status: nextStatus } : l))
    await fetch(`/api/crm/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
    setUpdatingStatus(null)
  }

  async function saveNotes(lead: Lead) {
    setSavingNotes(lead.id)
    const notes = editingNotes[lead.id] ?? lead.notes ?? ''
    await fetch(`/api/crm/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, notes } : l))
    setSavingNotes(null)
    setExpandedNotes((prev) => ({ ...prev, [lead.id]: false }))
  }

  async function deleteLead(id: string) {
    if (!confirm('Delete this lead? This cannot be undone.')) return
    setDeletingId(id)
    await fetch(`/api/crm/leads/${id}`, { method: 'DELETE' })
    setLeads((prev) => prev.filter((l) => l.id !== id))
    setDeletingId(null)
  }

  function openWhatsApp(lead: Lead) {
    const phone = lead.phone?.replace(/\D/g, '') ?? ''
    const msg = encodeURIComponent(`Hi ${lead.name.split(' ')[0]}, this is Envicion Studio reaching out. Do you have a moment to discuss your design needs?`)
    const url = phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`
    window.open(url, '_blank')
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Lead Pipeline</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{leads.length} leads · click score or status to update inline</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/crm"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Lead
          </a>
          <button type="button"
            onClick={() => void qualifyAll()}
            disabled={qualifyingAll || (qualifiedCount === leads.length && leads.length > 0)}
            className="flex items-center gap-2 rounded-lg bg-[#6366f1] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#5558e3] transition-colors disabled:opacity-60"
          >
            {qualifyingAll ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {qualifyingAll ? 'Qualifying…' : qualifiedCount === leads.length && leads.length > 0 ? 'All Qualified ✓' : 'AI Qualify All'}
          </button>
        </div>
      </div>

      {/* Score Filter */}
      <div className="flex items-center gap-2 flex-wrap">
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
          <p className="text-sm text-zinc-500">No leads yet</p>
          <a href="/crm" className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
            <Plus className="h-3 w-3" />
            Add your first lead in CRM
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((lead) => {
            const config = SCORE_CONFIG[lead.score]
            const ScoreIcon = config.icon
            const qual = qualifications[lead.id]
            const notesOpen = expandedNotes[lead.id] ?? false
            const currentNote = editingNotes[lead.id] ?? lead.notes ?? ''

            return (
              <div key={lead.id} className={`rounded-xl border p-4 space-y-3 transition-colors ${config.bg} ${config.border}`}>

                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${config.bg} ${config.color} text-sm font-semibold border ${config.border}`}>
                      {lead.name[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-zinc-200">{lead.name}</p>

                        {/* Clickable score badge — cycles HOT → WARM → COLD */}
                        <button
                          type="button"
                          title="Click to change score"
                          onClick={() => void cycleScore(lead)}
                          className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${config.bg} ${config.border} border ${config.color} hover:opacity-80 transition-opacity cursor-pointer`}
                        >
                          <ScoreIcon className="h-2.5 w-2.5" />
                          {config.label}
                        </button>

                        {/* Clickable status badge — cycles through pipeline */}
                        <button
                          type="button"
                          title="Click to advance status"
                          onClick={() => void cycleStatus(lead)}
                          disabled={updatingStatus === lead.id}
                          className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-zinc-800/60 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {updatingStatus === lead.id
                            ? <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                            : <ArrowRight className="h-2.5 w-2.5" />}
                          {STATUS_LABELS[lead.status]}
                        </button>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">{lead.company}</p>
                      {lead.source && <p className="text-[10px] text-zinc-600 mt-0.5">via {lead.source}</p>}
                    </div>
                  </div>

                  {/* Right: qualify + delete */}
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
                      <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${PRIORITY_COLOURS[qual.priorityLevel] ?? PRIORITY_COLOURS.NURTURE}`}>
                        {qual.qualified ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
                        {qual.priorityLevel.replace(/_/g, ' ')}
                      </span>
                    )}
                    <button
                      type="button"
                      title="Delete lead"
                      onClick={() => void deleteLead(lead.id)}
                      disabled={deletingId === lead.id}
                      className="rounded-md p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      {deletingId === lead.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* AI Qualification panel */}
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
                    {(qual.signals.length > 0 || qual.redFlags.length > 0) && (
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

                {/* Notes section — expandable inline editor */}
                {notesOpen && (
                  <div className="pt-2 border-t border-zinc-800/30 space-y-2">
                    <textarea
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#6366f1]/50 resize-none"
                      rows={3}
                      placeholder="Add notes, call outcomes, next steps…"
                      value={currentNote}
                      onChange={(e) => setEditingNotes((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <button type="button"
                        onClick={() => void saveNotes(lead)}
                        disabled={savingNotes === lead.id}
                        className="flex items-center gap-1.5 rounded-md bg-[#6366f1] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#5558e3] transition-colors disabled:opacity-60"
                      >
                        {savingNotes === lead.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
                        {savingNotes === lead.id ? 'Saving…' : 'Save Notes'}
                      </button>
                      <button type="button"
                        onClick={() => setExpandedNotes((prev) => ({ ...prev, [lead.id]: false }))}
                        className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Quick Actions row */}
                <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                  {/* WhatsApp — now actually works */}
                  <button
                    type="button"
                    onClick={() => openWhatsApp(lead)}
                    className="flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-[10px] text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                  >
                    <MessageSquare className="h-2.5 w-2.5" />
                    WhatsApp
                    {!lead.phone && <span className="ml-0.5 text-emerald-600">(no number)</span>}
                  </button>

                  {/* Draft Script — prefills lead context */}
                  <a
                    href={`/ai-sales/prospects?leadId=${lead.id}&name=${encodeURIComponent(lead.name)}&company=${encodeURIComponent(lead.company)}&stage=${lead.status}`}
                    className="flex items-center gap-1 rounded-md bg-[#6366f1]/10 border border-[#6366f1]/20 px-2 py-1 text-[10px] text-[#818cf8] hover:bg-[#6366f1]/20 transition-colors"
                  >
                    <FileText className="h-2.5 w-2.5" />
                    Draft Script
                  </a>

                  {/* Email */}
                  {lead.email && (
                    <a
                      href={`mailto:${lead.email}`}
                      className="flex items-center gap-1 rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-1 text-[10px] text-blue-400 hover:bg-blue-500/20 transition-colors"
                    >
                      <Mail className="h-2.5 w-2.5" />
                      Email
                    </a>
                  )}

                  {/* Phone call */}
                  {lead.phone && (
                    <a
                      href={`tel:${lead.phone}`}
                      className="flex items-center gap-1 rounded-md bg-violet-500/10 border border-violet-500/20 px-2 py-1 text-[10px] text-violet-400 hover:bg-violet-500/20 transition-colors"
                    >
                      <Phone className="h-2.5 w-2.5" />
                      Call
                    </a>
                  )}

                  {/* Notes toggle */}
                  <button
                    type="button"
                    onClick={() => setExpandedNotes((prev) => ({ ...prev, [lead.id]: !prev[lead.id] }))}
                    className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] transition-colors ml-auto ${
                      lead.notes
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
                        : 'bg-zinc-800/40 border-zinc-700 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <StickyNote className="h-2.5 w-2.5" />
                    {lead.notes ? 'Edit Notes' : 'Add Notes'}
                    {notesOpen ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
