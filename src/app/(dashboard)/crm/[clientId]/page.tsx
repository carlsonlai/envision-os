'use client'

import { useEffect, useState } from 'react'
import { use } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  ArrowLeft,
  AlertTriangle,
  MessageSquare,
  TrendingUp,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react'
import { ClientTier, TIER_CONFIG } from '@/components/ui/TierBadge'

interface ClientProfile {
  id: string
  companyName: string
  contactPerson: string
  email: string
  phone: string | null
  tier: ClientTier
  ltv: number
  createdAt: string
  projects: Array<{
    id: string
    code: string
    status: string
    quotedAmount: number
    billedAmount: number
    paidAmount: number
    createdAt: string
    deadline: string | null
  }>
}

interface ChurnRisk {
  risk: 'HIGH' | 'MEDIUM' | 'LOW'
  signals: string[]
  daysSinceLastContact: number
}

const RISK_CONFIG = {
  HIGH: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
  MEDIUM: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  LOW: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PROJECTED: 'text-zinc-400 bg-zinc-800 border-zinc-700',
    ONGOING: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    COMPLETED: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    BILLED: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    PAID: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${colors[status] ?? 'text-zinc-400 bg-zinc-800 border-zinc-700'}`}>
      {status}
    </span>
  )
}

export default function ClientProfilePage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = use(params)
  const { data: session } = useSession()
  const [client, setClient] = useState<ClientProfile | null>(null)
  const [churnRisk, setChurnRisk] = useState<ChurnRisk | null>(null)
  const [referralLink, setReferralLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [upsellMessage, setUpsellMessage] = useState('')
  const [loadingUpsell, setLoadingUpsell] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        // Load projects to get client info
        const projectsRes = await fetch('/api/projects')
        if (!projectsRes.ok) throw new Error('Failed to load projects')
        const projectsData = (await projectsRes.json()) as {
          data: Array<{ client?: ClientProfile; clientId?: string; code: string; status: string; quotedAmount: number; billedAmount: number; paidAmount: number; createdAt: string; deadline: string | null; id: string }>
        }

        // Find client from projects
        let foundClient: ClientProfile | null = null
        const clientProjects: ClientProfile['projects'] = []

        for (const p of projectsData.data) {
          if (p.client?.id === clientId) {
            if (!foundClient) foundClient = p.client
            clientProjects.push({
              id: p.id,
              code: p.code,
              status: p.status,
              quotedAmount: p.quotedAmount,
              billedAmount: p.billedAmount,
              paidAmount: p.paidAmount,
              createdAt: p.createdAt,
              deadline: p.deadline,
            })
          }
        }

        if (foundClient) {
          setClient({ ...foundClient, projects: clientProjects })
        }

        // Load churn risk in parallel
        const [churnRes, referralRes] = await Promise.all([
          fetch(`/api/crm/clients/${clientId}/churn`),
          fetch(`/api/referral/${encodeURIComponent(btoa(clientId).slice(0, 12))}`),
        ])

        if (churnRes.ok) {
          const churnData = (await churnRes.json()) as { data: ChurnRisk }
          setChurnRisk(churnData.data)
        }

        const appUrl = window.location.origin
        setReferralLink(`${appUrl}/ref/${btoa(clientId).slice(0, 12)}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load client')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [clientId])

  async function generateUpsell() {
    if (!client) return
    setLoadingUpsell(true)
    try {
      const res = await fetch('/api/ai/upsell-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientIndustry: 'general',
          lastProjectType: client.projects[0]?.code ?? 'branding',
          suggestedService: 'social media package',
          channel: 'WHATSAPP',
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as { data: { message: string } }
        setUpsellMessage(data.data.message)
      }
    } catch (err) {
      console.error('Upsell draft error:', err)
    } finally {
      setLoadingUpsell(false)
    }
  }

  async function copyReferral() {
    await navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 text-sm">{error || 'Client not found'}</p>
        <Link href="/crm" className="text-[#818cf8] text-sm mt-2 inline-block hover:underline">
          Back to CRM
        </Link>
      </div>
    )
  }

  const tierConfig = TIER_CONFIG[client.tier]
  const TierIcon = tierConfig.icon
  const totalBilled = client.projects.reduce((s, p) => s + p.billedAmount, 0)
  const totalPaid = client.projects.reduce((s, p) => s + p.paidAmount, 0)
  const outstanding = totalBilled - totalPaid

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/crm" className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mt-0.5">
          <ArrowLeft className="h-3.5 w-3.5" />
          CRM
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-zinc-100">{client.companyName}</h1>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tierConfig.color} ${tierConfig.bg}`}>
              <TierIcon className="h-2.5 w-2.5" />
              {tierConfig.label}
            </span>
          </div>
          <p className="text-sm text-zinc-500 mt-0.5">{client.contactPerson} · {client.email}{client.phone ? ` · ${client.phone}` : ''}</p>
        </div>
      </div>

      {/* Churn Risk Alert */}
      {churnRisk && churnRisk.risk === 'HIGH' && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-300">High Churn Risk</p>
            <ul className="mt-1 space-y-0.5">
              {churnRisk.signals.map((s, i) => (
                <li key={i} className="text-xs text-red-400/80">• {s}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: Billing summary */}
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Billing</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-zinc-500">LTV</span>
                <span className="text-sm font-bold text-[#818cf8]">RM {client.ltv.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-zinc-500">Total Billed</span>
                <span className="text-sm text-zinc-300">RM {totalBilled.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-zinc-500">Total Paid</span>
                <span className="text-sm text-emerald-400">RM {totalPaid.toLocaleString()}</span>
              </div>
              {outstanding > 0 && (
                <div className="flex justify-between">
                  <span className="text-xs text-zinc-500">Outstanding</span>
                  <span className="text-sm text-red-400 font-semibold">RM {outstanding.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Referral Link */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Referral Link</h2>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-400 font-mono">
                {referralLink}
              </code>
              <button type="button" onClick={copyReferral} className="cursor-pointer flex-shrink-0 rounded-md p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Churn risk detail */}
          {churnRisk && (
            <div className={`rounded-xl border p-4 ${RISK_CONFIG[churnRisk.risk].bg}`}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Churn Risk</h2>
                <span className={`text-xs font-bold ${RISK_CONFIG[churnRisk.risk].color}`}>{churnRisk.risk}</span>
              </div>
              <p className="text-xs text-zinc-500">Last contact: {churnRisk.daysSinceLastContact === 999 ? 'Never' : `${churnRisk.daysSinceLastContact}d ago`}</p>
            </div>
          )}
        </div>

        {/* Right: Projects + Upsell */}
        <div className="lg:col-span-2 space-y-4">
          {/* Upsell Opportunities */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#818cf8]" />
                <h2 className="text-sm font-semibold text-zinc-200">Upsell Opportunity</h2>
              </div>
              <button type="button"
                onClick={generateUpsell}
                disabled={loadingUpsell}
                className="cursor-pointer text-xs rounded-lg bg-[#6366f1]/15 text-[#818cf8] px-2.5 py-1 hover:bg-[#6366f1]/25 transition-colors disabled:opacity-50"
              >
                {loadingUpsell ? 'Generating...' : 'AI Draft'}
              </button>
            </div>
            {upsellMessage ? (
              <div className="rounded-lg border border-[#6366f1]/20 bg-[#6366f1]/5 p-3">
                <p className="text-sm text-zinc-300">{upsellMessage}</p>
                <div className="flex gap-2 mt-3">
                  <button type="button" className="cursor-pointer text-xs rounded-lg bg-emerald-500/15 text-emerald-400 px-2.5 py-1 hover:bg-emerald-500/25 transition-colors flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    Send via WhatsApp
                  </button>
                  <button type="button"
                    onClick={() => navigator.clipboard.writeText(upsellMessage)}
                    className="text-xs rounded-lg bg-zinc-700/50 text-zinc-400 px-2.5 py-1 hover:bg-zinc-700 transition-colors flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-600">Click AI Draft to generate a personalised upsell message</p>
            )}
          </div>

          {/* Projects History */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-zinc-200">Projects ({client.projects.length})</h2>
            {client.projects.length === 0 ? (
              <p className="text-sm text-zinc-600 text-center py-4">No projects yet</p>
            ) : (
              <div className="space-y-2">
                {client.projects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-800/40 bg-zinc-800/20 px-4 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium text-zinc-200">{project.code}</p>
                        <p className="text-xs text-zinc-500">
                          {new Date(project.createdAt).toLocaleDateString('en-MY', { dateStyle: 'medium' })}
                          {project.deadline ? ` · Due ${new Date(project.deadline).toLocaleDateString('en-MY', { dateStyle: 'short' })}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs font-semibold text-zinc-300">RM {project.billedAmount.toLocaleString()}</p>
                        <p className="text-[10px] text-zinc-600">Paid: RM {project.paidAmount.toLocaleString()}</p>
                      </div>
                      <StatusBadge status={project.status} />
                      <Link href={`/cs`} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
