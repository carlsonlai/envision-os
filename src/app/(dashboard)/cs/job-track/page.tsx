'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Search, RefreshCw, ChevronDown, ChevronRight,
  FileText, Receipt, CheckCircle2, Clock, AlertCircle,
  TrendingUp, DollarSign, Loader2, Zap, LayoutGrid, List,
  ShieldCheck, ShieldAlert, ShieldX, Database, Briefcase,
  MessageSquare, ExternalLink, Pencil, X, Save, Users, UserCheck,
  FolderKanban, AlertTriangle, Activity, Trash2,
} from 'lucide-react'

type ViewMode = 'grouped' | 'pipeline' | 'table' | 'live' | 'kanban' | 'activity'

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

interface ProjectMember {
  userId: string
  name: string
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
  members: ProjectMember[]
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

// ─── Kanban Types ────────────────────────────────────────────────────────────

type KanbanProjectStatus = 'PROJECTED' | 'ONGOING' | 'COMPLETED' | 'BILLED' | 'PAID'

interface KanbanProject {
  id: string
  code: string
  status: KanbanProjectStatus
  quotedAmount: number
  billedAmount: number
  paidAmount: number
  deadline: string | null
  client?: { companyName: string; contactPerson: string; email: string }
  updatedAt: string
}

const KANBAN_COLUMNS: {
  status: KanbanProjectStatus
  label: string
  icon: React.ElementType
  accent: string
  borderColor: string
  bgColor: string
  textColor: string
  dropHighlight: string
}[] = [
  { status: 'PROJECTED', label: 'Projected', icon: Clock,          accent: 'text-zinc-400',    borderColor: 'border-zinc-700/60',    bgColor: 'bg-zinc-800/30',    textColor: 'text-zinc-400',    dropHighlight: 'ring-2 ring-zinc-400/50 bg-zinc-800/60' },
  { status: 'ONGOING',   label: 'Ongoing',   icon: Zap,            accent: 'text-blue-400',    borderColor: 'border-blue-500/30',    bgColor: 'bg-blue-500/5',     textColor: 'text-blue-300',    dropHighlight: 'ring-2 ring-blue-400/50 bg-blue-500/10' },
  { status: 'COMPLETED', label: 'Completed', icon: AlertTriangle,  accent: 'text-amber-400',   borderColor: 'border-amber-500/30',   bgColor: 'bg-amber-500/5',    textColor: 'text-amber-300',   dropHighlight: 'ring-2 ring-amber-400/50 bg-amber-500/10' },
  { status: 'BILLED',    label: 'Billed',    icon: FileText,       accent: 'text-violet-400',  borderColor: 'border-violet-500/30',  bgColor: 'bg-violet-500/5',   textColor: 'text-violet-300',  dropHighlight: 'ring-2 ring-violet-400/50 bg-violet-500/10' },
  { status: 'PAID',      label: 'Paid',      icon: CheckCircle2,   accent: 'text-emerald-400', borderColor: 'border-emerald-500/30', bgColor: 'bg-emerald-500/5',  textColor: 'text-emerald-300', dropHighlight: 'ring-2 ring-emerald-400/50 bg-emerald-500/10' },
]

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

// ─── Activity Helpers ─────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  STATUS_CHANGE: 'Status Changed',
  DESIGNER_ASSIGNED: 'Designer Assigned',
  FILE_UPLOADED: 'File Uploaded',
  QC_SUBMITTED: 'QC Submitted',
  QC_APPROVED: 'QC Approved',
  QC_REJECTED: 'QC Rejected',
  REVISION_UPLOADED: 'Revision Uploaded',
  REVISION_APPROVED: 'Revision Approved',
  REVISION_REJECTED: 'Revision Rejected',
  CLIENT_APPROVED: 'Client Approved',
  CLIENT_CONFIRMED: 'Client Confirmed',
  BRIEF_CREATED: 'Brief Created',
  BRIEF_UPDATED: 'Brief Updated',
  FA_CREATED: 'FA Created',
  FA_SIGNOFF: 'FA Signed Off',
  HANDOVER_COMPLETED: 'Handover Done',
  PROJECT_CREATED: 'Project Created',
  POST_DELIVERY_SEQUENCE_STARTED: 'Post-Delivery Started',
  REFERRAL_CONVERSION: 'Referral Converted',
  AUTO_ASSIGNED: 'Auto-Assigned',
  PAYMENT_STATUS_CHANGE: 'Payment Updated',
}

function formatActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, ' ')
}

function getActionColor(action: string): string {
  if (action.includes('APPROVED') || action.includes('SIGNOFF') || action === 'CLIENT_CONFIRMED')
    return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
  if (action.includes('REJECTED'))
    return 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
  if (action.includes('UPLOADED') || action.includes('REVISION'))
    return 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
  if (action.includes('ASSIGNED') || action === 'AUTO_ASSIGNED')
    return 'bg-violet-500/15 text-violet-400 border border-violet-500/25'
  if (action.includes('STATUS') || action.includes('PAYMENT'))
    return 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
  if (action.includes('CREATED') || action.includes('BRIEF'))
    return 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25'
  if (action.includes('HANDOVER') || action.includes('DELIVERY'))
    return 'bg-teal-500/15 text-teal-400 border border-teal-500/25'
  return 'bg-zinc-700/60 text-zinc-400 border border-zinc-600/40'
}

const ROLE_MAP: Record<string, string> = {
  ADMIN: 'Admin',
  CREATIVE_DIRECTOR: 'CD',
  SENIOR_ART_DIRECTOR: 'Sr AD',
  JUNIOR_ART_DIRECTOR: 'Jr AD',
  GRAPHIC_DESIGNER: 'Designer',
  JUNIOR_DESIGNER: 'Jr Designer',
  DESIGNER_3D: '3D Designer',
  MULTIMEDIA_DESIGNER: 'Multimedia',
  DIGITAL_MARKETING: 'Digital Mktg',
  CLIENT_SERVICING: 'CS',
  SALES: 'Sales',
}

function formatRole(role: string): string {
  return ROLE_MAP[role] ?? role.replace(/_/g, ' ')
}

