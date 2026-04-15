'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Send,
  Sparkles,
  ChevronDown,
  MessageCircle,
  Circle,
  ExternalLink,
  Loader2,
  Phone,
} from 'lucide-react'

type ContactStatus = 'active' | 'needs_reply' | 'at_risk'
type FilterTab = 'all' | 'hot' | 'clients' | 'followups'

interface Message {
  id: string
  content: string
  sender: 'us' | 'them'
  timestamp: string
  status: 'sent' | 'delivered' | 'read'
}

interface Conversation {
  id: string
  contactName: string
  phone: string
  lastMessage: string
  lastMessageTime: string
  status: ContactStatus
  unread: number
  leadScore?: 'HOT' | 'WARM' | 'COLD'
  clientId?: string
  category: FilterTab
  messages: Message[]
}

const TEMPLATES = [
  { id: 't1', label: 'Follow-up', content: 'Hi {name}, just checking in! Have you had a chance to review our proposal?' },
  { id: 't2', label: 'Reminder', content: 'Hi {name}, friendly reminder that your project is due this Friday. Let us know if you need anything!' },
  { id: 't3', label: 'Upsell', content: 'Hi {name}, loved working on your recent project! We have a new campaign package that might interest you — shall I share the details?' },
]

const STATUS_CONFIG: Record<ContactStatus, { color: string; label: string; dot: string }> = {
  active: { color: 'text-emerald-400', label: 'Active', dot: 'bg-emerald-400' },
  needs_reply: { color: 'text-amber-400', label: 'Needs reply', dot: 'bg-amber-400' },
  at_risk: { color: 'text-red-400', label: 'At risk', dot: 'bg-red-400' },
}

const LEAD_SCORE_COLORS: Record<string, string> = {
  HOT: 'text-red-400 bg-red-500/10 border-red-500/20',
  WARM: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  COLD: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
}

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'hot', label: 'Hot Leads' },
  { key: 'clients', label: 'Clients' },
  { key: 'followups', label: 'Follow-ups' },
]

