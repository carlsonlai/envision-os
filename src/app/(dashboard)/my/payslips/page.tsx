'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  DollarSign,
  Download,
  ChevronDown,
  ChevronUp,
  FileText,
  Calendar,
} from 'lucide-react'

interface Payslip {
  id: string
  month: string
  year: string
  basic: number
  transport: number
  phone: number
  bonus: number
  epfEmployee: number
  epfEmployer: number
  socsoEmployee: number
  eisEmployee: number
  pcb: number
  status: 'paid' | 'processing'
  paidOn: string
}

function calcGross(p: Payslip) { return p.basic + p.transport + p.phone + p.bonus }
function calcNet(p: Payslip) { return calcGross(p) - p.epfEmployee - p.socsoEmployee - p.eisEmployee - p.pcb }

export default function MyPayslipsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status !== 'authenticated') return

    void (async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/my/payslips')
        if (res.ok) {
          const json = await res.json() as { data: Payslip[] }
          setPayslips(json.data ?? [])
          if (json.data?.length > 0) setExpanded(json.data[0].id)
        }
      } catch { /* ignore */ } finally {
        setLoading(false)
      }
    })()
  }, [status, router])

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  const currentYear = new Date().getFullYear().toString()
  const ytd = payslips.filter(p => p.year === currentYear)
  const ytdGross = ytd.reduce((s, p) => s + calcGross(p), 0)
  const ytdNet   = ytd.reduce((s, p) => s + calcNet(p), 0)
  const ytdEpf   = ytd.reduce((s, p) => s + p.epfEmployee, 0)
  const ytdPcb   = ytd.reduce((s, p) => s + p.pcb, 0)

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-emerald-400" />
          My Payslips
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">Your monthly salary statements and deduction breakdown</p>
      </div>

      {payslips.length === 0 ? (
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-12 text-center">
          <FileText className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 font-medium">No payslips yet</p>
          <p className="text-sm text-zinc-600 mt-1">
            Your payslips will appear here once HR processes payroll for your account.
          </p>
        </div>
      ) : (
        <>
          {/* YTD Summary */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: `YTD Gross (${currentYear})`, value: `RM ${ytdGross.toLocaleString()}`, color: 'text-zinc-200', bg: 'bg-zinc-800/30 border-zinc-700/40' },
              { label: 'YTD Net Pay',                value: `RM ${ytdNet.toLocaleString()}`,   color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/20' },
              { label: 'YTD EPF (Employee)',          value: `RM ${ytdEpf.toLocaleString()}`,   color: 'text-[#818cf8]',   bg: 'bg-[#6366f1]/5 border-[#6366f1]/20' },
              { label: 'YTD PCB Paid',               value: `RM ${ytdPcb.toLocaleString()}`,   color: 'text-amber-400',   bg: 'bg-amber-500/5 border-amber-500/20' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl border ${s.bg} p-4`}>
                <p className="text-xs text-zinc-500 mb-1">{s.label}</p>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Payslip list */}
          <div className="space-y-2">
            {payslips.map(ps => {
              const gross = calcGross(ps)
              const net = calcNet(ps)
              const isExpanded = expanded === ps.id

              return (
                <div
                  key={ps.id}
                  className={`rounded-xl border overflow-hidden transition-all ${
                    ps.status === 'processing'
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : 'border-zinc-800/60 bg-zinc-900/40'
                  }`}
                >
                  <div
                    className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-zinc-800/20 transition-colors"
                    onClick={() => setExpanded(isExpanded ? null : ps.id)}
                  >
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${ps.status === 'processing' ? 'bg-amber-500/20' : 'bg-[#6366f1]/20'}`}>
                      <FileText className={`h-4 w-4 ${ps.status === 'processing' ? 'text-amber-400' : 'text-[#818cf8]'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-zinc-200">{ps.month} {ps.year}</p>
                        {ps.bonus > 0 && (
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                            +Bonus
                          </span>
                        )}
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          ps.status === 'processing'
                            ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                            : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                        }`}>
                          {ps.status === 'processing' ? 'Processing' : 'Paid'}
                        </span>
                      </div>
                      {ps.paidOn && (
                        <p className="text-[10px] text-zinc-500 mt-0.5 flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {ps.paidOn}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-zinc-500">Gross</p>
                        <p className="text-sm font-semibold text-zinc-200">RM {gross.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-zinc-500">Net Pay</p>
                        <p className="text-sm font-bold text-emerald-400">RM {net.toLocaleString()}</p>
                      </div>
                      {ps.status === 'paid' && (
                        <button
                          type="button"
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-1.5 text-xs text-zinc-300 hover:text-zinc-100 transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" /> PDF
                        </button>
                      )}
                      {isExpanded
                        ? <ChevronUp className="h-4 w-4 text-zinc-500" />
                        : <ChevronDown className="h-4 w-4 text-zinc-500" />
                      }
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-3 border-t border-zinc-800/40">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {/* Earnings */}
                        <div className="rounded-lg border border-zinc-800/60 bg-zinc-800/20 p-3 space-y-2">
                          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Earnings</p>
                          {[
                            { label: 'Basic Salary',        value: `RM ${ps.basic.toLocaleString()}` },
                            { label: 'Transport Allowance', value: `RM ${ps.transport}` },
                            { label: 'Phone Allowance',     value: `RM ${ps.phone}` },
                            ...(ps.bonus > 0 ? [{ label: 'Bonus', value: `RM ${ps.bonus.toLocaleString()}` }] : []),
                          ].map(r => (
                            <div key={r.label} className="flex justify-between text-xs">
                              <span className="text-zinc-400">{r.label}</span>
                              <span className="text-zinc-200 font-medium">{r.value}</span>
                            </div>
                          ))}
                          <div className="border-t border-zinc-700/40 pt-2 flex justify-between text-xs">
                            <span className="font-semibold text-zinc-300">Total Gross</span>
                            <span className="font-bold text-zinc-100">RM {gross.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Deductions */}
                        <div className="rounded-lg border border-zinc-800/60 bg-zinc-800/20 p-3 space-y-2">
                          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Deductions</p>
                          {[
                            { label: 'EPF (11%)',        value: `- RM ${ps.epfEmployee.toFixed(2)}` },
                            { label: 'SOCSO',            value: `- RM ${ps.socsoEmployee.toFixed(2)}` },
                            { label: 'EIS',              value: `- RM ${ps.eisEmployee.toFixed(2)}` },
                            { label: 'PCB (Income Tax)', value: `- RM ${ps.pcb.toFixed(2)}` },
                          ].map(r => (
                            <div key={r.label} className="flex justify-between text-xs">
                              <span className="text-zinc-400">{r.label}</span>
                              <span className="text-red-400">{r.value}</span>
                            </div>
                          ))}
                          <div className="border-t border-zinc-700/40 pt-2 flex justify-between text-xs">
                            <span className="font-semibold text-zinc-300">Total Deductions</span>
                            <span className="font-bold text-red-400">
                              - RM {(ps.epfEmployee + ps.socsoEmployee + ps.eisEmployee + ps.pcb).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Net & EPF */}
                        <div className="space-y-3">
                          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-2">Net Pay (Credited)</p>
                            <p className="text-2xl font-bold text-emerald-400">RM {net.toLocaleString()}</p>
                            {ps.paidOn && <p className="text-[10px] text-zinc-500 mt-1">{ps.paidOn}</p>}
                          </div>
                          <div className="rounded-lg border border-[#6366f1]/20 bg-[#6366f1]/5 p-3">
                            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-2">EPF Contribution</p>
                            <div className="flex justify-between text-xs">
                              <span className="text-zinc-400">Your contribution (11%)</span>
                              <span className="text-[#818cf8]">RM {ps.epfEmployee.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs mt-1">
                              <span className="text-zinc-400">Employer (12%)</span>
                              <span className="text-[#818cf8]">RM {ps.epfEmployer.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs mt-1 border-t border-[#6366f1]/20 pt-1">
                              <span className="text-zinc-300 font-semibold">Total to EPF</span>
                              <span className="text-[#818cf8] font-bold">RM {(ps.epfEmployee + ps.epfEmployer).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
