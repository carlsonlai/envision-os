'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {
  DollarSign,
  Check,
  AlertCircle,
  RefreshCw,
  Search,
  Clock,
  TrendingUp,
  Users,
  ChevronDown,
  Loader2,
  X,
  BadgeDollarSign,
  CircleDollarSign,
} from 'lucide-react'
import { formatCurrency, formatDeadline } from '@/lib/utils'

/* ───────── Types ───────── */

type ProjectStatus = 'PROJECTED' | 'ONGOING' | 'COMPLETED' | 'BILLED' | 'PAID'
type InvoiceStatus = 'PENDING' | 'SENT' | 'PAID' | 'OVERDUE'
type InvoiceType = 'DEPOSIT' | 'BALANCE' | 'EXTRA_REVISION' | 'FULL'

interface Invoice {
  id: string
  bukkuInvoiceId?: string | null
  invoiceNumber?: string | null
  type: InvoiceType
  amount: number
  status: InvoiceStatus
  dueAt: string | null
  paidAt: string | null
}

interface Project {
  id: string
  code: string
  status: ProjectStatus
  quotedAmount: number
  billedAmount: number
  paidAmount: number
  client?: { id: string; companyName: string; contactPerson: string }
  assignedCS?: { id: string; name: string } | null
  csAssignments?: Array<{ user: { id: string; name: string } }>
  invoices?: Invoice[]
  deadline: string | null
  createdAt: string
}

interface SyncResult {
  paymentsFound: number
  invoicesUpdated: number
  projectsUpdated: number
  alreadyPaid: number
  unmatched: number
  errors: string[]
}

interface Toast {
  id: number
  type: 'success' | 'error'
  message: string
}

/* ───────── Helpers ───────── */

const STATUS_LABELS: Record<ProjectStatus, string> = {
  PROJECTED: 'Projected',
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed',
  BILLED: 'Billed',
  PAID: 'Paid',
}

function getStatusBadge(status: ProjectStatus): string {
  switch (status) {
    case 'PROJECTED':  return 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
    case 'ONGOING':    return 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
    case 'COMPLETED':  return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
    case 'BILLED':     return 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
    case 'PAID':       return 'bg-green-500/15 text-green-400 border border-green-500/30'
  }
}

function getInvoiceStatusBadge(status: InvoiceStatus): string {
  switch (status) {
    case 'PENDING':  return 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
    case 'SENT':     return 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
    case 'PAID':     return 'bg-green-500/15 text-green-400 border border-green-500/30'
    case 'OVERDUE':  return 'bg-red-500/15 text-red-400 border border-red-500/30'
  }
}

function getAgingDays(dueDate: string | null): number {
  if (!dueDate) return 0
  const due = new Date(dueDate)
  const now = new Date()
  return Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
}

function getAgingLabel(days: number): string {
  if (days <= 0) return 'Current'
  if (days <= 30) return '1–30 days'
  if (days <= 60) return '31–60 days'
  if (days <= 90) return '61–90 days'
  return '90+ days'
}

function getAgingColor(days: number): string {
  if (days <= 0) return 'text-emerald-400'
  if (days <= 30) return 'text-yellow-400'
  if (days <= 60) return 'text-orange-400'
  return 'text-red-400'
}

function getTeamNames(project: Project): string {
  if (project.csAssignments && project.csAssignments.length > 0) {
    return project.csAssignments.map(a => a.user.name).join(', ')
  }
  if (project.assignedCS?.name) return project.assignedCS.name
  return '—'
}

function collectionRate(paid: number, billed: number): number {
  if (billed <= 0) return 0
  return Math.min(100, (paid / billed) * 100)
}

/* ───────── Component ───────── */

