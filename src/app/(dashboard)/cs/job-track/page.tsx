'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Search, RefreshCw, ChevronDown, ChevronRight,
  FileText, Receipt, CheckCircle2, Clock, AlertCircle,
  TrendingUp, DollarSign, Loader2, Zap, LayoutGrid, List,
  ShieldCheck, ShieldAlert, ShieldX, Database, Briefcase,
  MessageSquare, ExternalLink, Pencil, X, Save, Users, UserCheck,
} from 'lucide-react'

type ViewMode = 'grouped' | 'pipeline' | 'table' | 'live'

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobItem {
  id: string
  itemType: string
  description: string | null
  quantity: number | null
  status: string
  quoteNo: string | null
  qteAmount: number | null
  invoiceNo: string | null
  paymentStatus: string | null
  paymentEta: string | null
  statusNotes: string | null
  invoiceDate: string | null
  invoiceSentStatus: string | null
  designerName: string | null
  designerId: string | null
  isConfirmed: boolean
}

interface ProjectGroup {
  projectId: string
  clientId: string | null
  assignedCSId: string | null
  csName: string | null
  account: string
  client: string
  projectStatus: string
  totalQuoted: number
  totalPaid: number
  totalHalfPaid: number
  totalFullPaid: number
  totalPending: number
  items: JobItem[]
}

interface StaffMember {
  id: string
  name: string
  email: string
  role: string
}

interface Summary {
  totalAccounts: number
  totalItems: number
  grandTotalQuoted: number
  grandTotalPaid: number
  grandTotalFullPaid: number
  grandTotalHalfPaid: number
  grandTotalCollected: number
  grandTotalPending: number
  grandTotalOutstanding: number
}

interface BukkuLineItem {
  description: string
  quantity: number
  unit_price: number
  amount: number
}

interface BukkuDoc {
  id: string
  number: string
  contact_name: string
  date: string
  status: string
  total_amount: number
  due_date?: string
  expiry_date?: string
  line_items: BukkuLineItem[]
}

interface BukkuVerifyData {
  quotations: BukkuDoc[]
  invoices: BukkuDoc[]
  quoteMap: Record<string, { amount: number; status: string; contact: string }>
  invoiceMap: Record<string, { amount: number; status: string; contact: string; dueDate: string | null }>
}

