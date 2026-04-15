'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  Search,
  Loader2,
  LayoutGrid,
  List,
} from 'lucide-react'

type ViewMode = 'list' | 'bento'
import { LeaveType, LeaveStatus, LEAVE_TYPE_COLORS, LEAVE_STATUS_COLORS } from '@/lib/leaveColors'
import type { LarkStaffMember } from '@/services/lark'

interface LeaveRequest {
  id: string
  employee: string
  role: string
  dept: string
  type: LeaveType
  from: string
  to: string
  days: number
  reason: string
  status: LeaveStatus
  appliedAt: string
}

interface BalanceRow {
  employee: string
  role: string
  annual:    { used: number; total: number }
  sick:      { used: number; total: number }
  emergency: { used: number; total: number }
}

// Standard Malaysian statutory entitlements
const ENTITLEMENT = { annual: 14, sick: 14, emergency: 3 }

function BalanceBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? (used / total) * 100 : 0
  const color = pct >= 90 ? 'bg-red-400' : pct >= 60 ? 'bg-amber-400' : 'bg-emerald-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-zinc-800">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-zinc-500 w-8 text-right">{total - used}d</span>
    </div>
  )
}

function computeBalances(leaves: LeaveRequest[]): BalanceRow[] {
  const map = new Map<string, { role: string; annual: number; sick: number; emergency: number }>()
  for (const l of leaves) {
    if (l.status !== 'approved') continue
    const key = l.employee
    if (!map.has(key)) map.set(key, { role: l.role, annual: 0, sick: 0, emergency: 0 })
    const entry = map.get(key)!
    if (l.type === 'Annual Leave') entry.annual += l.days
    else if (l.type === 'Sick Leave') entry.sick += l.days
    else if (l.type === 'Emergency Leave') entry.emergency += l.days
  }
  // Also include employees with zero approved leaves but pending/rejected entries
  for (const l of leaves) {
    if (!map.has(l.employee)) {
      map.set(l.employee, { role: l.role, annual: 0, sick: 0, emergency: 0 })
    }
  }
  return Array.from(map.entries()).map(([employee, d]) => ({
    employee,
    role: d.role,
    annual:    { used: d.annual,    total: ENTITLEMENT.annual },
    sick:      { used: d.sick,      total: ENTITLEMENT.sick },
    emergency: { used: d.emergency, total: ENTITLEMENT.emergency },
  }))
}

