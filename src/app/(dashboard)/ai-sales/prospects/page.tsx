'use client'

import { useEffect, useState } from 'react'
import { MessageSquare, Sparkles, RefreshCw, Send, Bot, User, ChevronDown } from 'lucide-react'

interface Lead {
  id: string
  name: string
  company: string
  email: string
  score: 'HOT' | 'WARM' | 'COLD'
  status: string
}

interface ConversationScript {
  stage: string
  openingMessage: string
  followUpMessages: string[]
  objectionHandlers: Array<{ objection: string; response: string }>
  closingMessage: string
}

const STAGES = ['AWARENESS', 'INTEREST', 'CONSIDERATION', 'DECISION']
const CHANNELS = ['WHATSAPP', 'EMAIL', 'INSTAGRAM_DM']

export default function ProspectChatPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [stage, setStage] = useState('INTEREST')
  const [channel, setChannel] = useState('WHATSAPP')
  const [context, setContext] = useState('')
  const [script, setScript] = useState<ConversationScript | null>(null)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetch('/api/crm/leads')
      .then(async (r) => r.ok ? (await r.json() as { data: Lead[] }).data ?? [] : [])
      .then((data) => { setLeads(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function generateScript() {
    if (!selectedLead) return
    setGenerating(true)
    setScript(null)
    try {
      const res = await fetch('/api/ai/sales-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DRAFT_PROSPECT_CONVERSATION',
          leadName: selectedLead.name,
          company: selectedLead.company,
          stage,
          channel,
          context: context || `Lead score: ${selectedLead.score}. Current status: ${selectedLead.status}`,
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as { data: ConversationScript }
        setScript(data.data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setGenerating(false)
    }
  }

  const SCORE_COLOURS: Record<string, string> = {
    HOT: 'text-red-400 bg-red-500/10',
    WARM: 'text-amber-400 bg-amber-500/10',
    COLD: 'text-blue-400 bg-blue-500/10',
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Prospect Chat Automation</h1>
        <p className="text-sm text-zinc-500 mt-0.5">AI-drafted conversation scripts for every stage of the sales process</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Lead Selector */}
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-200">Select Lead</h2>
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {leads.length === 0 ? (
                <p className="text-xs text-zinc-600 text-center py-4">No leads found</p>
              ) : (
                leads.map((lead) => (
                  <button type="button"
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${
                      selectedLead?.id === lead.id
                        ? 'bg-[#6366f1]/15 border border-[#6366f1]/30'
                        : 'hover:bg-zinc-800/40 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-zinc-200 truncate">{lead.name}</p>
                        <p className="text-[10px] text-zinc-500 truncate">{lead.company}</p>
                      </div>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${SCORE_COLOURS[lead.score]}`}>
                        {lead.score}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Script Generator */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-zinc-200">Script Settings</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Conversation Stage</label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 outline-none"
                >
                  {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Channel</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 outline-none"
                >
                  {CHANNELS.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Additional Context (optional)</label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={2}
                placeholder="e.g. They asked about pricing last week, interested in logo design..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#6366f1]/50 resize-none"
              />
            </div>
            <button type="button"
              onClick={() => void generateScript()}
              disabled={!selectedLead || generating}
              className="flex items-center gap-2 rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-medium text-white hover:bg-[#5558e3] transition-colors disabled:opacity-50"
            >
              {generating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {generating ? 'Generating Script…' : selectedLead ? `Generate Script for ${selectedLead.name}` : 'Select a lead first'}
            </button>
          </div>

          {/* Script Output */}
          {script && (
            <div className="rounded-xl border border-[#6366f1]/20 bg-[#6366f1]/5 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-[#818cf8]" />
                <h3 className="text-sm font-semibold text-zinc-200">AI Conversation Script</h3>
                <span className="ml-auto text-[10px] text-zinc-600">{stage} · {channel}</span>
              </div>

              {/* Opening */}
              <div className="space-y-2">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Opening Message</p>
                <div className="flex items-start gap-2">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#6366f1]/20">
                    <Bot className="h-3 w-3 text-[#818cf8]" />
                  </div>
                  <div className="flex-1 rounded-xl rounded-tl-sm bg-[#6366f1]/10 border border-[#6366f1]/20 px-3 py-2">
                    <p className="text-sm text-zinc-200">{script.openingMessage}</p>
                  </div>
                </div>
              </div>

              {/* Follow-ups */}
              <div className="space-y-2">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Follow-up Sequence</p>
                {script.followUpMessages.map((msg, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-zinc-800">
                      <span className="text-[9px] text-zinc-500 font-bold">{i + 1}</span>
                    </div>
                    <div className="flex-1 rounded-xl rounded-tl-sm bg-zinc-800/60 border border-zinc-700/40 px-3 py-2">
                      <p className="text-sm text-zinc-300">{msg}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Objection Handlers */}
              {script.objectionHandlers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Objection Handlers</p>
                  {script.objectionHandlers.map((oh, i) => (
                    <div key={i} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-1">
                      <p className="text-xs font-semibold text-amber-400">Objection: "{oh.objection}"</p>
                      <p className="text-xs text-zinc-300">Response: {oh.response}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Closing */}
              <div className="space-y-2">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Closing Message</p>
                <div className="flex items-start gap-2">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                    <Send className="h-3 w-3 text-emerald-400" />
                  </div>
                  <div className="flex-1 rounded-xl rounded-tl-sm bg-emerald-500/5 border border-emerald-500/20 px-3 py-2">
                    <p className="text-sm text-zinc-200">{script.closingMessage}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
