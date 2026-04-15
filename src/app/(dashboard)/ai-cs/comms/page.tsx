'use client'

import { useEffect, useState } from 'react'
import { MessageSquare, Sparkles, RefreshCw, Send, Copy, Check, FileText, Receipt, Bell, AlertTriangle } from 'lucide-react'

interface Project {
  id: string
  code: string
  status: string
  deadline: string | null
  client: { companyName: string; contactPerson: string } | null
  deliverableItems?: Array<{ status: string }>
}

type CommType = 'CLIENT_UPDATE' | 'INVOICE_FOLLOWUP' | 'FEEDBACK_RESPONSE' | 'CHECK_IN'

interface DraftedComm {
  type: CommType
  subject: string
  message: string
  clientName: string
  projectCode: string
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button type="button"
      onClick={() => { void navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] border border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors"
    >
      {copied ? <><Check className="h-2.5 w-2.5 text-emerald-400" />Copied</> : <><Copy className="h-2.5 w-2.5" />Copy</>}
    </button>
  )
}

export default function ClientCommsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [commType, setCommType] = useState<CommType>('CLIENT_UPDATE')
  const [extraContext, setExtraContext] = useState('')
  const [invoiceAmount, setInvoiceAmount] = useState('RM 5,000')
  const [daysOverdue, setDaysOverdue] = useState('7')
  const [clientFeedback, setClientFeedback] = useState('')
  const [drafts, setDrafts] = useState<DraftedComm[]>([])
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetch('/api/projects')
      .then(async (r) => r.ok ? (await r.json() as { data: Project[] }).data ?? [] : [])
      .then((data) => { setProjects(data.filter((p) => ['ONGOING', 'PROJECTED', 'COMPLETED'].includes(p.status))); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function generateDraft() {
    if (!selectedProject) return
    setGenerating(true)
    try {
      const payload: Record<string, unknown> = {
        action: `DRAFT_${commType}`,
        clientName: selectedProject.client?.companyName ?? 'Client',
        projectCode: selectedProject.code,
        currentStatus: selectedProject.status,
        deadline: selectedProject.deadline ?? 'TBD',
        extraContext,
      }
      if (commType === 'INVOICE_FOLLOWUP') {
        payload.invoiceAmount = invoiceAmount
        payload.daysOverdue = parseInt(daysOverdue)
      }
      if (commType === 'FEEDBACK_RESPONSE') {
        payload.feedback = clientFeedback
      }

      const res = await fetch('/api/ai/cs-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const data = (await res.json()) as { data: { subject: string; message: string } }
        setDrafts((prev) => [{
          type: commType,
          subject: data.data.subject,
          message: data.data.message,
          clientName: selectedProject.client?.companyName ?? 'Client',
          projectCode: selectedProject.code,
        }, ...prev])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setGenerating(false)
    }
  }

  const COMM_TYPES: { value: CommType; label: string; icon: React.ElementType; desc: string }[] = [
    { value: 'CLIENT_UPDATE', label: 'Project Update', icon: FileText, desc: 'Progress report to client' },
    { value: 'INVOICE_FOLLOWUP', label: 'Invoice Follow-up', icon: Receipt, desc: 'Payment reminder' },
    { value: 'FEEDBACK_RESPONSE', label: 'Feedback Response', icon: MessageSquare, desc: 'Reply to client feedback' },
    { value: 'CHECK_IN', label: 'Check-In Message', icon: Bell, desc: 'Relationship maintenance' },
  ]

  const TYPE_COLOURS: Record<CommType, string> = {
    CLIENT_UPDATE: 'text-[#818cf8] bg-[#6366f1]/10 border-[#6366f1]/30',
    INVOICE_FOLLOWUP: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    FEEDBACK_RESPONSE: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    CHECK_IN: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Client Communications</h1>
        <p className="text-sm text-zinc-500 mt-0.5">AI-drafted messages for every client touchpoint</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: Selector */}
        <div className="space-y-4">
          {/* Project Selector */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-2">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Select Project</h2>
            {loading ? (
              <div className="flex justify-center py-3"><div className="h-5 w-5 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" /></div>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {projects.length === 0 ? (
                  <div className="text-center py-4 space-y-2">
                    <p className="text-xs text-zinc-500 font-medium">No active projects yet</p>
                    <p className="text-[11px] text-zinc-600">
                      First{' '}
                      <a href="/crm" className="text-indigo-400 hover:underline">add a client</a>
                      , then{' '}
                      <a href="/admin/projects" className="text-indigo-400 hover:underline">create a project</a>.
                    </p>
                  </div>
                ) : (
                  projects.map((p) => (
                    <button type="button"
                      key={p.id}
                      onClick={() => setSelectedProject(p)}
                      className={`w-full text-left rounded-lg px-3 py-2 transition-colors ${
                        selectedProject?.id === p.id ? 'bg-[#6366f1]/15 border border-[#6366f1]/30' : 'hover:bg-zinc-800/40 border border-transparent'
                      }`}
                    >
                      <p className="text-xs font-medium text-zinc-200 truncate">{p.client?.companyName ?? 'Unassigned'}</p>
                      <p className="text-[10px] text-zinc-500">{p.code} · {p.status}</p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Comm Type */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-2">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Message Type</h2>
            <div className="space-y-1.5">
              {COMM_TYPES.map(({ value, label, icon: Icon, desc }) => (
                <button type="button"
                  key={value}
                  onClick={() => setCommType(value)}
                  className={`w-full text-left flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors ${
                    commType === value ? 'bg-[#6366f1]/15 border border-[#6366f1]/30' : 'hover:bg-zinc-800/40 border border-transparent'
                  }`}
                >
                  <Icon className={`h-4 w-4 flex-shrink-0 ${commType === value ? 'text-[#818cf8]' : 'text-zinc-600'}`} />
                  <div>
                    <p className="text-xs font-medium text-zinc-200">{label}</p>
                    <p className="text-[9px] text-zinc-600">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Draft Generator */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-200">Draft Settings</h2>

            {commType === 'INVOICE_FOLLOWUP' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Invoice Amount</label>
                  <input
                    value={invoiceAmount}
                    onChange={(e) => setInvoiceAmount(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#6366f1]/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Days Overdue</label>
                  <input
                    type="number"
                    value={daysOverdue}
                    onChange={(e) => setDaysOverdue(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#6366f1]/50"
                  />
                </div>
              </div>
            )}

            {commType === 'FEEDBACK_RESPONSE' && (
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Client Feedback to Respond To</label>
                <textarea
                  value={clientFeedback}
                  onChange={(e) => setClientFeedback(e.target.value)}
                  rows={3}
                  placeholder="Paste the client's feedback here..."
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#6366f1]/50 resize-none"
                />
              </div>
            )}

            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Additional Context (optional)</label>
              <textarea
                value={extraContext}
                onChange={(e) => setExtraContext(e.target.value)}
                rows={2}
                placeholder="e.g. First revision delivered, awaiting feedback..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#6366f1]/50 resize-none"
              />
            </div>

            <button type="button"
              onClick={() => void generateDraft()}
              disabled={!selectedProject || generating}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {generating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {generating ? 'Drafting…' : selectedProject ? `Draft ${commType.replace(/_/g, ' ')} for ${selectedProject.client?.companyName ?? 'Client'}` : 'Select a project first'}
            </button>
          </div>

          {/* Drafts History */}
          {drafts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-zinc-400">Drafted Communications</h3>
              {drafts.map((draft, i) => (
                <div key={i} className={`rounded-xl border p-4 space-y-3 ${TYPE_COLOURS[draft.type]}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-zinc-200">{draft.subject}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{draft.clientName} · {draft.projectCode} · {draft.type.replace(/_/g, ' ')}</p>
                    </div>
                    <CopyButton text={`Subject: ${draft.subject}\n\n${draft.message}`} />
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed bg-zinc-900/40 rounded-lg p-3 whitespace-pre-wrap">{draft.message}</p>
                  <div className="flex items-center gap-2 pt-1">
                    <button type="button" className="cursor-pointer flex items-center gap-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/25 transition-colors">
                      <Send className="h-3 w-3" />
                      Send via WhatsApp
                    </button>
                    <button type="button" className="cursor-pointer flex items-center gap-1.5 rounded-md bg-blue-500/15 border border-blue-500/30 px-3 py-1.5 text-xs text-blue-400 hover:bg-blue-500/25 transition-colors">
                      <Send className="h-3 w-3" />
                      Send via Email
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