export default function LeaveManagementPage() {
  const [view, setView] = useState<ViewMode>('list')
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'requests' | 'balances'>('requests')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [larkSynced, setLarkSynced] = useState(false)

  const loadLeaves = useCallback(() => {
    setLoading(true)
    fetch('/api/hr/leave')
      .then(r => r.ok ? r.json() : null)
      .then((json: { data: Array<{ id: string; employee: string; role: string; dept: string; type: string; from: string; to: string; days: number; reason: string; status: string; appliedAt: string }> } | null) => {
        if (!json) return
        const records: LeaveRequest[] = json.data.map(r => ({
          id: r.id,
          employee: r.employee,
          role: r.role,
          dept: r.dept,
          type: r.type as LeaveType,
          from: r.from,
          to: r.to,
          days: r.days,
          reason: r.reason,
          status: r.status as LeaveStatus,
          appliedAt: r.appliedAt,
        }))
        setLeaves(records)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadLeaves()
  }, [loadLeaves])

  // Optionally enrich role/dept from Lark
  useEffect(() => {
    fetch('/api/staff')
      .then(r => r.json() as Promise<{ staff: LarkStaffMember[]; source: string }>)
      .then(data => {
        if (data.source === 'lark' && data.staff.length > 0) {
          setLeaves(prev => prev.map(l => {
            const match = data.staff.find(s => s.name.toLowerCase() === l.employee.toLowerCase())
            return match ? { ...l, role: match.jobTitle ?? l.role, dept: match.departmentName ?? l.dept } : l
          }))
          setLarkSynced(true)
        }
      })
      .catch(() => {})
  }, [])

  async function handleLeave(id: string, action: 'approved' | 'rejected') {
    setProcessingId(id)
    try {
      const res = await fetch(`/api/hr/leave/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action }),
      })
      if (res.ok) {
        setLeaves(prev => prev.map(l => l.id === id ? { ...l, status: action } : l))
      }
    } catch {
      // silently fail — status stays unchanged
    } finally {
      setProcessingId(null)
    }
  }

  const filtered = leaves.filter(l => {
    if (filterStatus !== 'all' && l.status !== filterStatus) return false
    if (search && !l.employee.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const pendingCount = leaves.filter(l => l.status === 'pending').length
  const balances = computeBalances(leaves)

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/hr" className="flex items-center justify-center h-7 w-7 rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-200 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#818cf8]" />
              Leave Management
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5 flex items-center gap-2">
              {pendingCount} pending approval{pendingCount !== 1 ? 's' : ''}
              {larkSynced && (
                <span className="rounded-full border border-[#6366f1]/30 bg-[#6366f1]/10 px-2 py-0.5 text-[10px] font-semibold text-[#818cf8]">
                  🪶 Lark synced
                </span>
              )}
            </p>
          </div>
        </div>
        {/* View toggle — only shown on Requests tab */}
        {tab === 'requests' && (
          <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-800/60 p-0.5">
            <button type="button" onClick={() => setView('list')} title="List view"
              className={`rounded-md p-1.5 transition-colors ${view === 'list' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <List className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => setView('bento')} title="Grid view"
              className={`rounded-md p-1.5 transition-colors ${view === 'bento' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/50 p-1 w-fit">
        {[{ key: 'requests', label: 'Leave Requests' }, { key: 'balances', label: 'Leave Balances' }].map(t => (
          <button type="button" key={t.key} onClick={() => setTab(t.key as 'requests' | 'balances')} className={`cursor-pointer rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${tab === t.key ? 'bg-[#6366f1] text-white' : 'text-zinc-500 hover:text-zinc-200'}`}>
            {t.label}
            {t.key === 'requests' && pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Leave Requests */}
      {tab === 'requests' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search employee..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="rounded-lg border border-zinc-800 bg-zinc-900 pl-8 pr-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-[#6366f1]/50 placeholder:text-zinc-600 w-48"
              />
            </div>
            {['all', 'pending', 'approved', 'rejected'].map(s => (
              <button type="button" key={s} onClick={() => setFilterStatus(s)} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${filterStatus === s ? 'border-[#6366f1]/40 bg-[#6366f1]/10 text-[#818cf8]' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed border-zinc-800 text-center">
              <Calendar className="h-8 w-8 text-zinc-700 mb-2" />
              <p className="text-sm text-zinc-500">No requests found</p>
            </div>
          ) : view === 'bento' ? (
            /* ── Bento grid ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(leave => (
                <div key={leave.id} className={`rounded-xl border p-4 transition-all ${
                  leave.status === 'approved' ? 'border-emerald-500/20 bg-emerald-500/5'
                  : leave.status === 'rejected' ? 'border-zinc-800/40 bg-zinc-900/20 opacity-70'
                  : 'border-zinc-800/60 bg-zinc-900/40'
                }`}>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-xs font-bold text-white">
                      {leave.employee.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-200 truncate">{leave.employee}</p>
                      <p className="text-[10px] text-zinc-500 truncate">{leave.role}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${LEAVE_TYPE_COLORS[leave.type]}`}>{leave.type}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${LEAVE_STATUS_COLORS[leave.status]}`}>{leave.status}</span>
                  </div>
                  <p className="text-xs text-zinc-300 mb-0.5">
                    {leave.from === leave.to ? leave.from : `${leave.from} – ${leave.to}`}
                    <span className="text-zinc-500 ml-1.5">{leave.days}d</span>
                  </p>
                  {leave.reason && <p className="text-[11px] text-zinc-500 italic truncate">&ldquo;{leave.reason}&rdquo;</p>}
                  {leave.status === 'pending' && (
                    <div className="flex gap-2 mt-3">
                      <button type="button" onClick={() => void handleLeave(leave.id, 'approved')} disabled={processingId === leave.id}
                        className="cursor-pointer flex-1 flex items-center justify-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-60">
                        {processingId === leave.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Approve
                      </button>
                      <button type="button" onClick={() => void handleLeave(leave.id, 'rejected')} disabled={processingId === leave.id}
                        className="cursor-pointer flex-1 flex items-center justify-center gap-1 rounded-lg border border-red-500/20 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-60">
                        <XCircle className="h-3 w-3" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* ── List view (original cards) ── */
            <div className="space-y-2">
              {filtered.map(leave => (
                <div key={leave.id} className={`rounded-xl border px-4 py-3.5 transition-all ${
                  leave.status === 'approved' ? 'border-emerald-500/20 bg-emerald-500/5'
                  : leave.status === 'rejected' ? 'border-zinc-800/40 bg-zinc-900/20 opacity-70'
                  : 'border-zinc-800/60 bg-zinc-900/40'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-xs font-bold text-white">
                      {leave.employee.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-sm font-semibold text-zinc-200">{leave.employee}</p>
                        <span className="text-[10px] text-zinc-500">{leave.role}{leave.dept ? ` · ${leave.dept}` : ''}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${LEAVE_TYPE_COLORS[leave.type]}`}>{leave.type}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${LEAVE_STATUS_COLORS[leave.status]}`}>{leave.status}</span>
                        <span className="text-[10px] text-zinc-500">{leave.appliedAt}</span>
                      </div>
                      <p className="text-xs text-zinc-300">
                        {leave.from === leave.to ? leave.from : `${leave.from} – ${leave.to}`}
                        <span className="text-zinc-500 ml-2">({leave.days} day{leave.days > 1 ? 's' : ''})</span>
                      </p>
                      {leave.reason && (
                        <p className="text-xs text-zinc-500 mt-0.5 italic">&ldquo;{leave.reason}&rdquo;</p>
                      )}
                    </div>
                    {leave.status === 'pending' && (
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <button type="button" onClick={() => void handleLeave(leave.id, 'approved')} disabled={processingId === leave.id} className="cursor-pointer flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-60">
                          {processingId === leave.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Approve
                        </button>
                        <button type="button" onClick={() => void handleLeave(leave.id, 'rejected')} disabled={processingId === leave.id} className="cursor-pointer flex items-center gap-1 rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-60">
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </button>
                      </div>
                    )}
                    {leave.status !== 'pending' && (
                      <span className={`flex-shrink-0 flex items-center gap-1 text-xs font-semibold ${leave.status === 'approved' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {leave.status === 'approved' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        {leave.status === 'approved' ? 'Approved' : 'Rejected'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Leave Balances (computed from real approved records) */}
      {tab === 'balances' && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
            </div>
          ) : balances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed border-zinc-800 text-center">
              <Clock className="h-8 w-8 text-zinc-700 mb-2" />
              <p className="text-sm text-zinc-500">No leave data available yet</p>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800/60">
                    <th className="text-left text-zinc-500 font-medium px-4 py-3">
                      Employee
                      {larkSynced && <span className="ml-2 text-[9px] text-[#818cf8] opacity-60">🪶 Lark</span>}
                    </th>
                    <th className="text-left text-zinc-500 font-medium px-3 py-3">Annual Leave</th>
                    <th className="text-left text-zinc-500 font-medium px-3 py-3">Sick Leave</th>
                    <th className="text-left text-zinc-500 font-medium px-3 py-3">Emergency</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((emp, i) => (
                    <tr key={emp.employee} className={i < balances.length - 1 ? 'border-b border-zinc-800/40' : ''}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-zinc-200">{emp.employee}</p>
                        <p className="text-[10px] text-zinc-500">{emp.role}</p>
                      </td>
                      <td className="px-3 py-3 w-36">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[#818cf8] font-semibold">{emp.annual.used}/{emp.annual.total}</span>
                          <span className="text-zinc-600">{emp.annual.total - emp.annual.used} left</span>
                        </div>
                        <BalanceBar used={emp.annual.used} total={emp.annual.total} />
                      </td>
                      <td className="px-3 py-3 w-36">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-red-400 font-semibold">{emp.sick.used}/{emp.sick.total}</span>
                          <span className="text-zinc-600">{emp.sick.total - emp.sick.used} left</span>
                        </div>
                        <BalanceBar used={emp.sick.used} total={emp.sick.total} />
                      </td>
                      <td className="px-3 py-3 w-28">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-amber-400 font-semibold">{emp.emergency.used}/{emp.emergency.total}</span>
                          <span className="text-zinc-600">{emp.emergency.total - emp.emergency.used} left</span>
                        </div>
                        <BalanceBar used={emp.emergency.used} total={emp.emergency.total} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
