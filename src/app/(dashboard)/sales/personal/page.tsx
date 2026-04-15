'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  UserCheck,
  MessageSquare,
  Zap,
  PhoneCall,
  Eye,
  TrendingUp,
  Flame,
  Loader2,
  Send,
  Bot,
  UserCog,
  ArrowRight,
  CheckCircle2,
  Clock,
  Mail,
  Copy,
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

interface AIConversation {
  id: string
  leadName: string
  company: string
  score: LeadScore
  stage: string
  lastMessage: string
  lastSentAt: string
  aiManaged: boolean
  humanTookOver: boolean
  leadId?: string
}

interface DirectMessage {
  id: string
  contactName: string
  company: string
  channel: 'whatsapp' | 'email'
  message: string
  sentAt: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
}

const SCORE_COLOR: Record<LeadScore, string> = {
  HOT: 'text-red-400 bg-red-500/10 border-red-500/30',
  WARM: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  COLD: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
}

const mockDeals: Array<{ name: string; stage: string; value: number; prob: number; aiScore: number; daysIn: number }> = []

type TabType = 'monitor' | 'chat' | 'deals'

export default function PersonalSalesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>('monitor')
  const [conversations, setConversations] = useState<AIConversation[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sentMessages, setSentMessages] = useState<DirectMessage[]>([])
  const [takingOver, setTakingOver] = useState<string | null>(null)
  const [aiDrafting, setAiDrafting] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') router.push('/sales')
  }, [status, session, router])

  const loadLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/crm/pipeline')
      if (res.ok) {
        const data = (await res.json()) as { data: Record<string, Lead[]> }
        const all = Object.values(data.data).flat()
        setLeads(all)
        if (!selectedLead && all.length > 0) setSelectedLead(all[0])
      }
    } catch {
      // API unavailable — conversations will be empty until connection restored
    }
  }, [selectedLead])

  useEffect(() => {
    loadLeads()
  }, [loadLeads])

  // Build AI conversation cards from real CRM leads
  useEffect(() => {
    if (leads.length === 0) return
    const SCORE_MAP: Record<string, AIConversation['score']> = {
      PROPOSAL_SENT: 'HOT', NEGOTIATING: 'HOT', QUALIFIED: 'WARM',
      NEW: 'COLD', CLOSED_WON: 'HOT', CLOSED_LOST: 'COLD',
    }
    const convs: AIConversation[] = leads.slice(0, 8).map(lead => ({
      id: lead.id,
      leadId: lead.id,
      leadName: lead.name,
      company: lead.company,
      score: SCORE_MAP[lead.status] ?? 'WARM',
      stage: lead.status as AIConversation['stage'],
      lastMessage: lead.notes ?? 'No messages yet.',
      lastSentAt: new Date(lead.createdAt).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' }),
      aiManaged: true,
      humanTookOver: false,
    }))
    setConversations(convs)
  }, [leads])

  async function handleTakeOver(convId: string) {
    setTakingOver(convId)
    // Persist takeover state to DB via CRM lead update
    const conv = conversations.find(c => c.id === convId)
    if (conv?.leadId) {
      await fetch(`/api/crm/leads/${conv.leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiManaged: false, humanTookOver: true }),
      }).catch(() => {})
    }
    setConversations(prev =>
      prev.map(c =>
        c.id === convId ? { ...c, humanTookOver: true, aiManaged: false } : c
      )
    )
    setTakingOver(null)
  }

  async function handleHandBackToAI(convId: string) {
    setConversations(prev =>
      prev.map(c =>
        c.id === convId ? { ...c, humanTookOver: false, aiManaged: true } : c
      )
    )
  }

  async function handleAIDraft() {
    if (!selectedLead) return
    setAiDrafting(true)
    try {
      const res = await fetch('/api/ai/sales-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DRAFT_PROSPECT_CONVERSATION',
          leadId: selectedLead.id,
          leadName: selectedLead.name,
          company: selectedLead.company,
          stage: selectedLead.status,
          channel: channel,
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as { data: { openingMessage?: string } }
        if (data.data?.openingMessage) {
          setMessage(data.data.openingMessage)
        }
      }
    } catch {
      setMessage(`Hi ${selectedLead.name}, following up on our earlier conversation about your branding needs at ${selectedLead.company}. Would love to connect this week — does Thursday work for a quick call?`)
    } finally {
      setAiDrafting(false)
    }
  }

  async function handleSend() {
    if (!selectedLead || !message.trim()) return
    setSending(true)
    const body = message.trim()
    let sendOk = false
    try {
      if (channel === 'whatsapp' && selectedLead.phone) {
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: selectedLead.phone, message: body }),
        })
        sendOk = res.ok
      } else if (channel === 'email' && selectedLead.email) {
        // Log outreach email against the lead record
        const res = await fetch('/api/crm/leads/' + selectedLead.id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lastOutreach: body }),
        })
        sendOk = res.ok
      }
    } catch { /* fall through — mark as failed */ }
    const newMsg: DirectMessage = {
      id: Date.now().toString(),
      contactName: selectedLead.name,
      company: selectedLead.company,
      channel,
      message: body,
      sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: sendOk ? 'sent' : 'failed',
    }
    setSentMessages(prev => [newMsg, ...prev])
    setMessage('')
    setSending(false)
  }

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(id)
    setTimeout(() => setCopied(null), 1800)
  }

  const activeAI = conversations.filter(c => c.aiManaged).length
  const takenOver = conversations.filter(c => c.humanTookOver).length
  const hotCount = conversations.filter(c => c.score === 'HOT').length

  if (status === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <UserCog className="h-5 w-5 text-[#818cf8]" />
            My Sales Command
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">Monitor AI activity · Take over anytime · Message clients directly</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-400">
            🟢 You are online
          </span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'AI Managing', value: activeAI, icon: Bot, color: 'text-[#818cf8]', bg: 'bg-[#6366f1]/5 border-[#6366f1]/20' },
          { label: 'Taken Over by You', value: takenOver, icon: UserCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/20' },
          { label: 'Hot Conversations', value: hotCount, icon: Flame, color: 'text-red-400', bg: 'bg-red-500/5 border-red-500/20' },
          { label: 'Pipeline Value', value: 'RM 63k', icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-500/5 border-amber-500/20' },
        ].map(stat => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className={`rounded-xl border ${stat.bg} p-4 flex items-center gap-3`}>
              <Icon className={`h-5 w-5 ${stat.color} flex-shrink-0`} />
              <div>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{stat.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl border border-zinc-800 bg-zinc-900 p-1 w-fit gap-1">
        {(
          [
            { key: 'monitor' as TabType, label: 'AI Monitor', icon: Eye },
            { key: 'chat' as TabType, label: 'Direct Message', icon: MessageSquare },
            { key: 'deals' as TabType, label: 'Deal Intelligence', icon: TrendingUp },
          ] as const
        ).map(tab => {
          const Icon = tab.icon
          return (
            <button type="button"
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                activeTab === tab.key ? 'bg-[#6366f1] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ─── AI MONITOR TAB ────────────────────────────────────────────────── */}
      {activeTab === 'monitor' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Bot className="h-3.5 w-3.5 text-[#818cf8]" />
            <span>AI Sales Agent is running autonomously. Tap <strong className="text-zinc-300">Take Over</strong> to jump in as human.</span>
          </div>

          {conversations.map(conv => (
            <div
              key={conv.id}
              className={`rounded-xl border p-5 space-y-3 transition-all ${
                conv.humanTookOver
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-zinc-800/60 bg-zinc-900/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#6366f1]/15 text-[#818cf8] text-sm font-semibold">
                    {conv.leadName[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-zinc-100">{conv.leadName}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${SCORE_COLOR[conv.score]}`}>
                        {conv.score}
                      </span>
                      {conv.humanTookOver && (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                          👤 You
                        </span>
                      )}
                      {conv.aiManaged && !conv.humanTookOver && (
                        <span className="rounded-full border border-[#6366f1]/30 bg-[#6366f1]/10 px-2 py-0.5 text-[10px] font-semibold text-[#818cf8]">
                          🤖 AI
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500">{conv.company} · {conv.stage.replace(/_/g, ' ')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {conv.aiManaged && !conv.humanTookOver && (
                    <button type="button"
                      onClick={() => handleTakeOver(conv.id)}
                      disabled={takingOver === conv.id}
                      className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-60 transition-colors"
                    >
                      {takingOver === conv.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <UserCheck className="h-3 w-3" />
                      )}
                      Take Over
                    </button>
                  )}
                  {conv.humanTookOver && (
                    <button type="button"
                      onClick={() => handleHandBackToAI(conv.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                    >
                      <Bot className="h-3 w-3" />
                      Hand back to AI
                    </button>
                  )}
                  <button type="button" className="cursor-pointer flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-200 transition-colors">
                    <PhoneCall className="h-3 w-3" />
                    Call
                  </button>
                </div>
              </div>

              {/* Last message */}
              <div className="rounded-lg border border-zinc-800/50 bg-zinc-800/20 px-4 py-2.5 flex items-start gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-zinc-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-300 leading-relaxed">{conv.lastMessage}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {conv.lastSentAt}
                    </span>
                    <button type="button"
                      onClick={() => handleCopy(conv.lastMessage, conv.id)}
                      className="text-[10px] text-zinc-600 hover:text-zinc-400 flex items-center gap-1 transition-colors"
                    >
                      {copied === conv.id ? (
                        <><CheckCircle2 className="h-3 w-3 text-emerald-400" /> Copied</>
                      ) : (
                        <><Copy className="h-3 w-3" /> Copy</>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Takeover — compose area */}
              {conv.humanTookOver && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
                  <p className="text-xs text-emerald-400 font-semibold">You are in control — compose your reply:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={`Reply to ${conv.leadName}...`}
                      className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#6366f1]/50 placeholder:text-zinc-600"
                    />
                    <button type="button" className="cursor-pointer flex items-center gap-1.5 rounded-lg bg-[#6366f1] px-3 py-2 text-xs font-semibold text-white hover:bg-[#5558e3] transition-colors">
                      <Send className="h-3 w-3" />
                      Send
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="cursor-pointer rounded px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-colors">
                      📞 WhatsApp
                    </button>
                    <button type="button" className="cursor-pointer rounded px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-colors">
                      ✉️ Email
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── DIRECT MESSAGE TAB ────────────────────────────────────────────── */}
      {activeTab === 'chat' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Compose panel */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#818cf8]" />
              Personal Outreach
            </h2>

            {/* Contact selector */}
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Lead / Client</label>
              <select
                value={selectedLead?.id ?? ''}
                onChange={e => {
                  const lead = leads.find(l => l.id === e.target.value)
                  setSelectedLead(lead ?? null)
                }}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#6366f1]/50"
              >
                {leads.length === 0 && (
                  <option value="" disabled>No leads yet</option>
                )}
                {leads.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.company})
                  </option>
                ))}
              </select>
            </div>

            {/* Channel */}
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Channel</label>
              <div className="flex gap-2">
                {(['whatsapp', 'email'] as const).map(ch => (
                  <button type="button"
                    key={ch}
                    onClick={() => setChannel(ch)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-all ${
                      channel === ch
                        ? ch === 'whatsapp'
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                          : 'border-[#6366f1]/40 bg-[#6366f1]/10 text-[#818cf8]'
                        : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {ch === 'whatsapp' ? '📱 WhatsApp' : '✉️ Email'}
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-zinc-500">Message</label>
                <button type="button"
                  onClick={handleAIDraft}
                  disabled={aiDrafting}
                  className="cursor-pointer flex items-center gap-1 text-[10px] text-[#818cf8] hover:text-[#a5b4fc] transition-colors disabled:opacity-60"
                >
                  {aiDrafting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                  AI Draft
                </button>
              </div>
              <textarea
                rows={5}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={`Write your message to ${selectedLead?.name ?? 'the lead'}...`}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-[#6366f1]/50 placeholder:text-zinc-600 resize-none"
              />
              <p className="text-[10px] text-zinc-600 mt-1">{message.length} chars</p>
            </div>

            <button type="button"
              onClick={handleSend}
              disabled={sending || !message.trim()}
              className="cursor-pointer w-full flex items-center justify-center gap-2 rounded-lg bg-[#6366f1] py-2.5 text-sm font-medium text-white hover:bg-[#5558e3] disabled:opacity-60 transition-colors"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send {channel === 'whatsapp' ? 'WhatsApp' : 'Email'}
            </button>
          </div>

          {/* Sent messages */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Sent by You
            </h2>
            {sentMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Mail className="h-8 w-8 text-zinc-700 mb-2" />
                <p className="text-sm text-zinc-500">No messages sent yet</p>
                <p className="text-xs text-zinc-600 mt-1">Messages you send personally appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sentMessages.map(msg => (
                  <div key={msg.id} className="rounded-lg border border-zinc-800/50 bg-zinc-800/20 p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <p className="text-xs font-semibold text-zinc-200">{msg.contactName}</p>
                        <p className="text-[10px] text-zinc-500">{msg.company}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                          msg.channel === 'whatsapp'
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                            : 'text-[#818cf8] bg-[#6366f1]/10 border-[#6366f1]/20'
                        }`}>
                          {msg.channel === 'whatsapp' ? '📱' : '✉️'} {msg.channel}
                        </span>
                        <span className="text-[10px] text-zinc-600">{msg.sentAt}</span>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">{msg.message}</p>
                    <div className="flex items-center gap-1 mt-1.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      <span className="text-[10px] text-zinc-600">{msg.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── DEAL INTELLIGENCE TAB ─────────────────────────────────────────── */}
      {activeTab === 'deals' && (
        <div className="space-y-4">
          <div className="text-xs text-zinc-500 flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-[#818cf8]" />
            AI-scored deals with close probability, value, and recommended next action.
          </div>

          {mockDeals.map(deal => {
            const scoreColor =
              deal.aiScore >= 75 ? 'text-emerald-400' :
              deal.aiScore >= 55 ? 'text-amber-400' : 'text-red-400'
            const probColor =
              deal.prob >= 60 ? 'bg-emerald-500' :
              deal.prob >= 40 ? 'bg-amber-500' : 'bg-red-500'

            return (
              <div key={deal.name} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#6366f1]/15 text-[#818cf8] text-sm font-semibold">
                      {deal.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">{deal.name}</p>
                      <p className="text-xs text-zinc-500">{deal.stage} · {deal.daysIn}d in stage</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-zinc-100">RM {deal.value.toLocaleString()}</p>
                    <p className="text-[10px] text-zinc-500">deal value</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  {/* Close probability */}
                  <div className="rounded-lg border border-zinc-800/40 bg-zinc-800/20 p-3">
                    <p className="text-[10px] text-zinc-500 mb-1.5">Close Probability</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div className={`h-full ${probColor} rounded-full`} style={{ width: `${deal.prob}%` }} />
                      </div>
                      <span className="text-xs font-bold text-zinc-200">{deal.prob}%</span>
                    </div>
                  </div>

                  {/* AI score */}
                  <div className="rounded-lg border border-zinc-800/40 bg-zinc-800/20 p-3">
                    <p className="text-[10px] text-zinc-500 mb-1">AI Score</p>
                    <p className={`text-xl font-bold ${scoreColor}`}>{deal.aiScore}</p>
                  </div>

                  {/* Next action */}
                  <div className="rounded-lg border border-[#6366f1]/20 bg-[#6366f1]/5 p-3">
                    <p className="text-[10px] text-zinc-500 mb-1">Recommended Action</p>
                    <p className="text-xs text-[#818cf8] font-medium">
                      {deal.aiScore >= 75 ? '🔥 Close this week' :
                       deal.aiScore >= 55 ? '📞 Follow up call' : '✉️ Nurture email'}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button type="button"
                    onClick={() => {
                      setActiveTab('chat')
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                  >
                    <MessageSquare className="h-3 w-3" />
                    Message
                  </button>
                  <button type="button" className="cursor-pointer flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors">
                    <PhoneCall className="h-3 w-3" />
                    Call
                  </button>
                  <button type="button" className="cursor-pointer ml-auto flex items-center gap-1.5 rounded-lg border border-[#6366f1]/30 bg-[#6366f1]/10 px-3 py-1.5 text-xs text-[#818cf8] hover:bg-[#6366f1]/20 transition-colors">
                    View Full Deal
                    <ArrowRight className="h-3 w-3" />
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