export default function PaymentCollectionPage() {
  useSession()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OUTSTANDING' | 'FULLY_PAID'>('ALL')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const toastCounter = useRef(0)

  function addToast(type: 'success' | 'error', message: string) {
    const id = ++toastCounter.current
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects')
      if (!res.ok) throw new Error()
      const json = await res.json()
      setProjects(json.data ?? [])
    } catch {
      addToast('error', 'Failed to load projects.')
    }
  }, [])

  useEffect(() => {
    fetchProjects().finally(() => setLoading(false))
  }, [fetchProjects])

  async function syncPayments() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/bukku/sync-payments', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Sync failed')
      setSyncResult(json)
      await fetchProjects()
      addToast('success', `Payment sync complete — ${json.invoicesUpdated} invoice(s) updated.`)
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Payment sync failed')
    } finally {
      setSyncing(false)
    }
  }

  /* ── Computed ── */

  // Only include projects that have been billed or have invoices
  const billableProjects = projects.filter(p =>
    p.billedAmount > 0 || p.paidAmount > 0 || (p.invoices && p.invoices.length > 0)
  )

  const totalQuoted  = billableProjects.reduce((s, p) => s + p.quotedAmount, 0)
  const totalBilled  = billableProjects.reduce((s, p) => s + p.billedAmount, 0)
  const totalPaid    = billableProjects.reduce((s, p) => s + p.paidAmount, 0)
  const totalOutstanding = totalBilled - totalPaid

  // Overdue invoices
  const allInvoices = billableProjects.flatMap(p => (p.invoices ?? []).map(inv => ({ ...inv, project: p })))
  const overdueInvoices = allInvoices.filter(inv =>
    inv.status !== 'PAID' && inv.dueAt && new Date(inv.dueAt) < new Date()
  )

  // Aging buckets
  const agingBuckets = { current: 0, '1_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0 }
  for (const inv of overdueInvoices) {
    const days = getAgingDays(inv.dueAt)
    if (days <= 0) agingBuckets.current += inv.amount
    else if (days <= 30) agingBuckets['1_30'] += inv.amount
    else if (days <= 60) agingBuckets['31_60'] += inv.amount
    else if (days <= 90) agingBuckets['61_90'] += inv.amount
    else agingBuckets['90_plus'] += inv.amount
  }

  // Filter
  const filtered = billableProjects.filter(p => {
    if (statusFilter === 'OUTSTANDING' && p.paidAmount >= p.billedAmount && p.billedAmount > 0) return false
    if (statusFilter === 'FULLY_PAID' && p.paidAmount < p.billedAmount) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const inCode = p.code.toLowerCase().includes(q)
      const inClient = (p.client?.companyName ?? '').toLowerCase().includes(q)
      const inTeam = getTeamNames(p).toLowerCase().includes(q)
      if (!inCode && !inClient && !inTeam) return false
    }
    return true
  })

  // Sort: outstanding first, then by amount desc
  const sorted = [...filtered].sort((a, b) => {
    const aOut = a.billedAmount - a.paidAmount
    const bOut = b.billedAmount - b.paidAmount
    if (aOut > 0 && bOut <= 0) return -1
    if (aOut <= 0 && bOut > 0) return 1
    return bOut - aOut
  })

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium shadow-xl ${toast.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300' : 'bg-red-950/90 border-red-500/40 text-red-300'}`}>
            {toast.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {toast.message}
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <BadgeDollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-zinc-100">Payment Collection</h1>
              {!loading && (
                <p className="text-sm text-zinc-500 mt-0.5">
                  {billableProjects.length} billable project{billableProjects.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={syncPayments}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing Bukku…' : 'Sync Payments'}
          </button>
        </div>

        {/* Sync Result Banner */}
        {syncResult && (
          <div className="mb-6 rounded-2xl border border-zinc-700/60 bg-zinc-900/60 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-zinc-200">Sync Results</h2>
              </div>
              <button type="button" onClick={() => setSyncResult(null)}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-4 flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700/60 text-xs">
                <span className="text-zinc-400">Payments found</span>
                <span className="font-bold text-zinc-100">{syncResult.paymentsFound}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
                <span className="text-emerald-300">Invoices updated</span>
                <span className="font-bold text-emerald-200">{syncResult.invoicesUpdated}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs">
                <span className="text-blue-300">Projects updated</span>
                <span className="font-bold text-blue-200">{syncResult.projectsUpdated}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/40 border border-zinc-700/40 text-xs">
                <span className="text-zinc-400">Already paid</span>
                <span className="font-bold text-zinc-300">{syncResult.alreadyPaid}</span>
              </div>
              {syncResult.unmatched > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs">
                  <span className="text-yellow-300">Unmatched</span>
                  <span className="font-bold text-yellow-200">{syncResult.unmatched}</span>
                </div>
              )}
              {syncResult.errors.length > 0 && (
                <div className="w-full mt-2">
                  <p className="text-xs font-semibold text-red-400 mb-1">Errors:</p>
                  {syncResult.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-400">{e}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <SummaryCard
                icon={<DollarSign className="w-5 h-5 text-indigo-400" />}
                label="Total Quoted"
                value={formatCurrency(totalQuoted)}
                bgClass="bg-indigo-500/10 border-indigo-500/20"
              />
              <SummaryCard
                icon={<CircleDollarSign className="w-5 h-5 text-purple-400" />}
                label="Total Billed"
                value={formatCurrency(totalBilled)}
                bgClass="bg-purple-500/10 border-purple-500/20"
              />
              <SummaryCard
                icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
                label="Total Collected"
                value={formatCurrency(totalPaid)}
                sub={totalBilled > 0 ? `${collectionRate(totalPaid, totalBilled).toFixed(1)}% collected` : undefined}
                bgClass="bg-emerald-500/10 border-emerald-500/20"
              />
              <SummaryCard
                icon={<Clock className="w-5 h-5 text-orange-400" />}
                label="Outstanding"
                value={formatCurrency(Math.max(0, totalOutstanding))}
                sub={overdueInvoices.length > 0 ? `${overdueInvoices.length} overdue invoice${overdueInvoices.length !== 1 ? 's' : ''}` : undefined}
                bgClass="bg-orange-500/10 border-orange-500/20"
              />
            </div>

            {/* Aging Breakdown */}
            {overdueInvoices.length > 0 && (
              <div className="mb-8 rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-6">
                <h2 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-400" />
                  Overdue Aging Breakdown
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: '1–30 days', amount: agingBuckets['1_30'], color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
                    { label: '31–60 days', amount: agingBuckets['31_60'], color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
                    { label: '61–90 days', amount: agingBuckets['61_90'], color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
                    { label: '90+ days', amount: agingBuckets['90_plus'], color: 'text-red-500', bg: 'bg-red-500/15 border-red-500/30' },
                  ].map(b => (
                    <div key={b.label} className={`px-4 py-3 rounded-xl border ${b.bg}`}>
                      <p className="text-xs text-zinc-400 mb-1">{b.label}</p>
                      <p className={`text-lg font-bold ${b.color}`}>{formatCurrency(b.amount)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-3 mb-6">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search project, client, or PIC…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700/60 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>
              <div className="flex gap-1 rounded-xl bg-zinc-900 border border-zinc-700/60 p-1">
                {(['ALL', 'OUTSTANDING', 'FULLY_PAID'] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setStatusFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      statusFilter === f
                        ? 'bg-zinc-700 text-zinc-100'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {f === 'ALL' ? 'All' : f === 'OUTSTANDING' ? 'Outstanding' : 'Fully Paid'}
                  </button>
                ))}
              </div>
            </div>

            {/* Projects Table */}
            <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Project</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Client</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">PIC / Team</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Status</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Billed</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Collected</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Outstanding</th>
                      <th className="text-center px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Collection %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-16 text-zinc-500">
                          No billable projects found.
                        </td>
                      </tr>
                    ) : (
                      sorted.map(project => {
                        const outstanding = Math.max(0, project.billedAmount - project.paidAmount)
                        const rate = collectionRate(project.paidAmount, project.billedAmount)
                        const isExpanded = expandedId === project.id
                        const invoices = project.invoices ?? []

                        return (
                          <ProjectRow
                            key={project.id}
                            project={project}
                            outstanding={outstanding}
                            rate={rate}
                            isExpanded={isExpanded}
                            invoices={invoices}
                            onToggle={() => setExpandedId(isExpanded ? null : project.id)}
                          />
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer — Totals */}
              {sorted.length > 0 && (
                <div className="border-t border-zinc-800 px-5 py-3 flex items-center justify-end gap-8 text-xs font-semibold">
                  <span className="text-zinc-400">Totals:</span>
                  <span className="text-purple-300">{formatCurrency(totalBilled)}</span>
                  <span className="text-emerald-300">{formatCurrency(totalPaid)}</span>
                  <span className="text-orange-300">{formatCurrency(Math.max(0, totalOutstanding))}</span>
                  <span className="text-zinc-200">{collectionRate(totalPaid, totalBilled).toFixed(1)}%</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ───────── Sub-components ───────── */

function SummaryCard({
  icon,
  label,
  value,
  sub,
  bgClass,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  bgClass: string
}) {
  return (
    <div className={`rounded-2xl border p-5 ${bgClass}`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-xs font-medium text-zinc-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-zinc-100">{value}</p>
      {sub && <p className="text-xs text-zinc-400 mt-1">{sub}</p>}
    </div>
  )
}

function ProjectRow({
  project,
  outstanding,
  rate,
  isExpanded,
  invoices,
  onToggle,
}: {
  project: Project
  outstanding: number
  rate: number
  isExpanded: boolean
  invoices: Invoice[]
  onToggle: () => void
}) {
  const teamNames = getTeamNames(project)
  const hasOverdue = invoices.some(inv => inv.status !== 'PAID' && inv.dueAt && new Date(inv.dueAt) < new Date())

  return (
    <>
      <tr
        onClick={invoices.length > 0 ? onToggle : undefined}
        className={`border-b border-zinc-800/60 hover:bg-zinc-800/30 transition-colors ${invoices.length > 0 ? 'cursor-pointer' : ''}`}
      >
        <td className="px-5 py-3">
          <div className="flex items-center gap-2">
            {invoices.length > 0 && (
              <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
            )}
            <span className="font-mono text-xs text-zinc-300">{project.code}</span>
          </div>
        </td>
        <td className="px-5 py-3 text-zinc-300 truncate max-w-[180px]">
          {project.client?.companyName ?? '—'}
        </td>
        <td className="px-5 py-3">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-zinc-300 text-xs truncate max-w-[140px]">{teamNames}</span>
          </div>
        </td>
        <td className="px-5 py-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusBadge(project.status)}`}>
            {STATUS_LABELS[project.status]}
          </span>
          {hasOverdue && (
            <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
              Overdue
            </span>
          )}
        </td>
        <td className="px-5 py-3 text-right font-mono text-zinc-300">{formatCurrency(project.billedAmount)}</td>
        <td className="px-5 py-3 text-right font-mono text-emerald-400">{formatCurrency(project.paidAmount)}</td>
        <td className="px-5 py-3 text-right font-mono text-orange-400">
          {outstanding > 0 ? formatCurrency(outstanding) : '—'}
        </td>
        <td className="px-5 py-3">
          <div className="flex items-center justify-center gap-2">
            <div className="w-16 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${rate >= 100 ? 'bg-emerald-500' : rate >= 50 ? 'bg-blue-500' : 'bg-orange-500'}`}
                style={{ width: `${Math.min(100, rate)}%` }}
              />
            </div>
            <span className="text-xs text-zinc-400 w-10 text-right">{rate.toFixed(0)}%</span>
          </div>
        </td>
      </tr>

      {/* Expanded Invoice Details */}
      {isExpanded && invoices.length > 0 && (
        <tr>
          <td colSpan={8} className="px-0 py-0">
            <div className="bg-zinc-950/60 border-t border-zinc-800/40">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800/40">
                    <th className="text-left px-8 py-2 text-zinc-500 font-medium">Invoice #</th>
                    <th className="text-left px-4 py-2 text-zinc-500 font-medium">Type</th>
                    <th className="text-left px-4 py-2 text-zinc-500 font-medium">Status</th>
                    <th className="text-right px-4 py-2 text-zinc-500 font-medium">Amount</th>
                    <th className="text-left px-4 py-2 text-zinc-500 font-medium">Due Date</th>
                    <th className="text-left px-4 py-2 text-zinc-500 font-medium">Paid Date</th>
                    <th className="text-left px-4 py-2 text-zinc-500 font-medium">Aging</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => {
                    const agingDays = inv.status !== 'PAID' ? getAgingDays(inv.dueAt) : 0
                    return (
                      <tr key={inv.id} className="border-b border-zinc-800/30 hover:bg-zinc-800/20">
                        <td className="px-8 py-2 font-mono text-zinc-400">
                          {inv.invoiceNumber ?? inv.bukkuInvoiceId ?? '—'}
                        </td>
                        <td className="px-4 py-2 text-zinc-400">{inv.type}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${getInvoiceStatusBadge(inv.status)}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-zinc-300">{formatCurrency(inv.amount)}</td>
                        <td className="px-4 py-2 text-zinc-400">{formatDeadline(inv.dueAt)}</td>
                        <td className="px-4 py-2 text-zinc-400">{inv.paidAt ? formatDeadline(inv.paidAt) : '—'}</td>
                        <td className="px-4 py-2">
                          {inv.status !== 'PAID' && agingDays > 0 ? (
                            <span className={`font-medium ${getAgingColor(agingDays)}`}>
                              {agingDays}d overdue
                            </span>
                          ) : inv.status === 'PAID' ? (
                            <span className="text-emerald-500">Paid</span>
                          ) : (
                            <span className="text-zinc-500">Current</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
