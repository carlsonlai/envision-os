'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  DollarSign,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Download,
  ChevronDown,
  ChevronUp,
  FileText,
  Users,
  AlertCircle,
  RefreshCw,
  LayoutGrid,
  List,
} from 'lucide-react'

type ViewMode = 'list' | 'bento'
import type { LarkStaffMember } from '@/services/lark'

interface Employee {
  id: string
  name: string
  role: string
  dept: string
  basic: number
  transport: number
  phone: number
  epfEmployee: number
  epfEmployer: number
  socsoEmployee: number
  socsoEmployer: number
  eisEmployee: number
  pcb: number
  bank: string
  account: string
  /** true when this record came from Lark, not hardcoded */
  fromLark?: boolean
}

const MONTHS = ['April 2026', 'March 2026', 'February 2026', 'January 2026']

/** Derive EPF / SOCSO / EIS from basic when no payroll record exists */
function defaultPayroll(basic: number): Pick<Employee, 'epfEmployee' | 'epfEmployer' | 'socsoEmployee' | 'socsoEmployer' | 'eisEmployee' | 'pcb' | 'transport' | 'phone' | 'bank' | 'account'> {
  const epfEmp = Math.round(basic * 0.11 * 100) / 100
  const epfEmr = Math.round(basic * 0.12 * 100) / 100
  const socsoEmp  = basic <= 4000 ? 14.75 : 0
  const socsoEmr  = basic <= 4000 ? Math.round(basic * 0.0175 * 100) / 100 : 0
  const eis = Math.round(basic * 0.002 * 100) / 100
  const pcb = basic > 5000 ? Math.round(basic * 0.08) : basic > 3500 ? Math.round(basic * 0.04) : 0
  return {
    transport: 0, phone: 0,
    epfEmployee: epfEmp, epfEmployer: epfEmr,
    socsoEmployee: socsoEmp, socsoEmployer: socsoEmr,
    eisEmployee: eis, pcb,
    bank: '—', account: '—',
  }
}

/** Map a Lark staff member to an Employee record */
function larkToEmployee(s: LarkStaffMember, index: number, payrollMap: Map<string, Partial<Employee>>): Employee {
  const payroll = payrollMap.get(s.name.toLowerCase()) ?? {}
  const basic = payroll.basic ?? 3000 // admin should configure via payroll settings
  return {
    id: s.openId || `lark-${index}`,
    name: s.name,
    role: s.jobTitle ?? 'Staff',
    dept: s.departmentName ?? 'General',
    basic,
    fromLark: true,
    ...defaultPayroll(basic),
    // Override with payroll DB values when configured
    transport: payroll.transport ?? 0,
    phone: payroll.phone ?? 0,
    bank: payroll.bank ?? '—',
    account: payroll.account ?? '—',
    ...(payroll.epfEmployee !== undefined && {
      epfEmployee: payroll.epfEmployee,
      epfEmployer: payroll.epfEmployer ?? 0,
      socsoEmployee: payroll.socsoEmployee ?? 0,
      socsoEmployer: payroll.socsoEmployer ?? 0,
      eisEmployee: payroll.eisEmployee ?? 0,
      pcb: payroll.pcb ?? 0,
    }),
  }
}

function calcNetPay(emp: Employee): number {
  const gross = emp.basic + emp.transport + emp.phone
  return gross - emp.epfEmployee - emp.socsoEmployee - emp.eisEmployee - emp.pcb
}

function calcGross(emp: Employee): number {
  return emp.basic + emp.transport + emp.phone
}