export default function WhatsAppInboxPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string>('')
  const [convLoading, setConvLoading] = useState(false)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [draftingAI, setDraftingAI] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  // Load real conversations from DB
  useEffect(() => {
    if (status !== 'authenticated') return
    setConvLoading(true)
    fetch('/api/whatsapp/conversations')
      .then(r => r.ok ? r.json() : null)
      .then((json: { data: Array<{ id: string; phone: string; name: string | null; lastMessage: string | null; lastAt: string; unread: number }> } | null) => {
        if (!json) return
        const mapped: Conversation[] = json.data.map(c => ({
          id: c.id,
          contactName: c.name ?? c.phone,
          phone: c.phone,
          lastMessage: c.lastMessage ?? '',
          lastMessageTime: new Date(c.lastAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: (c.unread > 0 ? 'needs_reply' : 'active') as ContactStatus,
          unread: c.unread,
          category: 'all' as FilterTab,
          messages: [],
        }))
        setConversations(mapped)
        if (mapped.length > 0) setActiveConvId(mapped[0].id)
      })
      .catch(() => {})
      .finally(() => setConvLoading(false))
  }, [status])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConvId])

  const filteredConvs = conversations.filter(c => {
    const matchesSearch =
      c.contactName.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
    const matchesFilter = filter === 'all' || c.category === filter
    return matchesSearch && matchesFilter
  })

  const activeConv = conversations.find(c => c.id === activeConvId)

  async function handleSend() {
    if (!message.trim() || !activeConv) return
    setSending(true)
    try {
      await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: activeConv.phone, message }),
      })
      const newMsg: Message = {
        id: `m-${Date.now()}`,
        content: message,
        sender: 'us',
        timestamp: new Date().toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }),
        status: 'sent',
      }
      setConversations(prev => prev.map(c =>
        c.id === activeConvId
          ? { ...c, messages: [...c.messages, newMsg], lastMessage: message, lastMessageTime: 'now', status: 'active' }
          : c
      ))
      setMessage('')
    } catch {
      // silent fail in demo
    } finally {
      setSending(false)
    }
  }

  async function handleAIDraft() {
    if (!activeConv) return
    setDraftingAI(true)
    try {
      const res = await fetch('/api/ai/upsell-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientIndustry: 'General',
          lastProjectType: 'Social Media',
          suggestedService: 'Campaign Package',
          channel: 'WHATSAPP',
        }),
      })
      const json = await res.json() as { data?: { message: string } }
      if (json.data?.message) {
        setMessage(json.data.message)
      }
    } catch {
      setMessage(`Hi ${activeConv.contactName}! We loved working with you. Ready to take your brand to the next level with our new campaign package?`)
    } finally {
      setDraftingAI(false)
    }
  }

  function applyTemplate(content: string) {
    if (!activeConv) return
    setMessage(content.replace('{name}', activeConv.contactName))
    setShowTemplates(false)
  }

  if (status === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-xl border border-zinc-800 bg-[#0d0d14] overflow-hidden">
      {/* Left Panel — Conversation List */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-zinc-800">
        {/* Search */}
        <div className="p-3 border-b border-zinc-800">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search contacts..."
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-[#6366f1] focus:outline-none"
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex border-b border-zinc-800">
          {FILTER_TABS.map(tab => (
            <button type="button"
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex-1 py-2 text-[10px] font-medium transition-colors ${
                filter === tab.key
                  ? 'text-[#818cf8] border-b-2 border-[#6366f1]'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {filteredConvs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <MessageCircle className="h-8 w-8 text-zinc-700 mb-2" />
              <p className="text-xs text-zinc-500">No conversations</p>
            </div>
          ) : (
            filteredConvs.map(conv => {
              const statusCfg = STATUS_CONFIG[conv.status]
              const isActive = conv.id === activeConvId
              return (
                <button type="button"
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={`w-full flex items-start gap-2.5 p-3 text-left transition-colors border-b border-zinc-800/50 ${
                    isActive ? 'bg-[#6366f1]/10 border-l-2 border-l-[#6366f1]' : 'hover:bg-zinc-800/30'
                  }`}
                >
                  <div className="flex-shrink-0 relative mt-0.5">
                    <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-300">
                      {conv.contactName[0]}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[#0d0d14] ${statusCfg.dot}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-zinc-200 truncate">{conv.contactName}</span>
                      <span className="text-[10px] text-zinc-600 flex-shrink-0">{conv.lastMessageTime}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 truncate mt-0.5">{conv.lastMessage}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {conv.leadScore && (
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${LEAD_SCORE_COLORS[conv.leadScore]}`}>
                          {conv.leadScore}
                        </span>
                      )}
                      {conv.unread > 0 && (
                        <span className="ml-auto flex-shrink-0 h-4 w-4 rounded-full bg-[#6366f1] text-[9px] font-bold text-white flex items-center justify-center">
                          {conv.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Right Panel — Active Conversation */}
      {activeConv ? (
        <div className="flex flex-1 flex-col min-w-0">
          {/* Conv Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-semibold text-zinc-300">
                {activeConv.contactName[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-zinc-100">{activeConv.contactName}</h2>
                  {activeConv.leadScore && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${LEAD_SCORE_COLORS[activeConv.leadScore]}`}>
                      {activeConv.leadScore}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3 w-3 text-zinc-600" />
                  <span className="text-xs text-zinc-500">{activeConv.phone}</span>
                  <Circle className={`h-2 w-2 fill-current ${STATUS_CONFIG[activeConv.status].color}`} />
                  <span className={`text-[10px] ${STATUS_CONFIG[activeConv.status].color}`}>
                    {STATUS_CONFIG[activeConv.status].label}
                  </span>
                </div>
              </div>
            </div>
            {activeConv.clientId && (
              <a
                href={`/crm/${activeConv.clientId}`}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                CRM Profile
              </a>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {activeConv.messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'us' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                    msg.sender === 'us'
                      ? 'bg-[#6366f1] text-white rounded-br-sm'
                      : 'bg-zinc-800 text-zinc-200 rounded-bl-sm'
                  }`}
                >
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                  <div className={`flex items-center gap-1 mt-1 ${msg.sender === 'us' ? 'justify-end' : 'justify-start'}`}>
                    <span className={`text-[10px] ${msg.sender === 'us' ? 'text-indigo-200/60' : 'text-zinc-600'}`}>
                      {msg.timestamp}
                    </span>
                    {msg.sender === 'us' && (
                      <span className="text-[10px] text-indigo-200/60">
                        {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Template picker */}
          {showTemplates && (
            <div className="border-t border-zinc-800 bg-zinc-900 px-4 py-3 space-y-2">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Templates</p>
              {TEMPLATES.map(t => (
                <button type="button"
                  key={t.id}
                  onClick={() => applyTemplate(t.content)}
                  className="w-full flex items-start gap-3 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-left hover:border-zinc-600 transition-colors"
                >
                  <div>
                    <p className="text-xs font-semibold text-zinc-300">{t.label}</p>
                    <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{t.content}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="border-t border-zinc-800 p-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  placeholder="Type a message..."
                  rows={2}
                  className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-[#6366f1] focus:outline-none focus:ring-1 focus:ring-[#6366f1]/50"
                />
              </div>
              <div className="flex flex-col gap-2">
                <button type="button"
                  onClick={handleAIDraft}
                  disabled={draftingAI}
                  title="AI Draft"
                  className="cursor-pointer flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 hover:text-[#818cf8] hover:border-[#6366f1]/50 transition-colors disabled:opacity-50"
                >
                  {draftingAI ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  AI Draft
                </button>
                <button type="button"
                  onClick={() => setShowTemplates(prev => !prev)}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                >
                  Templates
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
              <button type="button"
                onClick={handleSend}
                disabled={!message.trim() || sending}
                className="cursor-pointer flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-[#6366f1] text-white hover:bg-[#5558e3] disabled:opacity-40 transition-colors"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <MessageCircle className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500">Select a conversation</p>
          </div>
        </div>
      )}
    </div>
  )
}
