'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { LeaveType, LeaveStatus, LEAVE_TYPE_COLORS } from '@/lib/leaveColors'

interface LeaveRecord {
  id: string
  type: LeaveType
  from: string
  to: string
  days: number
  reason: string
  status: LeaveStatus
  appliedAt: string
  approvedBy?: string
}

// Standard Malaysian statutory entitlements
const LEAVE_ENTITLEMENT: Record<string, number> = {
  'Annual Leave': 14,
  'Sick Leave': 14,
  'Emergency Leave': 3,
  'Unpaid Leave': 0,
}

const STATUS_ICONS = {
  pending: <Clock className="h-3.5 w-3.5 text-amber-400" />,
  approved: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
  rejected: <XCircle className="h-3.5 w-3.5 text-red-400" />,
}

function BalancePill({ label, used, total, color }: { label: string; used: number; total: number; color: string }) {
  const remaining = total - used
  const pct = total > 0 ? (used / total) * 100 : 0
  const barColor = pct >= 90 ? 'bg-red-400' : pct >= 60 ? 'bg-amber-400' : 'bg-emerald-400'
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${color}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-zinc-300">{label}</p>
        <p className="text-lg font-bold text-zinc-100">{remaining}<span className="text-xs text-zinc-500 font-normal"> / {total}</span></p>
      </div>
      <div className="h-1.5 w-full rounded-full bg-zinc-800/60">
        <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-zinc-500">{used} used · {remaining} remaining</p>
    </div>
  )
}