interface EditState {
  item: JobItem
  group: ProjectGroup
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function isJobConfirmed(item: JobItem): boolean {
  return item.isConfirmed || !!(item.quoteNo || item.invoiceNo)
}

function JobKindBadge({ item }: { item: JobItem }) {
  if (isJobConfirmed(item)) {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 className="h-2.5 w-2.5" />
        Confirmed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-blue-500/10 text-blue-400 border border-blue-500/20">
      <Briefcase className="h-2.5 w-2.5" />
      Pitching
    </span>
  )
}

const BILLING_STAGES: Record<string, { label: string; cls: string }> = {
  STARTED:          { label: 'Started',          cls: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30' },
  PARTIALLY_BILLED: { label: 'Partially Billed', cls: 'bg-orange-500/15 text-orange-400 border border-orange-500/30' },
  COMPLETED:        { label: 'Completed',         cls: 'bg-teal-500/15 text-teal-400 border border-teal-500/30' },
  BILLED:           { label: 'Billed',            cls: 'bg-violet-500/15 text-violet-400 border border-violet-500/30' },
  HALF_PAID:        { label: 'Half Paid',         cls: 'bg-lime-500/15 text-lime-400 border border-lime-500/30' },
  FULL_PAID:        { label: 'Full Paid',         cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
  // Legacy values
  PAID:             { label: 'Paid',              cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
  PENDING:          { label: 'Pending',           cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
  PROGRESS:         { label: 'In Progress',       cls: 'bg-blue-500/15 text-blue-400 border border-blue-500/30' },
}

function PayBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-zinc-600 text-xs">—</span>
  const stage = BILLING_STAGES[status]
  if (!stage) return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-zinc-700 text-zinc-400">
      {status}
    </span>
  )
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${stage.cls}`}>
      {(status === 'PAID' || status === 'FULL_PAID') && <CheckCircle2 className="h-2.5 w-2.5" />}
      {status === 'HALF_PAID' && <Clock className="h-2.5 w-2.5" />}
      {status === 'BILLED' && <Receipt className="h-2.5 w-2.5" />}
      {status === 'COMPLETED' && <CheckCircle2 className="h-2.5 w-2.5" />}
      {status === 'STARTED' && <TrendingUp className="h-2.5 w-2.5" />}
      {status === 'PARTIALLY_BILLED' && <Clock className="h-2.5 w-2.5" />}
      {stage.label}
    </span>
  )
}

function InvBadge({ status }: { status: string | null }) {
  if (!status) return null
  return (
    <span className="inline-flex items-center rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-400 border border-violet-500/30">
      {status}
    </span>
  )
}

function BukkuVerifyBadge({
  docNo, docType, localAmount, verifyData,
}: {
  docNo: string | null
  docType: 'quote' | 'invoice'
  localAmount: number | null
  verifyData: BukkuVerifyData | null
}) {
  if (!docNo) return <span className="text-zinc-700 text-[10px]">—</span>
  if (!verifyData) return null

  const map = docType === 'quote' ? verifyData.quoteMap : verifyData.invoiceMap
  const entry = map[docNo]

  if (!entry) {
    return (
      <span title={`${docNo} not found in Bukku`} className="inline-flex items-center gap-0.5 text-[10px] text-rose-400">
        <ShieldX className="h-3 w-3" />Not in Bukku
      </span>
    )
  }
  const amountsMatch = localAmount == null || Math.abs(entry.amount - localAmount) / Math.max(entry.amount, 1) < 0.01
  if (!amountsMatch) {
    return (
      <span title={`Bukku: ${fmt(entry.amount)} vs local: ${fmt(localAmount ?? 0)}`} className="inline-flex items-center gap-0.5 text-[10px] text-amber-400">
        <ShieldAlert className="h-3 w-3" />Mismatch
      </span>
    )
  }
  return (
    <span title={`Verified — ${fmt(entry.amount)} · ${entry.status}`} className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400">
      <ShieldCheck className="h-3 w-3" />Verified
    </span>
  )
}

function BukkuStatusPill({ status }: { status: string }) {
  const s = status.toLowerCase()
  let cls = 'bg-zinc-700 text-zinc-300'
  if (s === 'paid') cls = 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
  else if (s === 'sent' || s === 'partial') cls = 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
  else if (s === 'overdue') cls = 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
  else if (s === 'draft') cls = 'bg-zinc-700 text-zinc-400 border border-zinc-600'
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${cls}`}>
      {status}
    </span>
  )
}

// ─── Edit Drawer ──────────────────────────────────────────────────────────────

interface EditDrawerProps {
  editState: EditState
  csStaff: StaffMember[]
  designers: StaffMember[]
  onClose: () => void
  onSaved: () => void
}

function EditDrawer({ editState, csStaff, designers, onClose, onSaved }: EditDrawerProps) {
  const { item, group } = editState
  const [saving, setSaving] = useState(false)
  const [savingCompany, setSavingCompany] = useState(false)
  const [savingCS, setSavingCS] = useState(false)
  const [error, setError] = useState('')

  // Item fields
  const [description, setDescription] = useState(item.description ?? '')
  const [quoteNo, setQuoteNo] = useState(item.quoteNo ?? '')
  const [invoiceNo, setInvoiceNo] = useState(item.invoiceNo ?? '')
  const [qteAmount, setQteAmount] = useState(item.qteAmount != null ? String(item.qteAmount) : '')
  const [paymentStatus, setPaymentStatus] = useState(item.paymentStatus ?? '')
  const [paymentEta, setPaymentEta] = useState(item.paymentEta ? item.paymentEta.slice(0, 10) : '')
  const [statusNotes, setStatusNotes] = useState(item.statusNotes ?? '')
  const [isConfirmed, setIsConfirmed] = useState(item.isConfirmed || !!(item.quoteNo || item.invoiceNo))
  const [designerId, setDesignerId] = useState(item.designerId ?? '')

  // Project-level fields
  const [companyName, setCompanyName] = useState(group.client)
  const [assignedCSId, setAssignedCSId] = useState(group.assignedCSId ?? '')

  const saveItem = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/cs/job-track/item/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim() || null,
          quoteNo: quoteNo.trim() || null,
          invoiceNo: invoiceNo.trim() || null,
          qteAmount: qteAmount !== '' ? parseFloat(qteAmount) : null,
          paymentStatus: paymentStatus || null,
          paymentEta: paymentEta || null,
          statusNotes: statusNotes.trim() || null,
          isConfirmed,
          assignedDesignerId: designerId || null,
        }),
      })
      const json = await res.json() as { success: boolean; error?: string }
      if (!json.success) throw new Error(json.error ?? 'Save failed')
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const saveCompany = async () => {
    if (!group.clientId || !companyName.trim()) return
    setSavingCompany(true)
    setError('')
    try {
      const res = await fetch(`/api/cs/job-track/client/${group.clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: companyName.trim() }),
      })
      const json = await res.json() as { success: boolean; error?: string }
      if (!json.success) throw new Error(json.error ?? 'Save failed')
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingCompany(false)
    }
  }

  const saveCS = async (newCSId: string) => {
    setSavingCS(true)
    setError('')
    try {
      const res = await fetch(`/api/cs/job-track/project/${group.projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedCSId: newCSId || null }),
      })
      const json = await res.json() as { success: boolean; error?: string }
      if (!json.success) throw new Error(json.error ?? 'Save failed')
      setAssignedCSId(newCSId)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingCS(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-zinc-950 border-l border-zinc-800 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Edit Job Item</h2>
            <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-xs">{item.description ?? 'Untitled item'}</p>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ── Company Name ──────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Company Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                placeholder="Company name"
              />
              <button
                type="button"
                onClick={() => void saveCompany()}
                disabled={savingCompany || !group.clientId || companyName.trim() === group.client}
                className="flex items-center gap-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 px-3 py-2 text-xs text-zinc-200 transition-colors disabled:opacity-40"
              >
                {savingCompany ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Save
              </button>
            </div>
          </div>

          {/* ── Staff Assignment ──────────────────────────────────────────── */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Staff Assignment</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* CS Person (project-level) */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-500 flex items-center gap-1">
                  <UserCheck className="h-3 w-3" />Client Servicing
                </label>
                <div className="flex gap-1.5">
                  <select
                    value={assignedCSId}
                    onChange={e => { setAssignedCSId(e.target.value); void saveCS(e.target.value) }}
                    disabled={savingCS}
                    className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                  >
                    <option value="">— Unassigned —</option>
                    {csStaff.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  {savingCS && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500 self-center flex-shrink-0" />}
                </div>
              </div>
              {/* Designer (item-level) */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-500">Designer</label>
                <select
                  value={designerId}
                  onChange={e => setDesignerId(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">— Unassigned —</option>
                  {designers.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-[10px] text-zinc-600">CS change saves immediately. Designer saves with the main Save button.</p>
          </div>

          {/* ── Description ───────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Project / Item Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
              placeholder="Scope of work or item description"
            />
          </div>

          <div className="border-t border-zinc-800" />

          {/* ── Job Type toggle ────────────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-0.5">Job Type</p>
              <p className="text-sm font-medium text-zinc-200">
                {isConfirmed ? <span className="text-emerald-400">✓ Confirmed Job</span> : <span className="text-blue-400">◎ Pitching Job</span>}
              </p>
            </div>
            {!isConfirmed ? (
              <button
                type="button"
                onClick={() => setIsConfirmed(true)}
                className="flex items-center gap-1.5 rounded-md bg-emerald-700 hover:bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Convert to Confirmed
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsConfirmed(false)}
                className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Move back to Pitching
              </button>
            )}
          </div>

          {!isConfirmed ? (
            /* ── PITCHING fields ──────────────────────────────────────── */
            <div className="rounded-lg border border-blue-900/40 bg-blue-950/20 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Briefcase className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-xs font-semibold text-blue-400">Pitching — Project Status</span>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Project Status</label>
                <select
                  value={paymentStatus}
                  onChange={e => setPaymentStatus(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">— Select Status —</option>
                  <option value="STARTED">Started</option>
                  <option value="PROGRESS">In Progress / Pitching</option>
                  <option value="PENDING">Pending Decision</option>
                  <option value="HALF_PAID">Half Paid</option>
                  <option value="FULL_PAID">Full Paid (Won)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Notes</label>
                <textarea
                  value={statusNotes}
                  onChange={e => setStatusNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
                  placeholder="Pitch notes, client feedback…"
                />
              </div>
            </div>
          ) : (
            /* ── CONFIRMED fields ─────────────────────────────────────── */
            <div className="space-y-4">
              {/* Quotation */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-xs font-semibold text-zinc-300">Quotation</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-500">Quote No.</label>
                    <input
                      type="text"
                      value={quoteNo}
                      onChange={e => setQuoteNo(e.target.value)}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
                      placeholder="e.g. QT-0001"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-500">Quoted Amount (RM)</label>
                    <input
                      type="number"
                      value={qteAmount}
                      onChange={e => setQteAmount(e.target.value)}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              {/* Invoice */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Receipt className="h-3.5 w-3.5 text-violet-400" />
                  <span className="text-xs font-semibold text-zinc-300">Invoice</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-500">Invoice No.</label>
                    <input
                      type="text"
                      value={invoiceNo}
                      onChange={e => setInvoiceNo(e.target.value)}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
                      placeholder="e.g. INV-0001"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-500">Invoice Amount (RM)</label>
                    <input
                      type="number"
                      value={qteAmount}
                      onChange={e => setQteAmount(e.target.value)}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      readOnly={!!quoteNo && !!qteAmount}
                    />
                    {!!quoteNo && !!qteAmount && (
                      <p className="text-[10px] text-zinc-600">Linked from quotation amount</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Project + Billing Status */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
                <span className="text-xs font-semibold text-zinc-300">Status</span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-500">Project Status</label>
                    <select
                      value={paymentStatus}
                      onChange={e => setPaymentStatus(e.target.value)}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">— Select —</option>
                      <option value="STARTED">Started</option>
                      <option value="PROGRESS">In Progress</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-500">Billing Status</label>
                    <select
                      value={paymentStatus}
                      onChange={e => setPaymentStatus(e.target.value)}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">— Select —</option>
                      <option value="STARTED">Started</option>
                      <option value="PARTIALLY_BILLED">Partially Billed</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="BILLED">Billed</option>
                      <option value="HALF_PAID">Half Paid</option>
                      <option value="FULL_PAID">Full Paid</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-500">Payment ETA</label>
                    <input
                      type="date"
                      value={paymentEta}
                      onChange={e => setPaymentEta(e.target.value)}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-500">Qty</label>
                    <input
                      type="number"
                      defaultValue={item.quantity ?? 1}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                      min="1"
                      step="1"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-500">Notes</label>
                  <textarea
                    value={statusNotes}
                    onChange={e => setStatusNotes(e.target.value)}
                    rows={2}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
                    placeholder="Internal notes…"
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-rose-400 bg-rose-500/10 rounded-md px-3 py-2 border border-rose-500/20">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-800 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void saveItem()}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 rounded-md bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function JobTrackPage() {
  const [groups, setGroups] = useState<ProjectGroup[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncingBukku, setSyncingBukku] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyData, setVerifyData] = useState<BukkuVerifyData | null>(null)
  const [verifiedAt, setVerifiedAt] = useState<Date | null>(null)
  const [search, setSearch] = useState('')
  const [payFilter, setPayFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [kindFilter, setKindFilter] = useState<'' | 'pitching' | 'confirmed'>('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [importLog, setImportLog] = useState<string[]>([])
  const [view, setView] = useState<ViewMode>('grouped')
  const [liveBukkuSearch, setLiveBukkuSearch] = useState('')
  const [editState, setEditState] = useState<EditState | null>(null)
  const [csStaff, setCsStaff] = useState<StaffMember[]>([])
  const [designers, setDesigners] = useState<StaffMember[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (payFilter) params.set('paymentStatus', payFilter)
      const res = await fetch(`/api/cs/job-track?${params}`)
      const json = await res.json() as { data: { groups: ProjectGroup[], summary: Summary } }
      setGroups(json.data.groups ?? [])
      setSummary(json.data.summary ?? null)
      if ((json.data.groups ?? []).length <= 5) {
        setExpanded(new Set((json.data.groups ?? []).map(g => g.projectId)))
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [search, payFilter])

  useEffect(() => { void load() }, [load])

  // Load staff lists once on mount
  useEffect(() => {
    fetch('/api/cs/staff')
      .then(r => r.json())
      .then((d: { csStaff?: StaffMember[]; designers?: StaffMember[] }) => {
        setCsStaff(d.csStaff ?? [])
        setDesigners(d.designers ?? [])
      })
      .catch(() => {})
  }, [])

  const runBukkuSync = async () => {
    setSyncingBukku(true)
    setImportLog([])
    try {
      const res = await fetch('/api/bukku/sync-job-track', { method: 'POST' })
      const json = await res.json() as { success: boolean, log: string[] }
      setImportLog(json.log ?? [])
      await load()
    } finally {
      setSyncingBukku(false)
    }
  }

  const runVerify = async () => {
    setVerifying(true)
    try {
      const res = await fetch('/api/bukku/verify-jobs')
      const json = await res.json() as { success: boolean, data?: BukkuVerifyData }
      if (json.success && json.data) {
        setVerifyData(json.data)
        setVerifiedAt(new Date())
      }
    } finally {
      setVerifying(false)
    }
  }

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const expandAll = () => setExpanded(new Set(groups.map(g => g.projectId)))
  const collapseAll = () => setExpanded(new Set())

  const openEdit = (item: JobItem, group: ProjectGroup) => setEditState({ item, group })

  const displayGroups = groups
    .map(g => ({
      ...g,
      items: g.items.filter(i => {
        if (typeFilter && i.itemType !== typeFilter) return false
        if (kindFilter === 'pitching' && isJobConfirmed(i)) return false
        if (kindFilter === 'confirmed' && !isJobConfirmed(i)) return false
        return true
      }),
    }))
    .filter(g => g.items.length > 0)

  const liveDocs = verifyData
    ? [
        ...verifyData.quotations.map(d => ({ ...d, docType: 'quotation' as const })),
        ...verifyData.invoices.map(d => ({ ...d, docType: 'invoice' as const })),
      ].filter(d => {
        if (!liveBukkuSearch) return true
        const q = liveBukkuSearch.toLowerCase()
        return d.contact_name.toLowerCase().includes(q) || d.number.toLowerCase().includes(q)
      })
    : []

  const liveByContact = liveDocs.reduce<Record<string, typeof liveDocs>>((acc, d) => {
    if (!acc[d.contact_name]) acc[d.contact_name] = []
    acc[d.contact_name].push(d)
    return acc
  }, {})

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {editState && (
        <EditDrawer
          editState={editState}
          csStaff={csStaff}
          designers={designers}
          onClose={() => setEditState(null)}
          onSaved={() => void load()}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Job Track</h1>
          <p className="text-sm text-zinc-500 mt-0.5">All active accounts — quotations, invoices &amp; payment status</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-800/60 p-0.5">
            {(['grouped', 'pipeline', 'table', 'live'] as ViewMode[]).map((v, i) => {
              const icons = [LayoutGrid, TrendingUp, List, Database]
              const Icon = icons[i]
              const titles = ['Grouped view', 'Billing Pipeline', 'Table view', 'Live Bukku']
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setView(v)
                    if (v === 'live' && !verifyData) void runVerify()
                  }}
                  title={titles[i]}
                  className={`rounded-md p-1.5 transition-colors ${view === v ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => void runVerify()}
            disabled={verifying}
            className="flex items-center gap-1.5 rounded-md bg-indigo-700 hover:bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-60"
          >
            {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            {verifying ? 'Verifying…' : 'Verify with Bukku'}
          </button>
          {verifiedAt && !verifying && (
            <span className="text-[10px] text-zinc-500">
              Verified {verifiedAt.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void runBukkuSync()}
            disabled={syncingBukku}
            className="flex items-center gap-1.5 rounded-md bg-emerald-700 hover:bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-60"
          >
            {syncingBukku ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            {syncingBukku ? 'Syncing…' : 'Sync from Bukku'}
          </button>
        </div>
      </div>

      {/* Sync log */}
      {importLog.length > 0 && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-xs text-zinc-400 max-h-40 overflow-y-auto space-y-0.5">
          {importLog.map((line, i) => (
            <div key={i} className={line.startsWith('✓') ? 'text-emerald-400' : line.startsWith('✗') ? 'text-rose-400' : 'text-amber-400'}>{line}</div>
          ))}
        </div>
      )}

      {/* ── Live Bukku View ──────────────────────────────────────────────── */}
      {view === 'live' ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search contact or document number…"
                value={liveBukkuSearch}
                onChange={e => setLiveBukkuSearch(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#6366f1]"
              />
            </div>
            {verifyData && (
              <span className="text-xs text-zinc-500">
                {verifyData.quotations.length} quotations · {verifyData.invoices.length} invoices from Bukku
              </span>
            )}
          </div>

          {verifying ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
              <span className="ml-3 text-sm text-zinc-500">Fetching live data from Bukku…</span>
            </div>
          ) : !verifyData ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
              <Database className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">Click <strong className="text-zinc-300">Verify with Bukku</strong> to load live data.</p>
            </div>
          ) : Object.keys(liveByContact).length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
              <p className="text-zinc-500 text-sm">No documents match your search.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(liveByContact)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([contact, docs]) => (
                  <div key={contact} className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 bg-zinc-800/40 border-b border-zinc-800">
                      <div className="h-7 w-7 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-indigo-400 text-xs font-bold">{contact.charAt(0).toUpperCase()}</span>
                      </div>
                      <span className="font-semibold text-zinc-100 text-sm">{contact}</span>
                      <span className="text-xs text-zinc-500">{docs.length} document{docs.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="divide-y divide-zinc-800/60">
                      {docs.sort((a, b) => b.date.localeCompare(a.date)).map(doc => (
                        <div key={`${doc.docType}-${doc.id}`} className="p-4">
                          <div className="flex items-center gap-3 mb-3">
                            {doc.docType === 'quotation'
                              ? <FileText className="h-4 w-4 text-blue-400 flex-shrink-0" />
                              : <Receipt className="h-4 w-4 text-violet-400 flex-shrink-0" />}
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="font-mono text-sm font-semibold text-zinc-100">{doc.number}</span>
                              <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                                {doc.docType === 'quotation' ? 'Quotation' : 'Invoice'}
                              </span>
                              <BukkuStatusPill status={doc.status} />
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-semibold text-zinc-100">{fmt(doc.total_amount)}</p>
                              <p className="text-[10px] text-zinc-500">
                                {new Date(doc.date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                                {doc.due_date && <> · Due {new Date(doc.due_date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}</>}
                              </p>
                            </div>
                            <a
                              href={`/api/bukku/redirect?type=${doc.docType}&no=${encodeURIComponent(doc.number)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0 text-zinc-500 hover:text-indigo-400 transition-colors"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                          {doc.line_items?.length > 0 && (
                            <div className="rounded-lg border border-zinc-800 overflow-hidden">
                              <div className="grid grid-cols-[minmax(0,1fr)_50px_90px_90px] gap-2 px-3 py-1.5 bg-zinc-800/60 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                                <span>Description</span>
                                <span className="text-center">Qty</span>
                                <span className="text-right">Unit Price</span>
                                <span className="text-right">Amount</span>
                              </div>
                              {doc.line_items.map((li, idx) => (
                                <div key={idx} className="grid grid-cols-[minmax(0,1fr)_50px_90px_90px] gap-2 px-3 py-2 border-t border-zinc-800/60 hover:bg-zinc-800/20 items-start">
                                  <p className="text-xs text-zinc-300 leading-snug">{li.description}</p>
                                  <p className="text-xs text-zinc-400 text-center">{li.quantity}</p>
                                  <p className="text-xs text-zinc-400 text-right">{li.unit_price.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                  <p className="text-xs text-zinc-200 text-right font-medium">{li.amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Summary cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Total Quoted', value: fmt(summary.grandTotalQuoted), icon: FileText, color: 'text-blue-400' },
                { label: 'Full Paid', value: fmt(summary.grandTotalFullPaid), icon: CheckCircle2, color: 'text-emerald-400' },
                { label: 'Half Paid', value: fmt(summary.grandTotalHalfPaid), icon: Clock, color: 'text-lime-400' },
                { label: 'Collection', value: fmt(summary.grandTotalCollected), icon: DollarSign, color: 'text-cyan-400' },
                { label: 'Pending', value: fmt(summary.grandTotalPending), icon: Clock, color: 'text-amber-400' },
                { label: 'Outstanding', value: fmt(summary.grandTotalOutstanding), icon: AlertCircle, color: 'text-rose-400' },
              ].map(card => (
                <div key={card.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-500">{card.label}</span>
                    <card.icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                  <p className={`text-lg font-semibold ${card.color}`}>{card.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search company, project, quote or invoice…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#6366f1]"
              />
            </div>
            <select
              value={payFilter}
              onChange={e => setPayFilter(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[#6366f1]"
            >
              <option value="">All Billing</option>
              <option value="STARTED">Started</option>
              <option value="PARTIALLY_BILLED">Partially Billed</option>
              <option value="COMPLETED">Completed</option>
              <option value="BILLED">Billed</option>
              <option value="HALF_PAID">Half Paid</option>
              <option value="FULL_PAID">Full Paid</option>
              <option value="UNPAID">No Status</option>
            </select>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[#6366f1]"
            >
              <option value="">All Types</option>
              <option value="BANNER">Banner</option>
              <option value="BROCHURE">Brochure</option>
              <option value="LOGO">Logo / Branding</option>
              <option value="SOCIAL">Social Media</option>
              <option value="PRINT">Print</option>
              <option value="THREE_D">3D</option>
              <option value="VIDEO">Video / Animation</option>
              <option value="OTHER">Other</option>
            </select>
            <select
              value={kindFilter}
              onChange={e => setKindFilter(e.target.value as '' | 'pitching' | 'confirmed')}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[#6366f1]"
            >
              <option value="">All Jobs</option>
              <option value="pitching">Pitching only</option>
              <option value="confirmed">Confirmed only</option>
            </select>
            <div className="flex items-center gap-1 ml-auto">
              <button type="button" onClick={expandAll} className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1">Expand all</button>
              <span className="text-zinc-700">|</span>
              <button type="button" onClick={collapseAll} className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1">Collapse all</button>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
            </div>
          ) : displayGroups.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
              <DollarSign className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">
                {groups.length === 0
                  ? <>No job data yet. Click <strong className="text-zinc-300">Sync from Bukku</strong> to import.</>
                  : 'No items match your filters.'}
              </p>
            </div>
          ) : view === 'pipeline' ? (
            /* ── Billing Pipeline view ───────────────────────────────── */
            (() => {
              // Map item status + revision count to a creative stage label
              const getCreativeStage = (item: JobItem): string => {
                if (item.status === 'FA_SIGNED') return 'FA'
                if (item.status === 'APPROVED' || item.status === 'DELIVERED') return 'FA'
                if (item.status === 'PENDING' && (!item.quantity || item.quantity === 0)) return 'Brief'
                if (item.status === 'PENDING') return 'Brief'
                if (item.status === 'IN_PROGRESS') return 'Started'
                if (item.status === 'WIP_UPLOADED' || item.status === 'QC_REVIEW') {
                  const rev = Number((item as unknown as Record<string, unknown>).revisionCount) || 0
                  return rev === 0 ? 'V1' : `V${rev}`
                }
                return 'Brief'
              }

              // Collect all items across all groups with their project info
              type PipelineItem = JobItem & { client: string; account: string }
              const allItems: PipelineItem[] = displayGroups.flatMap(g =>
                g.items.map(i => ({ ...i, client: g.client, account: g.account }))
              )

              // Payment buckets
              const buckets = [
                { key: 'HALF_PAID', label: 'Half Paid', color: 'lime', items: allItems.filter(i => i.paymentStatus === 'HALF_PAID') },
                { key: 'FULL_PAID', label: 'Full Paid', color: 'emerald', items: allItems.filter(i => i.paymentStatus === 'FULL_PAID' || i.paymentStatus === 'PAID') },
                { key: 'COLLECTED', label: 'Collected', color: 'cyan', items: [] as PipelineItem[] },
              ]
              // "Collected" = items that are FULL_PAID + FA signed off
              buckets[2].items = allItems.filter(i =>
                (i.paymentStatus === 'FULL_PAID' || i.paymentStatus === 'PAID') &&
                (i.status === 'FA_SIGNED' || i.status === 'DELIVERED' || i.status === 'APPROVED')
              )
              // Remove collected items from Full Paid so no duplicates
              const collectedIds = new Set(buckets[2].items.map(i => i.id))
              buckets[1].items = buckets[1].items.filter(i => !collectedIds.has(i.id))

              // Creative stages order
              const STAGES = ['Brief', 'Started', 'V1', 'V2', 'V3', 'V4', 'V5', 'FA']

              const colorMap: Record<string, { bg: string; border: string; text: string; headerBg: string }> = {
                lime:    { bg: 'bg-lime-500/5',    border: 'border-lime-500/30',    text: 'text-lime-400',    headerBg: 'bg-lime-500/10' },
                emerald: { bg: 'bg-emerald-500/5',  border: 'border-emerald-500/30',  text: 'text-emerald-400',  headerBg: 'bg-emerald-500/10' },
                cyan:    { bg: 'bg-cyan-500/5',    border: 'border-cyan-500/30',    text: 'text-cyan-400',    headerBg: 'bg-cyan-500/10' },
              }

              return (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {buckets.map(bucket => {
                    const c = colorMap[bucket.color]
                    // Group items by creative stage
                    const stageGroups = STAGES.map(stage => ({
                      stage,
                      items: bucket.items.filter(i => getCreativeStage(i) === stage),
                    })).filter(sg => sg.items.length > 0)

                    const totalAmt = bucket.items.reduce((s, i) => s + (i.qteAmount ?? 0), 0)

                    return (
                      <div key={bucket.key} className={`rounded-xl border ${c.border} ${c.bg} overflow-hidden`}>
                        {/* Bucket header */}
                        <div className={`${c.headerBg} px-4 py-3 border-b ${c.border}`}>
                          <div className="flex items-center justify-between">
                            <h3 className={`text-sm font-bold ${c.text}`}>{bucket.label}</h3>
                            <span className={`text-xs font-semibold ${c.text}`}>{bucket.items.length} items</span>
                          </div>
                          <p className={`text-lg font-bold ${c.text} mt-1`}>{fmt(totalAmt)}</p>
                        </div>

                        {/* Stage groups */}
                        <div className="p-3 space-y-3">
                          {stageGroups.length === 0 ? (
                            <p className="text-xs text-zinc-600 text-center py-4">No items</p>
                          ) : (
                            stageGroups.map(sg => (
                              <div key={sg.stage}>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{sg.stage}</span>
                                  <span className="text-[10px] text-zinc-600">({sg.items.length})</span>
                                  <div className="flex-1 h-px bg-zinc-800" />
                                </div>
                                <div className="space-y-1.5">
                                  {sg.items.map(item => (
                                    <div key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                          <p className="text-xs font-medium text-zinc-200 truncate">{item.client}</p>
                                          <p className="text-[10px] text-zinc-500 truncate">{item.description || item.account}</p>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                          <p className="text-xs font-semibold text-zinc-300">{fmt(item.qteAmount ?? 0)}</p>
                                          <PayBadge status={item.paymentStatus} />
                                        </div>
                                      </div>
                                      {item.invoiceNo && (
                                        <p className="text-[10px] text-violet-400 mt-1">INV: {item.invoiceNo}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()
          ) : view === 'table' ? (
            /* ── Flat table view ─────────────────────────────────────── */
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <div className="grid grid-cols-[160px_minmax(0,1fr)_50px_140px_140px_100px_90px_110px_36px] gap-2 px-4 py-2.5 bg-zinc-800/60 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 border-b border-zinc-800">
                <span>Company</span>
                <span>Project + Purpose</span>
                <span className="text-center">Qty</span>
                <span>Quote No.</span>
                <span>Invoice No.</span>
                <span className="text-right">Amount</span>
                <span className="text-center">Payment</span>
                <span>ETA</span>
                <span />
              </div>
              {displayGroups.flatMap(g => g.items.map(item => ({ ...item, account: g.account, client: g.client, _group: g }))).map(row => (
                <div
                  key={row.id}
                  className="grid grid-cols-[160px_minmax(0,1fr)_50px_140px_140px_100px_90px_110px_36px] gap-2 px-4 py-2.5 border-b border-zinc-800/60 hover:bg-zinc-800/20 items-start transition-colors"
                >
                  <div>
                    <p className="text-xs font-semibold text-zinc-300 truncate">{row.client}</p>
                    <p className="text-[10px] text-zinc-500 truncate">{row.account.replace(/-/g, ' ')}</p>
                    <JobKindBadge item={row} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-zinc-200 text-xs leading-snug line-clamp-2">{row.description ?? '—'}</p>
                    {!isJobConfirmed(row) && (
                      <p className="text-blue-400/70 text-[10px] mt-0.5 flex items-center gap-1">
                        <MessageSquare className="h-2.5 w-2.5" />
                        Ask client servicing for job brief
                      </p>
                    )}
                    {row.statusNotes && <p className="text-zinc-600 text-[10px] mt-0.5 line-clamp-1">{row.statusNotes}</p>}
                  </div>
                  <div className="text-center">
                    <span className="text-xs text-zinc-400">{row.quantity ?? 1}</span>
                  </div>
                  <div className="space-y-1">
                    {row.quoteNo ? (
                      <a href={`/api/bukku/redirect?type=quotation&no=${encodeURIComponent(row.quoteNo)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 group/link hover:text-indigo-400 transition-colors">
                        <FileText className="h-3 w-3 text-zinc-500 group-hover/link:text-indigo-400 flex-shrink-0" />
                        <span className="text-xs text-zinc-300 group-hover/link:text-indigo-400 font-mono underline-offset-2 group-hover/link:underline">{row.quoteNo}</span>
                      </a>
                    ) : <span className="text-zinc-700 text-xs">—</span>}
                    <BukkuVerifyBadge docNo={row.quoteNo} docType="quote" localAmount={row.qteAmount} verifyData={verifyData} />
                  </div>
                  <div className="space-y-1">
                    {row.invoiceNo ? (
                      <a href={`/api/bukku/redirect?type=invoice&no=${encodeURIComponent(row.invoiceNo)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 group/link hover:text-indigo-400 transition-colors">
                        <Receipt className="h-3 w-3 text-zinc-500 group-hover/link:text-indigo-400 flex-shrink-0" />
                        <span className="text-xs text-zinc-300 group-hover/link:text-indigo-400 font-mono underline-offset-2 group-hover/link:underline">{row.invoiceNo}</span>
                      </a>
                    ) : <span className="text-zinc-700 text-xs">—</span>}
                    <BukkuVerifyBadge docNo={row.invoiceNo} docType="invoice" localAmount={row.qteAmount} verifyData={verifyData} />
                    {row.invoiceSentStatus && <InvBadge status={row.invoiceSentStatus} />}
                  </div>
                  <div className="text-right">
                    {row.qteAmount != null ? (
                      <span className="text-xs font-medium text-zinc-200">
                        RM {row.qteAmount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    ) : <span className="text-zinc-700 text-xs">—</span>}
                  </div>
                  <div className="flex justify-center">
                    <PayBadge status={row.paymentStatus} />
                  </div>
                  <div>
                    {row.paymentEta ? (
                      <span className="text-xs text-zinc-400">
                        {new Date(row.paymentEta).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    ) : row.invoiceDate ? (
                      <span className="text-xs text-zinc-500">
                        Inv: {new Date(row.invoiceDate).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
                      </span>
                    ) : <span className="text-zinc-700 text-xs">—</span>}
                  </div>
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => openEdit(row, row._group)}
                      className="p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-700 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ── Grouped accordion view ────────────────────────────── */
            <div className="space-y-2">
              {displayGroups.map(group => {
                const isOpen = expanded.has(group.projectId)
                const fullPaidCount = group.items.filter(i => i.paymentStatus === 'FULL_PAID' || i.paymentStatus === 'PAID').length
                const halfPaidCount = group.items.filter(i => i.paymentStatus === 'HALF_PAID').length
                const pendingCount = group.items.filter(i => i.paymentStatus === 'PENDING').length
                const pitchingCount = group.items.filter(i => !isJobConfirmed(i)).length
                const confirmedCount = group.items.filter(i => isJobConfirmed(i)).length

                return (
                  <div key={group.projectId} className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggle(group.projectId)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/50 transition-colors text-left"
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4 text-zinc-500 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-zinc-500 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-zinc-100 text-sm">{group.client}</span>
                          <span className="text-xs text-zinc-500 font-mono">{group.account}</span>
                          {group.csName && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded px-1.5 py-0.5">
                              <UserCheck className="h-2.5 w-2.5" />{group.csName}
                            </span>
                          )}
                          {pitchingCount > 0 && (
                            <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded px-1.5 py-0.5">{pitchingCount} pitching</span>
                          )}
                          {confirmedCount > 0 && (
                            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">{confirmedCount} confirmed</span>
                          )}
                          {fullPaidCount > 0 && (
                            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">{fullPaidCount} full paid</span>
                          )}
                          {halfPaidCount > 0 && (
                            <span className="text-[10px] text-lime-400 bg-lime-500/10 border border-lime-500/20 rounded px-1.5 py-0.5">{halfPaidCount} half paid</span>
                          )}
                          {pendingCount > 0 && (
                            <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">{pendingCount} pending</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-6 flex-shrink-0 text-right">
                        <div>
                          <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Quoted</p>
                          <p className="text-sm font-medium text-zinc-300">{fmt(group.totalQuoted)}</p>
                        </div>
                        {group.totalFullPaid > 0 && (
                          <div>
                            <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Full Paid</p>
                            <p className="text-sm font-medium text-emerald-400">{fmt(group.totalFullPaid)}</p>
                          </div>
                        )}
                        {group.totalHalfPaid > 0 && (
                          <div>
                            <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Half Paid</p>
                            <p className="text-sm font-medium text-lime-400">{fmt(group.totalHalfPaid)}</p>
                          </div>
                        )}
                        {group.totalFullPaid === 0 && group.totalHalfPaid === 0 && (
                          <div>
                            <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Collected</p>
                            <p className="text-sm font-medium text-emerald-400">{fmt(group.totalPaid)}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Pending</p>
                          <p className="text-sm font-medium text-amber-400">{fmt(group.totalPending)}</p>
                        </div>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-zinc-800">
                        <div className="grid grid-cols-[minmax(0,1fr)_44px_140px_140px_100px_100px_110px_36px] gap-2 px-4 py-2 bg-zinc-800/40 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                          <span>Project / Purpose</span>
                          <span className="text-center">Qty</span>
                          <span>Quote No.</span>
                          <span>Invoice No.</span>
                          <span className="text-right">Amount</span>
                          <span className="text-center">Payment</span>
                          <span>ETA</span>
                          <span />
                        </div>

                        {group.items.map(item => (
                          <div
                            key={item.id}
                            className={`grid grid-cols-[minmax(0,1fr)_44px_140px_140px_100px_100px_110px_36px] gap-2 px-4 py-2.5 border-t items-start text-sm transition-colors
                              ${!isJobConfirmed(item) ? 'border-blue-900/30 hover:bg-blue-950/20 bg-blue-950/10' : 'border-zinc-800/60 hover:bg-zinc-800/20'}`}
                          >
                            <div className="min-w-0 space-y-0.5">
                              <JobKindBadge item={item} />
                              <p className="text-zinc-200 text-xs leading-snug line-clamp-2">{item.description ?? '—'}</p>
                              {!isJobConfirmed(item) && (
                                <p className="text-blue-400/70 text-[10px] flex items-center gap-1">
                                  <MessageSquare className="h-2.5 w-2.5" />
                                  Ask client servicing for job brief
                                </p>
                              )}
                              {item.designerName && <p className="text-indigo-400 text-[10px]">Designer: {item.designerName}</p>}
                              {item.statusNotes && <p className="text-zinc-600 text-[10px] line-clamp-1">{item.statusNotes}</p>}
                            </div>

                            <div className="text-center">
                              <span className="text-xs text-zinc-400">{item.quantity ?? 1}</span>
                            </div>

                            <div className="space-y-1">
                              {item.quoteNo ? (
                                <a href={`/api/bukku/redirect?type=quotation&no=${encodeURIComponent(item.quoteNo)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 group/link hover:text-indigo-400 transition-colors">
                                  <FileText className="h-3 w-3 text-zinc-500 group-hover/link:text-indigo-400 flex-shrink-0" />
                                  <span className="text-xs text-zinc-300 group-hover/link:text-indigo-400 font-mono underline-offset-2 group-hover/link:underline">{item.quoteNo}</span>
                                </a>
                              ) : (
                                isJobConfirmed(item)
                                  ? <span className="text-zinc-700 text-xs">—</span>
                                  : <span className="text-blue-400/50 text-[10px]">Pending quote</span>
                              )}
                              <BukkuVerifyBadge docNo={item.quoteNo} docType="quote" localAmount={item.qteAmount} verifyData={verifyData} />
                            </div>

                            <div className="space-y-1">
                              {item.invoiceNo ? (
                                <a href={`/api/bukku/redirect?type=invoice&no=${encodeURIComponent(item.invoiceNo)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 group/link hover:text-indigo-400 transition-colors">
                                  <Receipt className="h-3 w-3 text-zinc-500 group-hover/link:text-indigo-400 flex-shrink-0" />
                                  <span className="text-xs text-zinc-300 group-hover/link:text-indigo-400 font-mono underline-offset-2 group-hover/link:underline">{item.invoiceNo}</span>
                                </a>
                              ) : (
                                isJobConfirmed(item)
                                  ? <span className="text-zinc-700 text-xs">—</span>
                                  : <span className="text-blue-400/50 text-[10px]">Pending invoice</span>
                              )}
                              <BukkuVerifyBadge docNo={item.invoiceNo} docType="invoice" localAmount={item.qteAmount} verifyData={verifyData} />
                              {item.invoiceSentStatus && <InvBadge status={item.invoiceSentStatus} />}
                            </div>

                            <div className="text-right">
                              {item.qteAmount != null ? (
                                <span className="text-xs font-medium text-zinc-200">
                                  RM {item.qteAmount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              ) : <span className="text-zinc-700 text-xs">—</span>}
                            </div>

                            <div className="flex justify-center">
                              <PayBadge status={item.paymentStatus} />
                            </div>

                            <div>
                              {item.paymentEta ? (
                                <span className="text-xs text-zinc-400">
                                  {new Date(item.paymentEta).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                              ) : item.invoiceDate ? (
                                <span className="text-xs text-zinc-500">
                                  Inv: {new Date(item.invoiceDate).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
                                </span>
                              ) : <span className="text-zinc-700 text-xs">—</span>}
                            </div>

                            <div className="flex justify-center">
                              <button
                                type="button"
                                onClick={() => openEdit(item, group)}
                                className="p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-700 transition-colors"
                                title="Edit"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {summary && !loading && (
            <p className="text-xs text-zinc-600 text-center">
              {summary.totalAccounts} accounts · {summary.totalItems} line items
            </p>
          )}
        </>
      )}
    </div>
  )
}
