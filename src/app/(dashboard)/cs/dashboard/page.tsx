'use client'

/* CS Dashboard — real-time project overview for Client Servicing */
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard, Clock, AlertTriangle, CheckCircle2,
  ChevronRight, Loader2, RefreshCw, Activity,
  FileText, Eye, MessageSquare, Zap, Users,
  TrendingUp, Bell, ArrowRight, Hand, UserCheck,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardItem {
  id: string
  itemType: string
  description: string | null
  status: string
  revisionCount: number
  deadline: string | null
  designerName: string | null
  latestFileVersion: string | null
  latestFileUrl: string | null
}

interface ClaimInfo {
  userId: string
  name: string
  claimedAt: string
}

interface DashboardProject {
  id: string
  code: string
  status: string
  clientName: string
  quotedAmount: number
  billedAmount: number
  paidAmount: number
  deadline: string | null
  updatedAt: string
  claimedBy: ClaimInfo[]
  isMyClaim: boolean
  items: DashboardItem[]
}

type PaymentLabel = 'Unpaid' | 'Partially Paid' | 'Fully Paid'
type BillingLabel = 'Not Billed' | 'Partially Billed' | 'Fully Billed'

function getPaymentStatus(proj: DashboardProject): { label: PaymentLabel; cls: string } {
  const billed = proj.billedAmount ?? 0
  const paid = proj.paidAmount ?? 0
  const reference = billed > 0 ? billed : proj.quotedAmount
  if (paid <= 0)
    return { label: 'Unpaid', cls: 'bg-zinc-700/60 text-zinc-400 border-zinc-600/40' }
  if (paid >= reference && reference > 0)
    return { label: 'Fully Paid', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' }
  return { label: 'Partially Paid', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25' }
}

function getBillingStatus(proj: DashboardProject): { label: BillingLabel; cls: string } | null {
  const billed = proj.billedAmount ?? 0
  const quoted = proj.quotedAmount ?? 0
  if (billed <= 0) return null  // not billed yet — don't show badge
  if (billed >= quoted && quoted > 0)
    return { label: 'Fully Billed', cls: 'bg-violet-500/15 text-violet-400 border-violet-500/25' }
  return { label: 'Partially Billed', cls: 'bg-sky-500/15 text-sky-400 border-sky-500/25' }
}

interface ActivityItem {
  id: string
  action: string
  metadata: Record<string, unknown> | null
  createdAt: string
  projectId: string | null
  projectCode: string | null
  clientName: string | null
  performerName: string | null
  performerRole: string | null
  deliverableItemId: string | null
  itemDescription: string | null
  itemType: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 0 })}`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })
}

function isOverdue(deadline: string | null): boolean {
  if (!deadline) return false
  return new Date(deadline) < new Date()
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-zinc-700/60 text-zinc-400',
  IN_PROGRESS: 'bg-blue-500/15 text-blue-400',
  WIP_UPLOADED: 'bg-violet-500/15 text-violet-400',
  QC_REVIEW: 'bg-amber-500/15 text-amber-400',
  APPROVED: 'bg-teal-500/15 text-teal-400',
  DELIVERED: 'bg-emerald-500/15 text-emerald-400',
  FA_SIGNED: 'bg-green-500/15 text-green-400',
  PROJECTED: 'bg-zinc-700/60 text-zinc-400',
  ONGOING: 'bg-blue-500/15 text-blue-400',
  COMPLETED: 'bg-amber-500/15 text-amber-400',
  BILLED: 'bg-violet-500/15 text-violet-400',
  PAID: 'bg-emerald-500/15 text-emerald-400',
}

const ACTION_LABELS: Record<string, string> = {
  STATUS_CHANGE: 'Status Changed',
  DESIGNER_ASSIGNED: 'Designer Assigned',
  FILE_UPLOADED: 'File Uploaded',
  QC_SUBMITTED: 'QC Submitted',
  QC_APPROVED: 'QC Approved',
  QC_REJECTED: 'QC Rejected',
  REVISION_UPLOADED: 'New Revision',
  REVISION_APPROVED: 'Revision OK',
  REVISION_REJECTED: 'Revision Rejected',
  CLIENT_APPROVED: 'Client Approved',
  CLIENT_CONFIRMED: 'Client Confirmed',
  BRIEF_CREATED: 'Brief Created',
  FA_CREATED: 'FA Created',
  FA_SIGNOFF: 'FA Signed Off',
  AUTO_ASSIGNED: 'Auto-Assigned',
  HANDOVER_COMPLETED: 'Handover Done',
}

function getActionColor(action: string): string {
  if (action.includes('APPROVED') || action.includes('SIGNOFF') || action === 'CLIENT_CONFIRMED')
    return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
  if (action.includes('REJECTED'))
    return 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
  if (action.includes('UPLOADED') || action.includes('REVISION'))
    return 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
  if (action.includes('ASSIGNED'))
    return 'bg-violet-500/15 text-violet-400 border border-violet-500/25'
  return 'bg-zinc-700/60 text-zinc-400 border border-zinc-600/40'
}

type FilterTab = 'all' | 'mine' | 'unclaimed'

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CSDashboardPage() {
  const [projects, setProjects] = useState<DashboardProject[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activityLoading, setActivityLoading] = useState(true)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterTab>('all')

  const loadProjects = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/cs/dashboard')
      const json = await res.json() as { data?: DashboardProject[] }
      setProjects(json.data ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  const loadActivity = useCallback(async () => {
    setActivityLoading(true)
    try {
      const res = await fetch('/api/cs/activity?limit=30')
      const json = await res.json() as { data?: ActivityItem[] }
      setActivity(json.data ?? [])
    } catch {
      // silent
    } finally {
      setActivityLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProjects()
    void loadActivity()
  }, [loadProjects, loadActivity])

  // ─── Claim / Unclaim ────────────────────────────────────────────────────────
  const handleClaim = async (projectId: string) => {
    setClaiming(projectId)
    try {
      await fetch('/api/cs/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      await loadProjects()
    } catch {
      // silent
    } finally {
      setClaiming(null)
    }
  }

  const handleUnclaim = async (projectId: string) => {
    setClaiming(projectId)
    try {
      await fetch('/api/cs/claim', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      await loadProjects()
    } catch {
      // silent
    } finally {
      setClaiming(null)
    }
  }

  // ─── Filtered projects ──────────────────────────────────────────────────────
  const filteredProjects = projects.filter((p) => {
    if (filter === 'mine') return p.isMyClaim
    if (filter === 'unclaimed') return p.claimedBy.length === 0
    return true
  })

  // Computed stats
  const myProjects = projects.filter(p => p.isMyClaim)
  const activeProjects = projects.filter(p => p.status === 'ONGOING')
  const unclaimedProjects = projects.filter(p => p.claimedBy.length === 0)
  const allItems = projects.flatMap(p => p.items)
  const needsAttention = allItems.filter(i =>
    i.status === 'QC_REVIEW' || i.status === 'WIP_UPLOADED' ||
    (i.status === 'APPROVED' && !i.latestFileUrl) ||
    isOverdue(i.deadline)
  )
  const inProgress = allItems.filter(i => ['IN_PROGRESS', 'WIP_UPLOADED', 'QC_REVIEW'].includes(i.status))
  const awaitingFeedback = allItems.filter(i => i.status === 'DELIVERED' || i.status === 'APPROVED')
  const overdueItems = allItems.filter(i => isOverdue(i.deadline) && !['DELIVERED', 'FA_SIGNED', 'APPROVED'].includes(i.status))

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-blue-400" />
            CS Dashboard
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">All projects — claim the ones you&apos;re handling</p>
        </div>
        <button
          type="button"
          onClick={() => { void loadProjects(); void loadActivity() }}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: 'My Projects', value: myProjects.length, icon: UserCheck, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
          { label: 'Active Projects', value: activeProjects.length, icon: Zap, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
          { label: 'Unclaimed', value: unclaimedProjects.length, icon: Hand, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'Awaiting Feedback', value: awaitingFeedback.length, icon: MessageSquare, color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/20' },
          { label: 'Overdue', value: overdueItems.length, icon: AlertTriangle, color: overdueItems.length > 0 ? 'text-rose-400' : 'text-emerald-400', bg: overdueItems.length > 0 ? 'bg-rose-500/10 border-rose-500/20' : 'bg-emerald-500/10 border-emerald-500/20' },
        ].map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className={`rounded-xl border p-3.5 ${s.bg}`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">{s.label}</span>
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          )
        })}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-700/50 pb-px">
        {([
          { key: 'all' as FilterTab, label: 'All Projects', count: projects.length },
          { key: 'mine' as FilterTab, label: 'My Claims', count: myProjects.length },
          { key: 'unclaimed' as FilterTab, label: 'Unclaimed', count: unclaimedProjects.length },
        ]).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-2 text-xs font-medium rounded-t-md transition-colors ${
              filter === tab.key
                ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/5'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />Loading projects…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* Left: Projects */}
          <div className="lg:col-span-2 space-y-5">

            {/* Needs Attention */}
            {needsAttention.length > 0 && filter !== 'unclaimed' && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <h2 className="text-sm font-semibold text-amber-400 flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4" />
                  Needs Attention ({needsAttention.length})
                </h2>
                <div className="space-y-2">
                  {needsAttention.slice(0, 8).map((item) => {
                    const proj = projects.find(p => p.items.some(i => i.id === item.id))
                    return (
                      <Link
                        key={item.id}
                        href={proj ? `/cs/projects/${proj.id}` : '#'}
                        className="flex items-center gap-3 rounded-lg border border-zinc-700/40 bg-zinc-800/40 px-3 py-2 hover:bg-zinc-800/70 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {proj && <span className="text-[10px] font-mono text-blue-400">{proj.code}</span>}
                            <span className="text-xs text-zinc-300 truncate">{item.description ?? item.itemType}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLES[item.status] ?? 'bg-zinc-700 text-zinc-400'}`}>
                              {item.status.replace(/_/g, ' ')}
                            </span>
                            {item.designerName && <span className="text-[10px] text-zinc-500">{item.designerName}</span>}
                            {isOverdue(item.deadline) && (
                              <span className="text-[10px] text-rose-400 flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" /> Overdue
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors flex-shrink-0" />
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Projects List */}
            <div>
              <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-blue-400" />
                {filter === 'mine' ? 'My Claims' : filter === 'unclaimed' ? 'Unclaimed Projects' : 'All Projects'} ({filteredProjects.length})
              </h2>
              <div className="space-y-2">
                {filteredProjects.map((proj) => {
                  const done = proj.items.filter(i => ['APPROVED', 'DELIVERED', 'FA_SIGNED'].includes(i.status)).length
                  const total = proj.items.length
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0
                  const hasOverdue = proj.items.some(i => isOverdue(i.deadline) && !['DELIVERED', 'FA_SIGNED', 'APPROVED'].includes(i.status))
                  const isClaimLoading = claiming === proj.id

                  return (
                    <div
                      key={proj.id}
                      className={`rounded-xl border p-4 transition-colors ${
                        proj.isMyClaim
                          ? 'border-blue-500/30 bg-blue-500/5'
                          : 'border-zinc-700/50 bg-zinc-800/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <Link href={`/cs/projects/${proj.id}`} className="min-w-0 flex-1 group">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-semibold text-blue-400">{proj.code}</span>
                            <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLES[proj.status] ?? 'bg-zinc-700 text-zinc-400'}`}>
                              {proj.status}
                            </span>
                            {hasOverdue && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-rose-400">
                                <AlertTriangle className="h-2.5 w-2.5" /> Overdue items
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-zinc-300 mt-0.5 group-hover:text-zinc-100 transition-colors">{proj.clientName}</p>
                        </Link>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right space-y-0.5">
                            <p className="text-xs font-semibold text-zinc-300">{fmt(proj.quotedAmount)}</p>
                            {/* Billing status — how much has been invoiced */}
                            {(() => {
                              const billing = getBillingStatus(proj)
                              if (!billing) return null
                              const billedFmt = proj.billedAmount > 0 ? ` (${fmt(proj.billedAmount)})` : ''
                              return (
                                <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold border ${billing.cls}`}>
                                  {billing.label}{billedFmt}
                                </span>
                              )
                            })()}
                            {/* Payment status — how much has been received */}
                            {(() => {
                              const pay = getPaymentStatus(proj)
                              const paidFmt = proj.paidAmount > 0 ? ` (${fmt(proj.paidAmount)})` : ''
                              return (
                                <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold border ${pay.cls}`}>
                                  {pay.label}{paidFmt}
                                </span>
                              )
                            })()}
                            {proj.deadline && (
                              <p className={`text-[10px] ${isOverdue(proj.deadline) ? 'text-rose-400' : 'text-zinc-500'}`}>
                                Due {new Date(proj.deadline).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
                              </p>
                            )}
                          </div>
                          {/* Claim / Unclaim button */}
                          <button
                            type="button"
                            disabled={isClaimLoading}
                            onClick={() => proj.isMyClaim ? handleUnclaim(proj.id) : handleClaim(proj.id)}
                            className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                              proj.isMyClaim
                                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-rose-500/15 hover:text-rose-400 hover:border-rose-500/30'
                                : 'bg-zinc-700/60 text-zinc-400 border border-zinc-600/40 hover:bg-blue-500/15 hover:text-blue-400 hover:border-blue-500/30'
                            } disabled:opacity-50`}
                            title={proj.isMyClaim ? 'Remove yourself from this project' : 'Claim this project'}
                          >
                            {isClaimLoading ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : proj.isMyClaim ? (
                              <><CheckCircle2 className="h-3 w-3" /> Claimed</>
                            ) : (
                              <><Hand className="h-3 w-3" /> Claim</>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Who claimed */}
                      {proj.claimedBy.length > 0 && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <UserCheck className="h-3 w-3 text-zinc-500" />
                          <span className="text-[10px] text-zinc-500">
                            Handled by: {proj.claimedBy.map(c => c.name).join(', ')}
                          </span>
                        </div>
                      )}

                      {/* Progress bar */}
                      <div className="mt-2.5 flex items-center gap-3">
                        <div className="flex-1 h-1.5 rounded-full bg-zinc-700/60">
                          <div
                            className={`h-1.5 rounded-full transition-all ${pct === 100 ? 'bg-emerald-400' : pct >= 50 ? 'bg-blue-400' : 'bg-zinc-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-zinc-500 flex-shrink-0">{done}/{total} done</span>
                      </div>
                      {/* Item summary row */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {proj.items.slice(0, 5).map((item) => (
                          <span
                            key={item.id}
                            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLES[item.status] ?? 'bg-zinc-700 text-zinc-400'}`}
                            title={`${item.description ?? item.itemType} — ${item.status}`}
                          >
                            {item.itemType.replace(/_/g, ' ')}
                          </span>
                        ))}
                        {proj.items.length > 5 && (
                          <span className="text-[10px] text-zinc-500">+{proj.items.length - 5} more</span>
                        )}
                      </div>
                    </div>
                  )
                })}
                {filteredProjects.length === 0 && (
                  <p className="text-sm text-zinc-500 text-center py-8">
                    {filter === 'mine' ? 'You haven\'t claimed any projects yet. Claim a project to get started!' : 'No projects found.'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right: Activity Feed */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-emerald-400" />
              Recent Changes
            </h2>
            {activityLoading ? (
              <div className="flex items-center justify-center py-10 text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />Loading…
              </div>
            ) : activity.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-10">No recent activity.</p>
            ) : (
              <div className="space-y-2">
                {activity.map((a) => (
                  <Link
                    key={a.id}
                    href={a.projectId ? `/cs/projects/${a.projectId}` : '#'}
                    className="block rounded-lg border border-zinc-700/40 bg-zinc-800/30 px-3 py-2.5 hover:bg-zinc-800/60 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getActionColor(a.action)}`}>
                        {ACTION_LABELS[a.action] ?? a.action.replace(/_/g, ' ')}
                      </span>
                      <span className="ml-auto text-[10px] text-zinc-600">{timeAgo(a.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      {a.projectCode && <span className="font-mono text-blue-400">{a.projectCode}</span>}
                      {a.clientName && <span className="text-zinc-400">{a.clientName}</span>}
                    </div>
                    {a.performerName && (
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        by {a.performerName}
                        {a.itemDescription && <> · {a.itemDescription}</>}
                      </p>
                    )}
                  </Link>
                ))}
                <Link
                  href="/cs/job-track"
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700/40 bg-zinc-800/20 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  View all in Job Track <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
