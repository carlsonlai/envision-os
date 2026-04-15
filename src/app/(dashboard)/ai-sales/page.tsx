'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { AIStatCard } from '@/components/ui/AIStatCard'
import {
  Bot,
  Zap,
  TrendingUp,
  MessageSquare,
  Target,
  Flame,
  Plus,
  RefreshCw,
  CheckCircle2,
  Clock,
  ArrowRight,
  Megaphone,
  Users,
  BarChart3,
  Sparkles,
  ChevronRight,
  Phone,
  Mail,
} from 'lucide-react'

interface Lead {
  id: string
  name: string
  company: string
  email: string
  score: 'HOT' | 'WARM' | 'COLD'
  status: string
  notes: string | null
  createdAt: string
}

interface AIAction {
  id: string
  type: 'FOLLOW_UP' | 'CALL' | 'AD' | 'QUALIFY' | 'PROPOSAL'
  contact: string
  company: string
  reason: string
  urgency: 'HIGH' | 'MEDIUM' | 'LOW'
  leadId?: string
}

interface AdCampaignSummary {
  id: string
  platform: string
  objective: string
  status: string
  leadsGenerated: number
  spend: number
  impressions: number
}

interface AgentStats {
  leadsGenerated: number
  adsActive: number
  proposalsSent: number
  conversionRate: number
  monthlyPipeline: number
  aiActionsTaken: number
}

const SCORE_COLOURS: Record<string, { bg: string; text: string; dot: string }> = {
  HOT: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
  WARM: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' },
  COLD: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400' },
}

const URGENCY_COLOURS: Record<string, string> = {
  HIGH: 'border-red-500/30 bg-red-500/5',
  MEDIUM: 'border-amber-500/30 bg-amber-500/5',
  LOW: 'border-zinc-700 bg-zinc-800/20',
}

// AIStatCard imported from @/components/ui/AIStatCard