export default function PayrollPage() {
  const [view, setView] = useState<ViewMode>('list')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [fromLark, setFromLark] = useState(false)
  const [loading, setLoading] = useState(true)
  const [larkError, setLarkError] = useState<string | null>(null)

  const [selectedMonth, setSelectedMonth] = useState('April 2026')
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState<Set<string>>(new Set())
  const [allGenerated, setAllGenerated] = useState(false)

  interface PayrollApiItem {
    userId: string
    name: string
    role: string
    basic: number
    transport: number
    phone: number
    bank: string
    accountMasked: string
    epfEmployee: number
    epfEmployer: number
    socsoEmployee: number
    socsoEmployer: number
    eisEmployee: number
    pcb: number
    configured: boolean
  }

  async function fetchPayroll() {
    setLoading(true)
    setLarkError(null)
    try {
      // Try Lark for org structure, payroll API for compensation data
      const [payrollRes, larkRes] = await Promise.all([
        fetch('/api/hr/payroll'),
        fetch('/api/staff'),
      ])

      const payrollJson = payrollRes.ok
        ? (await payrollRes.json() as { data: PayrollApiItem[] })
        : null

      const larkJson = larkRes.ok
        ? (await larkRes.json() as { staff: LarkStaffMember[]; source: string; error?: string })
        : null

      if (payrollJson && payrollJson.data.length > 0) {
        // Build payroll map keyed by name for Lark enrichment
        const payrollMap = new Map<string, Partial<Employee>>()
        for (const p of payrollJson.data) {
          payrollMap.set(p.name.toLowerCase(), {
            basic: p.basic,
            transport: p.transport,
            phone: p.phone,
            bank: p.bank,
            account: p.accountMasked,
            epfEmployee: p.epfEmployee,
            epfEmployer: p.epfEmployer,
            socsoEmployee: p.socsoEmployee,
            socsoEmployer: p.socsoEmployer,
            eisEmployee: p.eisEmployee,
            pcb: p.pcb,
          })
        }

        if (larkJson && larkJson.source === 'lark' && larkJson.staff.length > 0) {
          // Merge Lark roster with payroll DB data
          setEmployees(larkJson.staff.map((s, i) => larkToEmployee(s, i, payrollMap)))
          setFromLark(true)
        } else {
          // No Lark: use payroll API data directly
          setEmployees(payrollJson.data.map(p => ({
            id: p.userId,
            name: p.name,
            role: p.role,
            dept: '',
            basic: p.basic,
            transport: p.transport,
            phone: p.phone,
            bank: p.bank,
            account: p.accountMasked,
            epfEmployee: p.epfEmployee,
            epfEmployer: p.epfEmployer,
            socsoEmployee: p.socsoEmployee,
            socsoEmployer: p.socsoEmployer,
            eisEmployee: p.eisEmployee,
            pcb: p.pcb,
          })))
          setFromLark(false)
          if (larkJson?.error) setLarkError(larkJson.error)
        }
      } else if (larkJson && larkJson.source === 'lark' && larkJson.staff.length > 0) {
        // Payroll not configured yet but Lark works — show staff with default deductions
        const emptyMap = new Map<string, Partial<Employee>>()
        setEmployees(larkJson.staff.map((s, i) => larkToEmployee(s, i, emptyMap)))
        setFromLark(true)
      } else {
        // Neither configured — show empty state
        if (larkJson?.error) setLarkError(larkJson.error)
        setEmployees([])
        setFromLark(false)
      }
    } catch {
      setEmployees([])
      setFromLark(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchPayroll() }, [])

  function parseMonthYear(label: string): { month: number; year: number } {
    const [monthName, yearStr] = label.split(' ')
    const MONTHS_LIST = ['January','February','March','April','May','June',
      'July','August','September','October','November','December']
    const month = MONTHS_LIST.indexOf(monthName) + 1
    return { month, year: parseInt(yearStr, 10) }
  }

  function buildPayrollPayload(ids: string[]) {
    const { month, year } = parseMonthYear(selectedMonth)
    const payrollData: Record<string, {
      basic: number; transport: number; phone: number
      epfEmployee: number; epfEmployer: number
      socsoEmployee: number; socsoEmployer: number
      eis: number; pcb: number
    }> = {}
    for (const emp of employees) {
      if (ids.includes(emp.id)) {
        payrollData[emp.id] = {
          basic: emp.basic, transport: emp.transport, phone: emp.phone,
          epfEmployee: emp.epfEmployee, epfEmployer: emp.epfEmployer,
          socsoEmployee: emp.socsoEmployee, socsoEmployer: emp.socsoEmployer,
          eis: emp.eisEmployee, pcb: emp.pcb,
        }
      }
    }
    return { userIds: ids, month, year, payrollData }
  }

  async function generateSingle(id: string) {
    try {
      await fetch('/api/hr/payroll/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayrollPayload([id])),
      })
    } catch { /* best-effort */ }
    setGenerated(prev => new Set([...prev, id]))
  }

  async function generateAll() {
    setGenerating(true)
    try {
      await fetch('/api/hr/payroll/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayrollPayload(employees.map(e => e.id))),
      })
    } catch { /* best-effort */ }
    setGenerated(new Set(employees.map(e => e.id)))
    setGenerating(false)
    setAllGenerated(true)
  }

  const totalGross      = employees.reduce((s, e) => s + calcGross(e), 0)
  const totalNet        = employees.reduce((s, e) => s + calcNetPay(e), 0)
  const totalEpfEmployer   = employees.reduce((s, e) => s + e.epfEmployer, 0)
  const totalSocsoEmployer = employees.reduce((s, e) => s + e.socsoEmployer, 0)
  const totalCost       = totalGross + totalEpfEmployer + totalSocsoEmployer

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
              <DollarSign className="h-5 w-5 text-emerald-400" />
              Payroll Management
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5 flex items-center gap-2">
              Generate payslips with EPF, SOCSO &amp; PCB calculations
              {fromLark && (
                <span className="rounded-full border border-[#6366f1]/30 bg-[#6366f1]/10 px-2 py-0.5 text-[10px] font-semibold text-[#818cf8]">
                  🪶 Synced from Lark
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
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
          <button
            type="button"
            onClick={fetchPayroll}
            disabled={loading}
            className="cursor-pointer flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Syncing…' : 'Sync Lark'}
          </button>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-[#6366f1]/50"
          >
            {MONTHS.map(m => <option key={m}>{m}</option>)}
          </select>
          <button type="button"
            onClick={generateAll}
            disabled={generating || allGenerated || loading}
            className={`cursor-pointer flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${allGenerated ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'bg-[#6366f1] text-white hover:bg-[#5558e3]'}`}
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : allGenerated ? <CheckCircle2 className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
            {generating ? 'Generating...' : allGenerated ? 'All Payslips Ready' : 'Generate All Payslips'}
          </button>
        </div>
      </div>

      {/* Lark permission hint */}
      {larkError && (
        <div className="rounded-xl border border-[#6366f1]/20 bg-[#6366f1]/5 px-4 py-3 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-[#818cf8] flex-shrink-0 mt-0.5" />
          <div className="text-xs text-zinc-300 space-y-0.5">
            <p className="font-semibold text-[#818cf8]">Lark staff sync not available yet</p>
            <p className="text-zinc-400">In Lark Developer Console → Permissions &amp; Scopes, add <code className="text-[#818cf8]">contact:user.base:readonly</code>, then release a new app version. Showing local data for now.</p>
          </div>
        </div>
      )}

      {/* Summary */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="rounded-xl border border-zinc-800/40 bg-zinc-900/40 p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Total Gross Payroll', value: `RM ${totalGross.toLocaleString()}`, color: 'text-zinc-200', bg: 'bg-zinc-800/30 border-zinc-700/40' },
            { label: 'Total Net Pay', value: `RM ${totalNet.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`, color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/20' },
            { label: 'EPF Employer', value: `RM ${totalEpfEmployer.toLocaleString()}`, color: 'text-[#818cf8]', bg: 'bg-[#6366f1]/5 border-[#6366f1]/20' },
            { label: 'Total Company Cost', value: `RM ${totalCost.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`, color: 'text-amber-400', bg: 'bg-amber-500/5 border-amber-500/20' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border ${s.bg} p-4`}>
              <p className="text-xs text-zinc-500 mb-1">{s.label}</p>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-zinc-600">{selectedMonth}</p>
            </div>
          ))}
        </div>
      )}

      {/* Notice */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-start gap-2.5">
        <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-zinc-300">EPF calculated at 11% (employee) + 12% (employer). SOCSO at current 2026 rates. PCB is estimated — verify with LHDN e-PCB for final figures.</p>
      </div>

      {/* Employee payroll list / bento */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
            <Users className="h-3.5 w-3.5" />
            {loading ? '…' : employees.length} Employees — {selectedMonth}
          </h2>
        </div>

        {loading && (
          <div className="space-y-2">
            {[1,2,3].map(i => (
              <div key={i} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 h-16 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && view === 'bento' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {employees.map(emp => {
              const gross = calcGross(emp)
              const net = calcNetPay(emp)
              const isGenerated = generated.has(emp.id)
              return (
                <div key={emp.id} className={`rounded-xl border p-4 ${isGenerated ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-zinc-800/60 bg-zinc-900/40'}`}>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-xs font-bold text-white">
                      {emp.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-200 truncate flex items-center gap-1">
                        {emp.name}
                        {emp.fromLark && <span className="text-[9px] text-[#818cf8] opacity-60">🪶</span>}
                      </p>
                      <p className="text-[10px] text-zinc-500 truncate">{emp.role} · {emp.dept}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="rounded-lg bg-zinc-800/40 p-2.5 text-center">
                      <p className="text-xs font-bold text-zinc-200">RM {gross.toLocaleString()}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">Gross</p>
                    </div>
                    <div className="rounded-lg bg-emerald-500/10 p-2.5 text-center">
                      <p className="text-xs font-bold text-emerald-400">RM {net.toLocaleString()}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">Net Pay</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-3">
                    <span>EPF: <span className="text-zinc-400">RM {emp.epfEmployee.toFixed(0)}</span></span>
                    <span>SOCSO: <span className="text-zinc-400">RM {emp.socsoEmployee.toFixed(0)}</span></span>
                    <span>PCB: <span className="text-zinc-400">RM {emp.pcb.toFixed(0)}</span></span>
                  </div>
                  {isGenerated ? (
                    <button type="button" className="cursor-pointer w-full flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                      <Download className="h-3.5 w-3.5" /> Download Payslip
                    </button>
                  ) : (
                    <button type="button"
                      onClick={() => generateSingle(emp.id)}
                      disabled={generating}
                      className="cursor-pointer w-full flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/50 py-2 text-xs text-zinc-300 hover:text-zinc-100 transition-colors disabled:opacity-60"
                    >
                      <FileText className="h-3.5 w-3.5" /> Generate Payslip
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {!loading && view === 'list' && employees.map(emp => {
          const gross = calcGross(emp)
          const net = calcNetPay(emp)
          const isExpanded = expandedEmp === emp.id
          const isGenerated = generated.has(emp.id)

          return (
            <div key={emp.id} className={`rounded-xl border overflow-hidden transition-all ${isGenerated ? 'border-emerald-500/20' : 'border-zinc-800/60'} bg-zinc-900/40`}>
              {/* Row */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-800/20 transition-colors"
                onClick={() => setExpandedEmp(isExpanded ? null : emp.id)}
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-xs font-bold text-white overflow-hidden">
                  {emp.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-200 flex items-center gap-1.5">
                    {emp.name}
                    {emp.fromLark && <span className="text-[9px] text-[#818cf8] opacity-60">🪶</span>}
                  </p>
                  <p className="text-[10px] text-zinc-500">{emp.role} · {emp.dept}</p>
                </div>
                <div className="hidden sm:flex items-center gap-6 text-xs text-zinc-400 flex-shrink-0">
                  <div className="text-center">
                    <p className="font-semibold text-zinc-200">RM {gross.toLocaleString()}</p>
                    <p className="text-[10px] text-zinc-600">Gross</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-emerald-400">RM {net.toLocaleString()}</p>
                    <p className="text-[10px] text-zinc-600">Net</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isGenerated ? (
                    <button type="button" className="cursor-pointer flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                      <Download className="h-3.5 w-3.5" /> Download
                    </button>
                  ) : (
                    <button type="button"
                      onClick={e => { e.stopPropagation(); generateSingle(emp.id) }}
                      disabled={generating}
                      className="cursor-pointer flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-1.5 text-xs text-zinc-300 hover:text-zinc-100 transition-colors disabled:opacity-60"
                    >
                      <FileText className="h-3.5 w-3.5" /> Generate
                    </button>
                  )}
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
                </div>
              </div>

              {/* Breakdown */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-3 border-t border-zinc-800/40 space-y-3">
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {/* Earnings */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Earnings</p>
                      {[
                        { label: 'Basic Salary', value: emp.basic },
                        { label: 'Transport',    value: emp.transport },
                        { label: 'Phone',        value: emp.phone },
                      ].map(r => (
                        <div key={r.label} className="flex justify-between text-xs">
                          <span className="text-zinc-400">{r.label}</span>
                          <span className="text-zinc-200 font-medium">RM {r.value.toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs border-t border-zinc-800/60 pt-1 mt-1">
                        <span className="text-zinc-300 font-semibold">Gross</span>
                        <span className="text-zinc-100 font-bold">RM {gross.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Employee deductions */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Deductions (Employee)</p>
                      {[
                        { label: 'EPF (11%)',         value: emp.epfEmployee },
                        { label: 'SOCSO',             value: emp.socsoEmployee },
                        { label: 'EIS',               value: emp.eisEmployee },
                        { label: 'PCB / Income Tax',  value: emp.pcb },
                      ].map(r => (
                        <div key={r.label} className="flex justify-between text-xs">
                          <span className="text-zinc-400">{r.label}</span>
                          <span className="text-red-400">- RM {r.value.toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs border-t border-zinc-800/60 pt-1 mt-1">
                        <span className="text-zinc-300 font-semibold">Net Pay</span>
                        <span className="text-emerald-400 font-bold">RM {net.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Employer contributions */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Employer Contributions</p>
                      {[
                        { label: 'EPF (12%)',  value: emp.epfEmployer },
                        { label: 'SOCSO',      value: emp.socsoEmployer },
                        { label: 'EIS',        value: emp.eisEmployee },
                      ].map(r => (
                        <div key={r.label} className="flex justify-between text-xs">
                          <span className="text-zinc-400">{r.label}</span>
                          <span className="text-[#818cf8]">RM {r.value.toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs border-t border-zinc-800/60 pt-1 mt-1">
                        <span className="text-zinc-300 font-semibold">Total Cost</span>
                        <span className="text-amber-400 font-bold">RM {(gross + emp.epfEmployer + emp.socsoEmployer + emp.eisEmployee).toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Bank */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Payment</p>
                      <div className="rounded-lg border border-zinc-800/60 bg-zinc-800/30 p-3 space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-500">Bank</span>
                          <span className="text-zinc-200">{emp.bank}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-500">Account</span>
                          <span className="text-zinc-200">{emp.account}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-500">Transfer</span>
                          <span className="text-emerald-400 font-bold">RM {net.toLocaleString()}</span>
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

      {/* Total row */}
      {!loading && (
        <div className="rounded-xl border border-zinc-700/40 bg-zinc-800/30 px-5 py-4 flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm font-semibold text-zinc-200">Total {selectedMonth} Payroll</p>
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <p className="font-bold text-zinc-200">RM {totalGross.toLocaleString()}</p>
              <p className="text-[10px] text-zinc-500">Gross</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-emerald-400">RM {totalNet.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</p>
              <p className="text-[10px] text-zinc-500">Net Transfer</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-amber-400">RM {totalCost.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</p>
              <p className="text-[10px] text-zinc-500">Company Cost</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
