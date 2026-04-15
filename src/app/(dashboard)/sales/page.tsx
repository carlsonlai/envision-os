'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  TrendingUp,
  Flame,
  Thermometer,
  Wind,
  MessageSquare,
  Plus,
  Target,
  Zap,
  Phone,
  ChevronRight,
  ArrowUp,
  Users,
  LayoutGrid,
  List,
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
  createdAt: string
}

interface PipelineData {
  NEW: Lead[]
  QUALIFIED: Lead[]
  PROPOSAL_SENT: Lead[]
  NEGOTIATING: Lead[]
  WON: Lead[]
  LOST: Lead[]
  NURTURE: Lead[]
}

interface AIAction {
  priority: number
  action: string
  contact: string
  reason: string
}

const PIPELINE_STAGES: { status: LeadStatus; label: string; color: string }[] = [
  { status: 'NEW', label: 'New', color: 'border-zinc-700 bg-zinc-800/20' },
  { status: 'QUALIFIED', label: 'Qualified', color: 'border-blue-500/20 bg-blue-500/5' },
  { status: 'PROPOSAL_SENT', label: 'Proposal', color: 'border-purple-500/20 bg-purple-500/5' },
  { status: 'NEGOTIATING', label: 'Negotiating', color: 'border-amber-500/20 bg-amber-500/5' },
  { status: 'WON', label: 'Won', color: 'border-emerald-500/20 bg-emerald-500/5' },
  { status: 'LOST', label: 'Lost', color: 'border-red-500/20 bg-red-500/5' },
]