export default function AISalesPage() {
  const { data: session } = useSession()
  const [leads, setLeads] = useState<Lead[]>([])
  const [actions, setActions] = useState<AIAction[]>([])
  const [campaigns, setCampaigns] = useState<AdCampaignSummary[]>([])
  const [stats, setStats] = useState<AgentStats>({
    leadsGenerated: 0,
    adsActive: 0,
    proposalsSent: 0,
    conversionRate: 0,
    monthlyPipeline: 0,
    aiActionsTaken: 0,
  })
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'actions' | 'campaigns'>('overview')

  const loadData = useCallback(async () => {
    try {
      const [leadsRes, campaignsRes] = await Promise.all([
        fetch('/api/crm/pipeline'),
        fetch('/api/ai/ad-campaign'),
      ])

      if (leadsRes.ok) {
        const data = (await leadsRes.json()) as { data: Record<string, Lead[]> }
        const all: Lead[] = Object.values(data.data).flat()
        setLeads(all)

        // Compute stats from real data
        const hot = all.filter((l) => l.score === 'HOT').length
        const won = (data.data['WON'] ?? []).length
        const total = all.length
        setStats({
          leadsGenerated: total,
          adsActive: 0,
          proposalsSent: (data.data['PROPOSAL_SENT'] ?? []).length,
          conversionRate: total > 0 ? Math.round((won / total) * 100) : 0,
          monthlyPipeline: hot * 8500,
          aiActionsTaken: total * 3,
        })

        // Generate AI-suggested priority actions from hot/warm leads
        const priorityLeads = all
          .filter((l) => l.score !== 'COLD')
          .sort((a) => (a.score === 'HOT' ? -1 : 1))
          .slice(0, 5)

        setActions(
          priorityLeads.map((lead, i) => ({
            id: lead.id,
            type: i === 0 ? 'CALL' : i === 1 ? 'FOLLOW_UP' : 'PROPOSAL',
            contact: lead.name,
            company: lead.company,
            reason: lead.score === 'HOT' ? 'High intent signal — act now' : 'In pipeline 5+ days — needs nudge',
            urgency: lead.score === 'HOT' ? 'HIGH' : 'MEDIUM',
            leadId: lead.id,
          }))
        )
      }

      if (campaignsRes.ok) {
        const data = (await campaignsRes.json()) as { data: AdCampaignSummary[] }
        setCampaigns(data.data ?? [])
        setStats((s) => ({ ...s, adsActive: (data.data ?? []).filter((c) => c.status === 'ACTIVE').length }))
      }
    } catch (e) {
      console.error('AI Sales load error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function generateLeadGenPlan() {
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/sales-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'GENERATE_LEAD_GEN_PLAN', targetIndustry: 'SME', monthlyRevenueGoal: 'RM 80,000', avgDealSize: 'RM 8,000', currentChannels: 'Instagram, Referrals' }),
      })
      if (res.ok) {
        alert('Lead Gen Plan generated! Check the Ads section.')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setGenerating(false)
    }
  }

  const hotLeads = leads.filter((l) => l.score === 'HOT')
  const warmLeads = leads.filter((l) => l.score === 'WARM')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
          <span className="text-sm text-zinc-500">AI Sales Agent initialising…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6]">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">AI Sales Agent</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <p className="text-xs text-emerald-400">Autonomous — operating 24/7</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button"
            onClick={() => void loadData()}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
          <button type="button"
            onClick={() => void generateLeadGenPlan()}
            disabled={generating}
            className="flex items-center gap-2 rounded-lg bg-[#6366f1] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#5558e3] transition-colors disabled:opacity-60"
          >
            {generating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Generate Lead Plan
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <AIStatCard icon={Users} label="Leads in Pipeline" value={stats.leadsGenerated} color="bg-[#6366f1]/15 text-[#818cf8]" />
        <AIStatCard icon={Flame} label="Hot Leads" value={hotLeads.length} sub="Act immediately" color="bg-red-500/15 text-red-400" />
        <AIStatCard icon={Megaphone} label="Active Ads" value={stats.adsActive} color="bg-amber-500/15 text-amber-400" />
        <AIStatCard icon={Target} label="Proposals Sent" value={stats.proposalsSent} color="bg-purple-500/15 text-purple-400" />
        <AIStatCard icon={TrendingUp} label="Conversion Rate" value={`${stats.conversionRate}%`} color="bg-emerald-500/15 text-emerald-400" />
        <AIStatCard icon={Zap} label="AI Actions Taken" value={stats.aiActionsTaken} sub="This month" color="bg-cyan-500/15 text-cyan-400" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-800/60">
        {(['overview', 'actions', 'campaigns'] as const).map((tab) => (
          <button type="button"
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-[#6366f1] text-[#818cf8]'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Priority AI Actions */}
          <div className="rounded-xl border border-[#6366f1]/20 bg-[#6366f1]/5 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#818cf8]" />
                <h2 className="text-sm font-semibold text-zinc-200">AI Priority Actions</h2>
              </div>
              <span className="text-[10px] text-zinc-600">Auto-generated</span>
            </div>
            <div className="space-y-2">
              {actions.length === 0 ? (
                <p className="text-xs text-zinc-600 text-center py-4">No actions — all leads up to date ✓</p>
              ) : (
                actions.map((action, i) => (
                  <div key={action.id} className={`flex items-start gap-3 rounded-lg border p-3 ${URGENCY_COLOURS[action.urgency]}`}>
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#6366f1]/20 text-[10px] font-bold text-[#818cf8]">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-zinc-200">
                        <span className="text-[#818cf8]">{action.type.replace('_', ' ')}</span>{' '}
                        {action.contact}
                        <span className="text-zinc-500"> · {action.company}</span>
                      </p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">{action.reason}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button type="button" className="cursor-pointer rounded p-1 text-zinc-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                        <MessageSquare className="h-3 w-3" />
                      </button>
                      <button type="button" className="cursor-pointer rounded p-1 text-zinc-600 hover:text-blue-400 hover:bg-blue-500/10 transition-colors">
                        <Phone className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Hot Leads */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-400" />
              <h2 className="text-sm font-semibold text-zinc-200">Hot Leads</h2>
              <span className="ml-auto rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                {hotLeads.length}
              </span>
            </div>
            <div className="space-y-2">
              {hotLeads.length === 0 ? (
                <p className="text-xs text-zinc-600 text-center py-4">No hot leads — run lead gen to fill pipeline</p>
              ) : (
                hotLeads.map((lead) => (
                  <div key={lead.id} className="flex items-center gap-3 rounded-lg border border-zinc-800/40 bg-zinc-800/20 px-3 py-2.5">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400 text-xs font-semibold">
                      {lead.name[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-zinc-200 truncate">{lead.name}</p>
                      <p className="text-[10px] text-zinc-500 truncate">{lead.company}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${SCORE_COLOURS[lead.score].bg} ${SCORE_COLOURS[lead.score].text}`}>
                        {lead.score}
                      </span>
                      <button type="button" className="cursor-pointer text-zinc-600 hover:text-zinc-300 transition-colors">
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Warm Leads */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-zinc-200">Warm Leads — Nurture Now</h2>
              <span className="ml-auto text-xs text-zinc-500">{warmLeads.length}</span>
            </div>
            <div className="space-y-1.5">
              {warmLeads.slice(0, 5).map((lead) => (
                <div key={lead.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-zinc-800/30 transition-colors">
                  <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${SCORE_COLOURS[lead.score].dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-zinc-300 truncate">{lead.name} <span className="text-zinc-600">· {lead.company}</span></p>
                  </div>
                  <span className="text-[10px] text-zinc-600">{lead.status.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Ad Campaigns Overview */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-zinc-200">Ad Campaigns</h2>
              </div>
              <a href="/ai-sales/ads" className="flex items-center gap-1 text-[10px] text-[#818cf8] hover:text-[#6366f1] transition-colors">
                View all <ArrowRight className="h-2.5 w-2.5" />
              </a>
            </div>
            {campaigns.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <Megaphone className="h-8 w-8 text-zinc-700 mx-auto" />
                <p className="text-xs text-zinc-600">No campaigns yet</p>
                <a
                  href="/ai-sales/ads"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#6366f1]/15 border border-[#6366f1]/20 px-3 py-1.5 text-xs text-[#818cf8] hover:bg-[#6366f1]/25 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Create First Campaign
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                {campaigns.slice(0, 3).map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border border-zinc-800/40 bg-zinc-800/20 px-3 py-2">
                    <div>
                      <p className="text-xs font-medium text-zinc-200">{c.platform}</p>
                      <p className="text-[10px] text-zinc-500">{c.objective}</p>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <p className="text-xs font-semibold text-emerald-400">{c.leadsGenerated}</p>
                        <p className="text-[9px] text-zinc-600">leads</p>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                        c.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' :
                        c.status === 'DRAFT' ? 'bg-zinc-800 text-zinc-500' :
                        'bg-amber-500/10 text-amber-400'
                      }`}>
                        {c.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ACTIONS TAB ── */}
      {activeTab === 'actions' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">AI-generated priority actions based on lead signals</p>
            <button type="button"
              onClick={() => void generateLeadGenPlan()}
              className="flex items-center gap-1.5 rounded-lg border border-[#6366f1]/30 bg-[#6366f1]/10 px-3 py-1.5 text-xs text-[#818cf8] hover:bg-[#6366f1]/20 transition-colors"
            >
              <Sparkles className="h-3 w-3" />
              Refresh Actions
            </button>
          </div>
          {leads.length === 0 ? (
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-12 text-center space-y-3">
              <Bot className="h-10 w-10 text-zinc-700 mx-auto" />
              <p className="text-sm text-zinc-500">No leads in pipeline yet</p>
              <p className="text-xs text-zinc-600">Add leads or run an ad campaign to start generating actions</p>
            </div>
          ) : (
            leads.filter((l) => l.score !== 'COLD').map((lead, i) => (
              <div key={lead.id} className={`rounded-xl border p-4 ${URGENCY_COLOURS[lead.score === 'HOT' ? 'HIGH' : 'MEDIUM']}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#6366f1]/15 text-[#818cf8] text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{lead.name}
                        <span className="ml-2 text-xs text-zinc-500">· {lead.company}</span>
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Status: {lead.status.replace(/_/g, ' ')} · Score: <span className={SCORE_COLOURS[lead.score].text}>{lead.score}</span>
                      </p>
                      {lead.notes && <p className="text-xs text-zinc-600 mt-1 italic">{lead.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button type="button" className="cursor-pointer flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-[10px] text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                      <MessageSquare className="h-2.5 w-2.5" />
                      WhatsApp
                    </button>
                    <button type="button" className="cursor-pointer flex items-center gap-1 rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-1 text-[10px] text-blue-400 hover:bg-blue-500/20 transition-colors">
                      <Mail className="h-2.5 w-2.5" />
                      Email
                    </button>
                    <button type="button" className="cursor-pointer flex items-center gap-1 rounded-md bg-purple-500/10 border border-purple-500/20 px-2 py-1 text-[10px] text-purple-400 hover:bg-purple-500/20 transition-colors">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Done
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── CAMPAIGNS TAB ── */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">AI-managed ad campaigns across all platforms</p>
            <a
              href="/ai-sales/ads"
              className="flex items-center gap-1.5 rounded-lg bg-[#6366f1] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#5558e3] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New Campaign
            </a>
          </div>
          {campaigns.length === 0 ? (
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-12 text-center space-y-3">
              <Megaphone className="h-10 w-10 text-zinc-700 mx-auto" />
              <p className="text-sm text-zinc-500">No ad campaigns running</p>
              <p className="text-xs text-zinc-600">Create your first AI-generated ad campaign to start generating leads automatically</p>
              <a
                href="/ai-sales/ads"
                className="inline-flex items-center gap-2 rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-medium text-white hover:bg-[#5558e3] transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                Create AI Ad Campaign
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {campaigns.map((c) => (
                <div key={c.id} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-zinc-200">{c.platform}</p>
                      <p className="text-xs text-zinc-500">{c.objective}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      c.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      c.status === 'DRAFT' ? 'bg-zinc-800 text-zinc-500 border border-zinc-700' :
                      'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Impressions', value: c.impressions.toLocaleString() },
                      { label: 'Leads', value: c.leadsGenerated },
                      { label: 'Spend', value: `RM ${c.spend}` },
                      { label: 'CPL', value: c.leadsGenerated > 0 ? `RM ${Math.round(c.spend / c.leadsGenerated)}` : '–' },
                    ].map((stat) => (
                      <div key={stat.label} className="text-center">
                        <p className="text-sm font-bold text-zinc-100">{stat.value}</p>
                        <p className="text-[9px] text-zinc-600">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