function renderMetadata(meta: Record<string, unknown>): React.ReactNode[] {
  const SKIP_KEYS = new Set(['scheduledViaCron', 'scheduledAt'])
  const nodes: React.ReactNode[] = []
  for (const [k, v] of Object.entries(meta)) {
    if (SKIP_KEYS.has(k) || v == null || v === '') continue
    const label = k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()
    const val = typeof v === 'object' ? JSON.stringify(v) : String(v)
    if (val.length > 80) continue // skip long blobs
    nodes.push(
      <span key={k} className="inline-flex items-center rounded bg-zinc-700/50 px-1.5 py-0.5 text-[10px] text-zinc-400">
        <span className="text-zinc-500 mr-1">{label}:</span> {val}
      </span>
    )
  }
  return nodes
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
  const [scopeFilter, setScopeFilter] = useState<'all' | 'mine'>('all')

  // ── Delete state ────────────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'item' | 'project'; id: string; label: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Kanban state ─────────────────────────────────────────────────────────
  const [kanbanProjects, setKanbanProjects] = useState<KanbanProject[]>([])
  const [kanbanLoading, setKanbanLoading] = useState(false)
  const [kanbanDragging, setKanbanDragging] = useState('')
  const [kanbanOverCol, setKanbanOverCol] = useState<KanbanProjectStatus | null>(null)
  const kanbanDragCounters = useRef<Partial<Record<KanbanProjectStatus, number>>>({})

  // ── Activity state ──────────────────────────────────────────────────────
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
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([])
  const [activityLoading, setActivityLoading] = useState(false)

  const loadActivity = useCallback(async () => {
    setActivityLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (scopeFilter === 'mine') params.set('scope', 'mine')
      const res = await fetch(`/api/cs/activity?${params}`)
      const json = await res.json() as { data?: ActivityItem[] }
      setActivityItems(json.data ?? [])
    } catch {
      // silent
    } finally {
      setActivityLoading(false)
    }
  }, [scopeFilter])

  const loadKanban = useCallback(async () => {
    setKanbanLoading(true)
    try {
      const res = await fetch('/api/projects')
      const data = await res.json()
      setKanbanProjects(data.data ?? [])
    } catch {
      // silent
    } finally {
      setKanbanLoading(false)
    }
  }, [])

  const handleKanbanDrop = async (targetStatus: KanbanProjectStatus) => {
    if (!kanbanDragging || !kanbanOverCol) return
    const project = kanbanProjects.find(p => p.id === kanbanDragging)
    if (!project || project.status === targetStatus) {
      setKanbanDragging('')
      setKanbanOverCol(null)
      return
    }
    const prev = kanbanProjects
    setKanbanProjects(ps => ps.map(p => p.id === kanbanDragging ? { ...p, status: targetStatus } : p))
    setKanbanDragging('')
    setKanbanOverCol(null)
    kanbanDragCounters.current = {}
    try {
      const res = await fetch(`/api/projects/${kanbanDragging}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      })
      if (!res.ok) throw new Error('Failed')
    } catch {
      setKanbanProjects(prev)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (payFilter) params.set('paymentStatus', payFilter)
      if (scopeFilter === 'mine') params.set('scope', 'mine')
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
  }, [search, payFilter, scopeFilter])

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

  // Load kanban projects when switching to kanban view
  useEffect(() => {
    if (view === 'kanban' && kanbanProjects.length === 0) void loadKanban()
  }, [view, kanbanProjects.length, loadKanban])

  // Load activity when switching to activity view
  useEffect(() => {
    if (view === 'activity') void loadActivity()
  }, [view, loadActivity])

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

  const handleDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      const endpoint = deleteConfirm.type === 'item'
        ? `/api/cs/job-track/item/${deleteConfirm.id}`
        : `/api/cs/job-track/project/${deleteConfirm.id}`
      const res = await fetch(endpoint, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Delete failed')
      }
      // Refresh data
      await load()
      setDeleteConfirm(null)
    } catch {
      // silent — could add toast
    } finally {
      setDeleting(false)
    }
  }

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
          {/* My / All toggle */}
          <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-800/60 p-0.5">
            <button
              type="button"
              onClick={() => setScopeFilter('all')}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${scopeFilter === 'all' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter('mine')}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${scopeFilter === 'mine' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              My Clients
            </button>
          </div>

          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-800/60 p-0.5">
            {(['kanban', 'grouped', 'pipeline', 'table', 'live', 'activity'] as ViewMode[]).map((v, i) => {
              const icons = [FolderKanban, LayoutGrid, TrendingUp, List, Database, Activity]
              const Icon = icons[i]
              const titles = ['Project Board', 'Grouped view', 'Billing Pipeline', 'Table view', 'Live Bukku', 'Activity Log']
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setView(v)
                    if (v === 'live' && !verifyData) void runVerify()
                    if (v === 'kanban' && kanbanProjects.length === 0) void loadKanban()
                    if (v === 'activity') void loadActivity()
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

      {/* ── Kanban Board View ──────────────────────────────────────────── */}
      {view === 'kanban' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">
              {kanbanProjects.length} project{kanbanProjects.length !== 1 ? 's' : ''} across all stages
            </p>
            <button
              type="button"
              onClick={() => void loadKanban()}
              disabled={kanbanLoading}
              className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${kanbanLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {kanbanLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-3 h-[calc(100vh-240px)] overflow-hidden">
              {KANBAN_COLUMNS.map((col) => {
                const colProjects = kanbanProjects.filter(p => p.status === col.status)
                const total = colProjects.reduce((sum, p) => sum + p.quotedAmount, 0)
                const Icon = col.icon
                const isOver = kanbanOverCol === col.status && !!kanbanDragging

                return (
                  <div
                    key={col.status}
                    className={`flex flex-col rounded-xl border transition-all duration-150 overflow-hidden ${
                      isOver
                        ? `${col.dropHighlight} border-transparent`
                        : `${col.borderColor} ${col.bgColor}`
                    }`}
                    onDragEnter={(e) => {
                      e.preventDefault()
                      kanbanDragCounters.current[col.status] = (kanbanDragCounters.current[col.status] ?? 0) + 1
                      setKanbanOverCol(col.status)
                    }}
                    onDragLeave={() => {
                      kanbanDragCounters.current[col.status] = (kanbanDragCounters.current[col.status] ?? 1) - 1
                      if ((kanbanDragCounters.current[col.status] ?? 0) <= 0) {
                        kanbanDragCounters.current[col.status] = 0
                        setKanbanOverCol(prev => prev === col.status ? null : prev)
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      kanbanDragCounters.current[col.status] = 0
                      void handleKanbanDrop(col.status)
                    }}
                  >
                    {/* Column header */}
                    <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800/40">
                      <div className="flex items-center gap-1.5">
                        <Icon className={`h-3.5 w-3.5 ${col.accent}`} />
                        <span className={`text-xs font-semibold ${col.textColor}`}>{col.label}</span>
                      </div>
                      <span className="rounded-full bg-zinc-800/60 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                        {colProjects.length}
                      </span>
                    </div>

                    {/* Total value */}
                    <div className="px-3 py-2 border-b border-zinc-800/30">
                      <span className="text-xs font-semibold text-zinc-300">{fmt(total)}</span>
                    </div>

                    {/* Cards */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                      {colProjects.length === 0 ? (
                        <div className={`flex flex-col items-center justify-center h-20 gap-1 rounded-lg border-2 border-dashed transition-colors ${
                          isOver ? 'border-zinc-500/50' : 'border-transparent'
                        }`}>
                          {isOver ? (
                            <span className="text-xs text-zinc-400 font-medium">Drop here</span>
                          ) : (
                            <span className="text-xs text-zinc-700">No projects here</span>
                          )}
                        </div>
                      ) : (
                        colProjects.map((project) => {
                          const overdue = project.deadline ? new Date(project.deadline) < new Date() : false
                          return (
                            <div
                              key={project.id}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = 'move'
                                e.dataTransfer.setData('text/plain', project.id)
                                setKanbanDragging(project.id)
                              }}
                              onDragEnd={() => setKanbanDragging('')}
                              className={`rounded-lg border p-3 space-y-2 transition-all duration-150 cursor-grab active:cursor-grabbing select-none ${
                                kanbanDragging === project.id
                                  ? 'opacity-40 scale-95'
                                  : 'hover:border-zinc-600/60'
                              } ${
                                overdue
                                  ? 'border-amber-500/20 bg-amber-500/5'
                                  : 'border-zinc-800/60 bg-zinc-900/40'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <Link
                                  href={`/cs/projects/${project.id}`}
                                  className="text-xs font-mono font-semibold text-[#818cf8] hover:text-[#a5b4fc] transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {project.code}
                                </Link>
                                {overdue && <AlertTriangle className="h-3 w-3 text-red-400 flex-shrink-0" />}
                              </div>
                              {project.client && (
                                <p className="text-xs text-zinc-300 font-medium truncate">{project.client.companyName}</p>
                              )}
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-zinc-500">{fmt(project.quotedAmount)}</span>
                                {project.deadline && (
                                  <span className={`text-[10px] ${overdue ? 'text-red-400' : 'text-zinc-600'}`}>
                                    {overdue ? 'Overdue' : new Date(project.deadline).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-1.5">
                                <Link
                                  href={`/cs/projects/${project.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/60 transition-colors border border-zinc-700/40"
                                >
                                  <FileText className="h-2.5 w-2.5" />
                                  Open
                                </Link>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : view === 'activity' ? (
        <div className="space-y-3">
          {activityLoading ? (
            <div className="flex items-center justify-center py-20 text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />Loading activity…
            </div>
          ) : activityItems.length === 0 ? (
            <div className="text-center py-20 text-zinc-500 text-sm">No recent activity found.</div>
          ) : (
            <>
              <div className="text-xs text-zinc-500 mb-2">{activityItems.length} recent changes</div>
              <div className="relative pl-4 border-l border-zinc-700/60">
                {activityItems.map((a, idx) => {
                  const dt = new Date(a.createdAt)
                  const showDate = idx === 0 || new Date(activityItems[idx - 1].createdAt).toDateString() !== dt.toDateString()
                  const actionLabel = formatActionLabel(a.action)
                  const actionColor = getActionColor(a.action)

                  return (
                    <div key={a.id}>
                      {showDate && (
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mt-4 mb-2 -ml-4 pl-4">
                          {dt.toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      )}
                      <div className="relative mb-3 group">
                        <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-800 bg-zinc-600 group-hover:bg-zinc-400 transition-colors" />
                        <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/40 px-3 py-2 hover:bg-zinc-800/70 transition-colors">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${actionColor}`}>
                              {actionLabel}
                            </span>
                            {a.projectCode && (
                              <Link
                                href={`/projects/${a.projectId}`}
                                className="text-xs font-mono text-blue-400 hover:text-blue-300 hover:underline"
                              >
                                {a.projectCode}
                              </Link>
                            )}
                            {a.clientName && (
                              <span className="text-[11px] text-zinc-400">{a.clientName}</span>
                            )}
                            <span className="ml-auto text-[10px] text-zinc-600">
                              {dt.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px]">
                            {a.performerName && (
                              <span className="text-zinc-300">
                                <span className="text-zinc-500">by</span> {a.performerName}
                                {a.performerRole && (
                                  <span className="text-zinc-600 ml-1">({formatRole(a.performerRole)})</span>
                                )}
                              </span>
                            )}
                            {a.itemDescription && (
                              <span className="text-zinc-500">
                                on <span className="text-zinc-400">{a.itemDescription}</span>
                                {a.itemType && <span className="text-zinc-600 ml-1">({a.itemType.replace(/_/g, ' ')})</span>}
                              </span>
                            )}
                          </div>
                          {a.metadata && typeof a.metadata === 'object' && Object.keys(a.metadata).length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {renderMetadata(a.metadata as Record<string, unknown>)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      ) : view === 'live' ? (
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
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm({ type: 'item', id: row.id, label: row.description ?? row.itemType })}
                      className="p-1 rounded text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
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
                          {group.members && group.members.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded px-1.5 py-0.5">
                              <Users className="h-2.5 w-2.5" />
                              {group.members.length <= 3
                                ? group.members.map(m => m.name.split(' ')[0]).join(', ')
                                : `${group.members.slice(0, 2).map(m => m.name.split(' ')[0]).join(', ')} +${group.members.length - 2}`
                              }
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

                            <div className="flex justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEdit(item, group)}
                                className="p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-700 transition-colors"
                                title="Edit"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirm({ type: 'item', id: item.id, label: item.description ?? item.itemType })}
                                className="p-1 rounded text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {/* Delete entire project */}
                        <div className="flex justify-end px-4 py-2 border-t border-zinc-800/50">
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm({ type: 'project', id: group.projectId, label: `${group.client} (${group.account})` })}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" /> Delete Project
                          </button>
                        </div>
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

      {/* ── Delete Confirmation Dialog ──────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-zinc-100 font-semibold text-sm">
              Delete {deleteConfirm.type === 'item' ? 'Job Item' : 'Project'}?
            </h3>
            <p className="text-zinc-400 text-xs">
              Are you sure you want to delete <span className="text-zinc-200 font-medium">{deleteConfirm.label}</span>?
              {deleteConfirm.type === 'project' && ' This will remove the project and all its deliverable items.'}
              {' '}This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 transition-colors"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-1.5 rounded-lg text-xs text-white bg-rose-600 hover:bg-rose-500 transition-colors disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