const SCORE_CONFIG: Record<LeadScore, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  HOT: { label: 'Hot', icon: Flame, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
  WARM: { label: 'Warm', icon: Thermometer, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  COLD: { label: 'Cold', icon: Wind, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
}

function ScoreBadge({ score }: { score: LeadScore }) {
  const config = SCORE_CONFIG[score]
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${config.color} ${config.bg}`}>
      <Icon className="h-2.5 w-2.5" />
      {config.label}
    </span>
  )
}

function daysInStage(lead: Lead): number {
  return Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24))
}

interface AddLeadModalProps {
  onClose: () => void
  onAdd: (lead: Omit<Lead, 'id' | 'createdAt'>) => void
}

function AddLeadModal({ onClose, onAdd }: AddLeadModalProps) {
  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    score: 'COLD' as LeadScore,
    status: 'NEW' as LeadStatus,
    notes: '',
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onAdd({ ...form, phone: form.phone || null, notes: form.notes || null })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-[#0d0d14] p-6 shadow-2xl">
        <h2 className="text-base font-semibold text-zinc-100 mb-4">Add New Lead</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {[
            { id: 'name', label: 'Name', type: 'text', required: true },
            { id: 'company', label: 'Company', type: 'text', required: true },
            { id: 'email', label: 'Email', type: 'email', required: true },
            { id: 'phone', label: 'Phone', type: 'tel', required: false },
          ].map((field) => (
            <div key={field.id}>
              <label className="text-xs text-zinc-500 mb-1 block">{field.label}</label>
              <input
                type={field.type}
                required={field.required}
                value={form[field.id as keyof typeof form] as string}
                onChange={(e) => setForm((f) => ({ ...f, [field.id]: e.target.value }))}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#6366f1]/50"
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Score</label>
              <select
                value={form.score}
                onChange={(e) => setForm((f) => ({ ...f, score: e.target.value as LeadScore }))}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 outline-none"
              >
                <option value="HOT">Hot</option>
                <option value="WARM">Warm</option>
                <option value="COLD">Cold</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as LeadStatus }))}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 outline-none"
              >
                <option value="NEW">New</option>
                <option value="QUALIFIED">Qualified</option>
                <option value="PROPOSAL_SENT">Proposal Sent</option>
                <option value="NEGOTIATING">Negotiating</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer flex-1 rounded-lg border border-zinc-800 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cursor-pointer flex-1 rounded-lg bg-[#6366f1] py-2 text-sm font-medium text-white hover:bg-[#5558e3] transition-colors"
            >
              Add Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SalesPage() {
  const { data: session } = useSession()
  const [pipeline, setPipeline] = useState<PipelineData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [pipelineView, setPipelineView] = useState<'kanban' | 'list'>('kanban')
  const [revenueTarget] = useState({ current: 0, target: 0 })

  const progress = Math.round((revenueTarget.current / revenueTarget.target) * 100)

  const aiActions: AIAction[] = []

  const mockMessages: Array<{ id: string; contact: string; preview: string; time: string; unread: boolean }> = []

  useEffect(() => {
    async function load() {
      try {
        const salesId =
          session?.user?.role === 'SALES' ? `?salesId=${session.user.id}` : ''
        const res = await fetch(`/api/crm/pipeline${salesId}`)
        if (res.ok) {
          const data = (await res.json()) as { data: PipelineData }
          setPipeline(data.data)
        }
      } catch (error) {
        console.error('Pipeline load error:', error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [session])

  async function handleAddLead(leadData: Omit<Lead, 'id' | 'createdAt'>) {
    try {
      const res = await fetch('/api/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData),
      })
      if (res.ok) {
        setShowAddModal(false)
        // Reload pipeline
        const pipelineRes = await fetch('/api/crm/pipeline')
        if (pipelineRes.ok) {
          const data = (await pipelineRes.json()) as { data: PipelineData }
          setPipeline(data.data)
        }
      }
    } catch (error) {
      console.error('Add lead error:', error)
    }
  }

  async function moveLeadToStage(leadId: string, newStatus: LeadStatus) {
    try {
      await fetch(`/api/crm/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const res = await fetch('/api/crm/pipeline')
      if (res.ok) {
        const data = (await res.json()) as { data: PipelineData }
        setPipeline(data.data)
      }
    } catch (error) {
      console.error('Move lead error:', error)
    }
  }

  const allLeads = pipeline
    ? Object.values(pipeline).flat()
    : []
  const hotLeads = allLeads.filter((l) => l.score === 'HOT')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Sales Pipeline</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{allLeads.length} active leads</p>
        </div>
        <button type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-lg bg-[#6366f1] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#5558e3] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Lead
        </button>
      </div>

      {/* Top section: Revenue + AI Actions + WhatsApp */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Revenue target */}
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[#818cf8]" />
            <h2 className="text-sm font-semibold text-zinc-200">Revenue vs Target</h2>
            <div className="ml-auto flex items-center gap-1 text-xs text-emerald-400">
              <ArrowUp className="h-3 w-3" />
              {progress}%
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold text-zinc-100">RM {revenueTarget.current.toLocaleString()}</span>
              <span className="text-sm text-zinc-500">/ RM {revenueTarget.target.toLocaleString()}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-zinc-600">Gap: RM {(revenueTarget.target - revenueTarget.current).toLocaleString()}</p>
          </div>

          {/* Pipeline counts */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              { label: 'Hot Leads', value: hotLeads.length, color: 'text-red-400' },
              { label: 'Proposals', value: pipeline?.PROPOSAL_SENT.length ?? 0, color: 'text-purple-400' },
              { label: 'Negotiating', value: pipeline?.NEGOTIATING.length ?? 0, color: 'text-amber-400' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-[10px] text-zinc-600 leading-tight">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI Push Actions */}
        <div className="rounded-xl border border-[#6366f1]/20 bg-[#6366f1]/5 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#818cf8]" />
            <h2 className="text-sm font-semibold text-zinc-200">Do These 3 Things Now</h2>
          </div>
          <div className="space-y-2">
            {aiActions.map((action) => (
              <div key={action.priority} className="flex items-start gap-3 rounded-lg bg-zinc-900/60 border border-zinc-800/40 p-3">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#6366f1]/20 text-[10px] font-bold text-[#818cf8]">
                  {action.priority}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-zinc-200">
                    {action.action} <span className="text-[#818cf8]">{action.contact}</span>
                  </p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">{action.reason}</p>
                </div>
                <button type="button" className="cursor-pointer flex-shrink-0 rounded p-1 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
                  <Phone className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* WhatsApp Inbox */}
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-zinc-200">WhatsApp Inbox</h2>
            <span className="ml-auto text-[10px] text-zinc-600">
              {mockMessages.filter((m) => m.unread).length} unread
            </span>
          </div>
          <div className="space-y-0.5">
            {mockMessages.map((msg) => (
              <div
                key={msg.id}
                className="flex items-start gap-2.5 rounded-lg p-2 hover:bg-zinc-800/40 cursor-pointer transition-colors"
              >
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold">
                  {msg.contact[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-xs font-medium truncate ${msg.unread ? 'text-zinc-100' : 'text-zinc-400'}`}>
                      {msg.contact}
                    </span>
                    <span className="text-[10px] text-zinc-600 flex-shrink-0">{msg.time}</span>
                  </div>
                  <p className="text-[10px] text-zinc-600 truncate">{msg.preview}</p>
                </div>
                {msg.unread && <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0 mt-1.5" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Kanban Pipeline */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-200">Pipeline</h2>
          <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 p-0.5">
            <button
              type="button"
              onClick={() => setPipelineView('kanban')}
              className={`rounded p-1.5 transition-colors ${pipelineView === 'kanban' ? 'bg-[#6366f1]/20 text-[#818cf8]' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Kanban view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPipelineView('list')}
              className={`rounded p-1.5 transition-colors ${pipelineView === 'list' ? 'bg-[#6366f1]/20 text-[#818cf8]' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="List view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {pipelineView === 'list' ? (
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1fr)_90px_100px_80px_70px] gap-0 border-b border-zinc-800/60 px-4 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Lead</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Score</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Stage</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 text-right">Days</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 text-right">Move</span>
            </div>
            {allLeads.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-zinc-600">No leads yet</div>
            ) : (
              allLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="grid grid-cols-[minmax(0,1fr)_90px_100px_80px_70px] gap-0 items-center px-4 py-2.5 border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/20 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-200 truncate">{lead.name}</p>
                    <p className="text-[10px] text-zinc-500 truncate">{lead.company}</p>
                  </div>
                  <ScoreBadge score={lead.score} />
                  <span className="text-xs text-zinc-400">{PIPELINE_STAGES.find(s => s.status === lead.status)?.label ?? lead.status}</span>
                  <span className="text-xs text-zinc-500 text-right">{daysInStage(lead)}d</span>
                  <div className="flex justify-end">
                    {lead.status !== 'WON' && lead.status !== 'LOST' && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextStages: Record<LeadStatus, LeadStatus | null> = {
                            NEW: 'QUALIFIED',
                            QUALIFIED: 'PROPOSAL_SENT',
                            PROPOSAL_SENT: 'NEGOTIATING',
                            NEGOTIATING: 'WON',
                            WON: null,
                            LOST: null,
                            NURTURE: 'QUALIFIED',
                          }
                          const next = nextStages[lead.status as LeadStatus]
                          if (next) void moveLeadToStage(lead.id, next)
                        }}
                        className="rounded bg-[#6366f1]/20 text-[9px] text-[#818cf8] px-2 py-0.5 hover:bg-[#6366f1]/30 transition-colors"
                      >
                        → Next
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {PIPELINE_STAGES.map((stage) => {
            const stageLeads = pipeline?.[stage.status] ?? []
            return (
              <div key={stage.status} className={`rounded-xl border ${stage.color} p-3 min-h-[200px]`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{stage.label}</span>
                  <span className="text-xs font-semibold text-zinc-400">{stageLeads.length}</span>
                </div>
                <div className="space-y-2">
                  {stageLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="rounded-lg border border-zinc-800/60 bg-zinc-900/60 p-2.5 cursor-pointer hover:border-zinc-700 transition-colors group"
                    >
                      <p className="text-xs font-medium text-zinc-200 truncate">{lead.name}</p>
                      <p className="text-[10px] text-zinc-500 truncate">{lead.company}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <ScoreBadge score={lead.score} />
                        <span className="text-[9px] text-zinc-600">{daysInStage(lead)}d</span>
                      </div>
                      {/* Quick move buttons on hover */}
                      {stage.status !== 'WON' && stage.status !== 'LOST' && (
                        <div className="hidden group-hover:flex gap-1 mt-1.5">
                          <button type="button"
                            onClick={() => {
                              const nextStages: Record<LeadStatus, LeadStatus | null> = {
                                NEW: 'QUALIFIED',
                                QUALIFIED: 'PROPOSAL_SENT',
                                PROPOSAL_SENT: 'NEGOTIATING',
                                NEGOTIATING: 'WON',
                                WON: null,
                                LOST: null,
                                NURTURE: 'QUALIFIED',
                              }
                              const next = nextStages[stage.status]
                              if (next) moveLeadToStage(lead.id, next)
                            }}
                            className="flex-1 rounded bg-[#6366f1]/20 text-[9px] text-[#818cf8] py-0.5 hover:bg-[#6366f1]/30 transition-colors"
                          >
                            → Next
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        )}
      </div>

      {/* Hot Leads */}
      {hotLeads.length > 0 && (
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-red-400" />
            <h2 className="text-sm font-semibold text-zinc-200">Hot Leads</h2>
            <span className="rounded-full bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
              {hotLeads.length}
            </span>
          </div>
          <div className="space-y-2">
            {hotLeads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between rounded-lg border border-zinc-800/40 bg-zinc-800/20 px-4 py-3 hover:border-zinc-700/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6366f1]/15 text-[#818cf8] text-xs font-semibold">
                    {lead.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{lead.name}</p>
                    <p className="text-xs text-zinc-500">{lead.company}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ScoreBadge score={lead.score} />
                  <span className="text-xs text-zinc-500">{lead.status.replace(/_/g, ' ')}</span>
                  <div className="flex gap-1">
                    <button type="button" className="cursor-pointer rounded-md px-2 py-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      WA
                    </button>
                    <button type="button" className="cursor-pointer rounded-md px-2 py-1 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      Call
                    </button>
                  </div>
                  <ChevronRight className="h-4 w-4 text-zinc-600" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAddModal && (
        <AddLeadModal onClose={() => setShowAddModal(false)} onAdd={handleAddLead} />
      )}
    </div>
  )
}
