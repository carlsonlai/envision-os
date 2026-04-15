'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Users,
  Calendar,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Briefcase,
  Bell,
} from 'lucide-react'
import type { LarkStaffMember } from '@/services/lark'

interface LeaveRequest {
  id: string
  employee: string
  role: string
  type: string
  from: string
  to: string
  days: number
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  appliedAt: string
}

const UPCOMING_LEAVES: Array<{ employee: string; dates: string; type: string; days: number }> = []

const RECENT_PAYROLL: Array<{ month: string; status: string; amount: string; date: string }> = []

// ── fallback dept headcount (used when Lark isn't connected) ─────────────────
const FALLBACK_HEADCOUNT: Array<{ dept: string; count: number; roles: string }> = []
const FALLBACK_HEADCOUNT_TOTAL = 0

/** Derive department headcount from Lark staff */
function buildHeadcount(staff: LarkStaffMember[]) {
  const map = new Map<string, number>()
  for (const s of staff) {
    const dept = s.departmentName ?? 'General'
    map.set(dept, (map.get(dept) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([dept, count]) => ({ dept, count, roles: '' }))
}

export default function HRDashboardPage() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [processingId, setProcessingId] = useState<string | null>(null)

  const [headcount, setHeadcount] = useState(FALLBACK_HEADCOUNT)
  const [totalHeadcount, setTotalHeadcount] = useState(FALLBACK_HEADCOUNT_TOTAL)
  const [larkSynced, setLarkSynced] = useState(false)

  // Load pending leave requests for the dashboard widget
  useEffect(() => {
    fetch('/api/hr/leave')
      .then(r => r.ok ? r.json() : null)
      .then((json: { data: Array<{ id: string; employee: string; role: string; type: string; from: string; to: string; days: number; reason: string; status: string; appliedAt: string }> } | null) => {
        if (!json) return
        const records: LeaveRequest[] = json.data.map(r => ({
          id: r.id,
          employee: r.employee,
          role: r.role,
          type: r.type,
          from: r.from,
          to: r.to,
          days: r.days,
          reason: r.reason,
          status: r.status as 'pending' | 'approved' | 'rejected',
          appliedAt: r.appliedAt,
        }))
        setLeaves(records)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/staff')
      .then(r => r.json() as Promise<{ staff: LarkStaffMember[]; source: string }>)
      .then(data => {
        if (data.source === 'lark' && data.staff.length > 0) {
          setHeadcount(buildHeadcount(data.staff))
          setTotalHeadcount(data.staff.length)
          setLarkSynced(true)
        }
      })
      .catch(() => { /* keep fallback */ })
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
      // silently fail
    } finally {
      setProcessingId(null)
    }
  }

  const pendingCount = leaves.filter(l => l.status === 'pending').length

  const TEAM_STATS = [
    { label: 'Total Headcount',   value: String(totalHeadcount), icon: Users,      color: 'text-[#818cf8]',  bg: 'bg-[#6366f1]/5 border-[#6366f1]/20' },
    { label: 'On Leave Today',    value: '1',                    icon: Calendar,   color: 'text-amber-400', bg: 'bg-amber-500/5 border-amber-500/20' },
    { label: 'Pending Approvals', value: String(pendingCount),   icon: Clock,      color: 'text-red-400',   bg: 'bg-red-500/5 border-red-500/20' },
    { label: 'Next Payroll',      value: 'Apr 30',               icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/20' },
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-[#818cf8]" />
            HR &amp; Admin
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5 flex items-center gap-2">
            Manage team, leave approvals, and payroll
            {larkSynced && (
              <span className="rounded-full border border-[#6366f1]/30 bg-[#6366f1]/10 px-2 py-0.5 text-[10px] font-semibold text-[#818cf8]">
                🪶 Lark synced
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/hr/leave" className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-1.5 text-sm text-zinc-300 hover:text-zinc-100 transition-colors">
            <Calendar className="h-3.5 w-3.5" /> Leave Management
          </Link>
          <Link href="/hr/payroll" className="flex items-center gap-2 rounded-lg bg-[#6366f1] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#5558e3] transition-colors">
            <DollarSign className="h-3.5 w-3.5" /> Run Payroll
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TEAM_STATS.map(stat => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className={`rounded-xl border ${stat.bg} p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${stat.color}`} />
                <p className="text-xs text-zinc-500">{stat.label}</p>
              </div>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          )
        })}
      </div>

      {/* Pending approvals banner */}
      {pendingCount > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-400 flex-shrink-0" />
            <p className="text-sm font-semibold text-amber-400">{pendingCount} leave request{pendingCount > 1 ? 's' : ''} need your approval</p>
          </div>
          <Link href="/hr/leave" className="flex-shrink-0 text-xs text-zinc-400 hover:text-zinc-200 underline transition-colors">View all</Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Leave approvals */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              Pending Leave Approvals
            </h2>
            <Link href="/hr/leave" className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-2">
            {leaves.map(leave => (
              <div key={leave.id} className={`rounded-xl border px-4 py-3 transition-all ${
                leave.status === 'approved' ? 'border-emerald-500/30 bg-emerald-500/5'
                : leave.status === 'rejected' ? 'border-red-500/20 bg-red-500/5 opacity-60'
                : 'border-zinc-800/60 bg-zinc-800/20'
              }`}>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-xs font-bold text-white">
                    {leave.employee.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-zinc-200">{leave.employee}</p>
                      <span className="text-[10px] text-zinc-500">{leave.role}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        leave.type === 'Sick Leave'      ? 'text-red-400   border-red-500/30   bg-red-500/10'
                        : leave.type === 'Emergency Leave' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                        : 'text-[#818cf8] border-[#6366f1]/30 bg-[#6366f1]/10'
                      }`}>{leave.type}</span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {leave.from === leave.to ? leave.from : `${leave.from} – ${leave.to}`}
                      {' '}· {leave.days} day{leave.days > 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5 italic">&ldquo;{leave.reason}&rdquo;</p>
                  </div>
                  <div className="flex-shrink-0">
                    {leave.status === 'pending' ? (
                      <div className="flex items-center gap-1.5">
                        <button type="button"
                          onClick={() => void handleLeave(leave.id, 'approved')}
                          disabled={processingId === leave.id}
                          className="cursor-pointer flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-60"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                        </button>
                        <button type="button"
                          onClick={() => void handleLeave(leave.id, 'rejected')}
                          disabled={processingId === leave.id}
                          className="cursor-pointer flex items-center gap-1 rounded-lg border border-red-500/20 px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-60"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </button>
                      </div>
                    ) : (
                      <span className={`flex items-center gap-1 text-xs font-semibold ${leave.status === 'approved' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {leave.status === 'approved' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                        {leave.status === 'approved' ? 'Approved' : 'Rejected'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Upcoming leaves */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#818cf8]" />
              Upcoming Leaves
            </h2>
            <div className="space-y-2">
              {UPCOMING_LEAVES.length === 0
                ? <p className="text-xs text-zinc-500 py-1">No upcoming leaves — submit requests via the leave portal.</p>
                : UPCOMING_LEAVES.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-zinc-800/40 last:border-0">
                  <div>
                    <p className="text-xs font-semibold text-zinc-200">{item.employee}</p>
                    <p className="text-[10px] text-zinc-500">{item.dates} · {item.type}</p>
                  </div>
                  <span className="text-xs font-bold text-amber-400">{item.days}d</span>
                </div>
              ))}
            </div>
            <Link href="/hr/leave" className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              Full leave calendar <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Department headcount */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-400" />
              Headcount by Department
              {larkSynced && <span className="text-[9px] text-[#818cf8] opacity-60 ml-auto">🪶 live</span>}
            </h2>
            <div className="space-y-2">
              {headcount.length === 0
                ? <p className="text-xs text-zinc-500 py-1">Sync Lark staff to see headcount by department.</p>
                : headcount.map(d => (
                <div key={d.dept} className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-zinc-200">{d.dept}</p>
                    {d.roles && <p className="text-[10px] text-zinc-600">{d.roles}</p>}
                  </div>
                  <span className="text-sm font-bold text-[#818cf8]">{d.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent payroll */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-400" />
              Recent Payroll
            </h2>
            <div className="space-y-2">
              {RECENT_PAYROLL.length === 0
                ? <p className="text-xs text-zinc-500 py-1">No payroll records yet — connect your payroll system or enter records manually.</p>
                : RECENT_PAYROLL.map(p => (
                <div key={p.month} className="flex items-center justify-between py-1.5 border-b border-zinc-800/40 last:border-0">
                  <div>
                    <p className="text-xs font-semibold text-zinc-200">{p.month}</p>
                    <p className="text-[10px] text-zinc-500">Paid {p.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-emerald-400">{p.amount}</p>
                    <span className="text-[10px] text-emerald-400">✓ {p.status}</span>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/hr/payroll" className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              Run next payroll <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