export default function MyLeavePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [history, setHistory] = useState<LeaveRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Form state
  const [form, setForm] = useState({
    type: 'Annual Leave' as LeaveType,
    from: '',
    to: '',
    reason: '',
  })

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  // Fetch leave history from API
  useEffect(() => {
    if (status !== 'authenticated') return
    setHistoryLoading(true)
    fetch('/api/hr/leave')
      .then(r => r.ok ? r.json() : null)
      .then((json: { data: Array<{ id: string; type: string; from: string; to: string; days: number; reason: string; status: string; appliedAt: string; reviewedBy: string | null }> } | null) => {
        if (!json) return
        const records: LeaveRecord[] = json.data.map(r => ({
          id: r.id,
          type: r.type as LeaveType,
          from: r.from,
          to: r.to,
          days: r.days,
          reason: r.reason,
          status: r.status as LeaveStatus,
          appliedAt: r.appliedAt,
          approvedBy: r.reviewedBy ?? undefined,
        }))
        setHistory(records)
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }, [status])

  function calcDays(from: string, to: string): number {
    if (!from || !to) return 0
    const d1 = new Date(from)
    const d2 = new Date(to)
    const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1
    return Math.max(0, diff)
  }

  async function handleSubmit() {
    if (!form.from || !form.to || !form.reason) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/hr/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: form.type,
          from: form.from,
          to: form.to,
          days: calcDays(form.from, form.to),
          reason: form.reason,
        }),
      })
      if (!res.ok) return
      const json = await res.json() as { data: { id: string; type: string; from: string; to: string; days: number; reason: string; status: string; appliedAt: string } }
      const newLeave: LeaveRecord = {
        id: json.data.id,
        type: json.data.type as LeaveType,
        from: json.data.from,
        to: json.data.to,
        days: json.data.days,
        reason: json.data.reason,
        status: json.data.status as LeaveStatus,
        appliedAt: json.data.appliedAt,
      }
      setHistory(prev => [newLeave, ...prev])
      setSubmitted(true)
      setShowForm(false)
      setForm({ type: 'Annual Leave', from: '', to: '', reason: '' })
      setTimeout(() => setSubmitted(false), 4000)
    } catch {
      // silent fail — user can retry
    } finally {
      setSubmitting(false)
    }
  }

  const days = calcDays(form.from, form.to)

  // Compute balance from real history (approved leaves only)
  function usedDays(type: string): number {
    return history
      .filter(r => r.type === type && r.status === 'approved')
      .reduce((sum, r) => sum + r.days, 0)
  }

  const annualUsed = usedDays('Annual Leave')
  const sickUsed = usedDays('Sick Leave')
  const emergencyUsed = usedDays('Emergency Leave')

  if (status === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#818cf8]" />
            My Leave
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">Apply for leave and track your balance</p>
        </div>
        {!showForm && (
          <button type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-[#6366f1] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#5558e3] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Apply Leave
          </button>
        )}
      </div>

      {/* Success */}
      {submitted && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
          <p className="text-sm text-emerald-400 font-semibold">Leave application submitted! Waiting for admin approval.</p>
        </div>
      )}

      {/* Leave Balance */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <BalancePill label="Annual Leave" used={annualUsed} total={LEAVE_ENTITLEMENT['Annual Leave']} color="border-[#6366f1]/20 bg-[#6366f1]/5" />
        <BalancePill label="Sick Leave" used={sickUsed} total={LEAVE_ENTITLEMENT['Sick Leave']} color="border-red-500/20 bg-red-500/5" />
        <BalancePill label="Emergency Leave" used={emergencyUsed} total={LEAVE_ENTITLEMENT['Emergency Leave']} color="border-amber-500/20 bg-amber-500/5" />
      </div>

      {/* Apply form */}
      {showForm && (
        <div className="rounded-xl border border-[#6366f1]/30 bg-[#6366f1]/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">New Leave Application</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Type */}
            <div className="sm:col-span-2">
              <label className="text-xs text-zinc-400 mb-1.5 block">Leave Type</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(['Annual Leave', 'Sick Leave', 'Emergency Leave', 'Unpaid Leave'] as LeaveType[]).map(t => (
                  <button type="button"
                    key={t}
                    onClick={() => setForm(f => ({ ...f, type: t }))}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${form.type === t ? LEAVE_TYPE_COLORS[t] : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* From */}
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">From</label>
              <input
                type="date"
                value={form.from}
                onChange={e => setForm(f => ({ ...f, from: e.target.value }))}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#6366f1]/50"
              />
            </div>

            {/* To */}
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">To</label>
              <input
                type="date"
                value={form.to}
                min={form.from}
                onChange={e => setForm(f => ({ ...f, to: e.target.value }))}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#6366f1]/50"
              />
            </div>

            {/* Days preview */}
            {days > 0 && (
              <div className="sm:col-span-2">
                <div className="flex items-center gap-2 rounded-lg border border-zinc-800/60 bg-zinc-800/30 px-3 py-2">
                  <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                  <span className="text-xs text-zinc-300"><span className="font-bold text-zinc-100">{days} day{days > 1 ? 's' : ''}</span> of leave</span>
                  {form.type === 'Annual Leave' && LEAVE_ENTITLEMENT['Annual Leave'] - annualUsed - days < 0 && (
                    <span className="ml-auto flex items-center gap-1 text-xs text-red-400"><AlertCircle className="h-3 w-3" /> Exceeds balance</span>
                  )}
                </div>
              </div>
            )}

            {/* Reason */}
            <div className="sm:col-span-2">
              <label className="text-xs text-zinc-400 mb-1.5 block">Reason</label>
              <textarea
                rows={2}
                placeholder="Brief reason for leave..."
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#6366f1]/50 placeholder:text-zinc-600 resize-none"
              />
              {form.type === 'Sick Leave' && (
                <p className="text-[10px] text-zinc-500 mt-1">Please submit your MC to admin upon return.</p>
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
              Cancel
            </button>
            <button type="button"
              onClick={handleSubmit}
              disabled={submitting || !form.from || !form.to || !form.reason}
              className="cursor-pointer flex items-center gap-2 rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5558e3] disabled:opacity-60 transition-colors"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </div>
      )}

      {/* History */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Leave History</h2>
        {historyLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 py-10 text-center">
            <Calendar className="mx-auto h-8 w-8 text-zinc-700 mb-2" />
            <p className="text-sm text-zinc-500">No leave applications yet</p>
          </div>
        ) : null}
        <div className="space-y-2">
          {history.map(leave => (
            <div key={leave.id} className={`rounded-xl border px-4 py-3.5 ${
              leave.status === 'approved' ? 'border-emerald-500/20 bg-emerald-500/5'
              : leave.status === 'rejected' ? 'border-zinc-800/40 bg-zinc-900/20 opacity-70'
              : 'border-amber-500/20 bg-amber-500/5'
            }`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{STATUS_ICONS[leave.status]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${LEAVE_TYPE_COLORS[leave.type]}`}>{leave.type}</span>
                    <span className="text-xs text-zinc-200 font-semibold">
                      {leave.from === leave.to ? leave.from : `${leave.from} – ${leave.to}`}
                    </span>
                    <span className="text-[10px] text-zinc-500">{leave.days} day{leave.days > 1 ? 's' : ''}</span>
                  </div>
                  <p className="text-xs text-zinc-400 italic">&ldquo;{leave.reason}&rdquo;</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">
                    Applied {leave.appliedAt}
                    {leave.approvedBy && ` · Approved by ${leave.approvedBy}`}
                  </p>
                </div>
                <span className={`flex-shrink-0 text-xs font-semibold capitalize ${
                  leave.status === 'approved' ? 'text-emerald-400'
                  : leave.status === 'rejected' ? 'text-red-400'
                  : 'text-amber-400'
                }`}>{leave.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
