'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  RefreshCw,
  Download,
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
  Receipt,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface BukkuLineItem {
  description: string
  quantity: number
  unit_price: number
  amount: number
}

interface BukkuQuotation {
  id: string
  number: string
  contact_name: string
  date: string
  expiry_date: string
  status: string
  total_amount: number
  line_items: BukkuLineItem[]
}

interface BukkuInvoice {
  id: string
  number: string
  contact_name: string
  date: string
  due_date: string
  status: string
  total_amount: number
  line_items: BukkuLineItem[]
}

interface ListMeta {
  total: number
  page: number
  per_page: number
  last_page: number
}

interface SyncStatus {
  lastInvoiceSync: string | null
  lastQuoteSync: string | null
  lastPaymentSync: string | null
}

interface ImportResult {
  id: string
  status: 'success' | 'error' | 'duplicate'
  message: string
  projectCode?: string
  projectId?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMYR(amount: number): string {
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(amount)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
}

function statusBadge(status: string): string {
  const s = status.toLowerCase()
  if (s === 'accepted' || s === 'won' || s === 'approved') return 'bg-green-100 text-green-700'
  if (s === 'pending' || s === 'draft') return 'bg-yellow-100 text-yellow-700'
  if (s === 'paid' || s === 'sent') return 'bg-blue-100 text-blue-700'
  if (s === 'expired' || s === 'lost' || s === 'cancelled') return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-600'
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BukkuImportPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<'quotations' | 'invoices'>('quotations')

  const [quotations, setQuotations] = useState<BukkuQuotation[]>([])
  const [invoices, setInvoices] = useState<BukkuInvoice[]>([])
  const [qMeta, setQMeta] = useState<ListMeta | null>(null)
  const [iMeta, setIMeta] = useState<ListMeta | null>(null)
  const [qPage, setQPage] = useState(1)
  const [iPage, setIPage] = useState(1)

  const [loading, setLoading] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [syncing, setSyncing] = useState(false)

  const [importResults, setImportResults] = useState<Record<string, ImportResult>>({})
  const [importing, setImporting] = useState<string | null>(null)

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchSyncStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/bukku/sync')
      const json = await res.json() as { success: boolean } & SyncStatus
      if (json.success) setSyncStatus(json)
    } catch {
      // non-fatal
    }
  }, [])

  const fetchQuotations = useCallback(async (page: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/bukku/quotations?page=${page}`)
      const json = await res.json() as { success: boolean; data: BukkuQuotation[]; meta: ListMeta }
      if (json.success) {
        setQuotations(json.data)
        setQMeta(json.meta)
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchInvoices = useCallback(async (page: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/bukku/invoices?page=${page}`)
      const json = await res.json() as { success: boolean; data: BukkuInvoice[]; meta: ListMeta }
      if (json.success) {
        setInvoices(json.data)
        setIMeta(json.meta)
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchSyncStatus()
    void fetchQuotations(1)
    void fetchInvoices(1)
  }, [fetchSyncStatus, fetchQuotations, fetchInvoices])

  useEffect(() => {
    void fetchQuotations(qPage)
  }, [qPage, fetchQuotations])

  useEffect(() => {
    void fetchInvoices(iPage)
  }, [iPage, fetchInvoices])

  // ── Manual full sync ───────────────────────────────────────────────────────

  const handleFullSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/bukku/sync', { method: 'POST' })
      const json = await res.json() as { success: boolean; invoicesImported: number; quotationsImported: number; errors: string[] }
      if (json.success) {
        alert(`Sync complete!\nInvoices imported: ${json.invoicesImported}\nQuotations imported: ${json.quotationsImported}${json.errors.length > 0 ? '\nErrors: ' + json.errors.join(', ') : ''}`)
        void fetchSyncStatus()
        void fetchQuotations(qPage)
        void fetchInvoices(iPage)
      }
    } catch {
      alert('Sync failed. Check console for details.')
    } finally {
      setSyncing(false)
    }
  }

  // ── Individual import ──────────────────────────────────────────────────────

  const importQuotation = async (id: string) => {
    setImporting(id)
    try {
      const res = await fetch(`/api/bukku/quotations/${id}/import`, { method: 'POST' })
      const json = await res.json() as { success: boolean; error?: string; projectId?: string; projectCode?: string }

      if (res.status === 409) {
        setImportResults((prev) => ({
          ...prev,
          [`q-${id}`]: { id, status: 'duplicate', message: json.error ?? 'Already imported', projectId: json.projectId },
        }))
      } else if (json.success) {
        setImportResults((prev) => ({
          ...prev,
          [`q-${id}`]: { id, status: 'success', message: `Created ${json.projectCode ?? ''}`, projectCode: json.projectCode, projectId: json.projectId },
        }))
      } else {
        setImportResults((prev) => ({
          ...prev,
          [`q-${id}`]: { id, status: 'error', message: json.error ?? 'Import failed' },
        }))
      }
    } catch {
      setImportResults((prev) => ({
        ...prev,
        [`q-${id}`]: { id, status: 'error', message: 'Network error' },
      }))
    } finally {
      setImporting(null)
    }
  }

  const importInvoice = async (id: string) => {
    setImporting(id)
    try {
      const res = await fetch(`/api/bukku/invoices/${id}/import`, { method: 'POST' })
      const json = await res.json() as { success: boolean; error?: string; projectId?: string; projectCode?: string }

      if (res.status === 409) {
        setImportResults((prev) => ({
          ...prev,
          [`i-${id}`]: { id, status: 'duplicate', message: json.error ?? 'Already imported', projectId: json.projectId },
        }))
      } else if (json.success) {
        setImportResults((prev) => ({
          ...prev,
          [`i-${id}`]: { id, status: 'success', message: `Created ${json.projectCode ?? ''}`, projectCode: json.projectCode, projectId: json.projectId },
        }))
      } else {
        setImportResults((prev) => ({
          ...prev,
          [`i-${id}`]: { id, status: 'error', message: json.error ?? 'Import failed' },
        }))
      }
    } catch {
      setImportResults((prev) => ({
        ...prev,
        [`i-${id}`]: { id, status: 'error', message: 'Network error' },
      }))
    } finally {
      setImporting(null)
    }
  }

  // ── Auth guard ─────────────────────────────────────────────────────────────

  if (!session?.user) {
    return <div className="p-8 text-gray-500">Loading…</div>
  }

  const role = session.user.role
  if (role !== 'ADMIN' && role !== 'CLIENT_SERVICING') {
    return <div className="p-8 text-red-500">Access denied.</div>
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gray-900 text-white px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Bukku Import</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              Browse quotations and invoices from your Bukku account and create projects automatically.
            </p>
          </div>
          <button
            onClick={() => void handleFullSync()}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Full Sync (Last 30 Days)
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* Sync Status */}
        {syncStatus && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Last Invoice Sync', value: syncStatus.lastInvoiceSync, icon: Receipt },
              { label: 'Last Quotation Sync', value: syncStatus.lastQuoteSync, icon: FileText },
              { label: 'Last Payment Sync', value: syncStatus.lastPaymentSync, icon: Clock },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-3">
                <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                <div>
                  <div className="text-xs text-gray-500">{label}</div>
                  <div className="text-sm font-medium text-gray-800">{formatDate(value)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-200">
            {(['quotations', 'invoices'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-6 py-3 text-sm font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                {tab === 'quotations' ? '📋 Quotations' : '🧾 Invoices'}
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center h-48 gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading from Bukku…</span>
            </div>
          ) : activeTab === 'quotations' ? (
            <QuotationsTable
              quotations={quotations}
              meta={qMeta}
              page={qPage}
              onPageChange={setQPage}
              importing={importing}
              importResults={importResults}
              onImport={(id) => void importQuotation(id)}
            />
          ) : (
            <InvoicesTable
              invoices={invoices}
              meta={iMeta}
              page={iPage}
              onPageChange={setIPage}
              importing={importing}
              importResults={importResults}
              onImport={(id) => void importInvoice(id)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Quotations Table ─────────────────────────────────────────────────────────

interface QuotationsTableProps {
  quotations: BukkuQuotation[]
  meta: ListMeta | null
  page: number
  onPageChange: (p: number) => void
  importing: string | null
  importResults: Record<string, ImportResult>
  onImport: (id: string) => void
}

function QuotationsTable({ quotations, meta, page, onPageChange, importing, importResults, onImport }: QuotationsTableProps) {
  if (quotations.length === 0) {
    return <EmptyState message="No quotations found in your Bukku account." />
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
          <tr>
            <th className="text-left px-4 py-3">Quotation #</th>
            <th className="text-left px-4 py-3">Client</th>
            <th className="text-left px-4 py-3">Date</th>
            <th className="text-left px-4 py-3">Expiry</th>
            <th className="text-right px-4 py-3">Amount</th>
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-center px-4 py-3">Items</th>
            <th className="text-right px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {quotations.map((q) => {
            const result = importResults[`q-${q.id}`]
            return (
              <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-mono font-medium text-gray-900">{q.number}</td>
                <td className="px-4 py-3 text-gray-700">{q.contact_name}</td>
                <td className="px-4 py-3 text-gray-500">{formatDate(q.date)}</td>
                <td className="px-4 py-3 text-gray-500">{formatDate(q.expiry_date)}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{formatMYR(q.total_amount)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(q.status)}`}>
                    {q.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-gray-500">{q.line_items.length}</td>
                <td className="px-4 py-3 text-right">
                  <ImportButton
                    id={q.id}
                    result={result}
                    importing={importing}
                    onImport={onImport}
                    type="quotation"
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <Pagination meta={meta} page={page} onPageChange={onPageChange} />
    </div>
  )
}

// ─── Invoices Table ───────────────────────────────────────────────────────────

interface InvoicesTableProps {
  invoices: BukkuInvoice[]
  meta: ListMeta | null
  page: number
  onPageChange: (p: number) => void
  importing: string | null
  importResults: Record<string, ImportResult>
  onImport: (id: string) => void
}

function InvoicesTable({ invoices, meta, page, onPageChange, importing, importResults, onImport }: InvoicesTableProps) {
  if (invoices.length === 0) {
    return <EmptyState message="No invoices found in your Bukku account." />
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
          <tr>
            <th className="text-left px-4 py-3">Invoice #</th>
            <th className="text-left px-4 py-3">Client</th>
            <th className="text-left px-4 py-3">Date</th>
            <th className="text-left px-4 py-3">Due</th>
            <th className="text-right px-4 py-3">Amount</th>
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-center px-4 py-3">Items</th>
            <th className="text-right px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {invoices.map((inv) => {
            const result = importResults[`i-${inv.id}`]
            return (
              <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-mono font-medium text-gray-900">{inv.number}</td>
                <td className="px-4 py-3 text-gray-700">{inv.contact_name}</td>
                <td className="px-4 py-3 text-gray-500">{formatDate(inv.date)}</td>
                <td className="px-4 py-3 text-gray-500">{formatDate(inv.due_date)}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{formatMYR(inv.total_amount)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(inv.status)}`}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-gray-500">{inv.line_items.length}</td>
                <td className="px-4 py-3 text-right">
                  <ImportButton
                    id={inv.id}
                    result={result}
                    importing={importing}
                    onImport={onImport}
                    type="invoice"
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <Pagination meta={meta} page={page} onPageChange={onPageChange} />
    </div>
  )
}

// ─── Import Button ─────────────────────────────────────────────────────────────

interface ImportButtonProps {
  id: string
  result: ImportResult | undefined
  importing: string | null
  onImport: (id: string) => void
  type: 'quotation' | 'invoice'
}

function ImportButton({ id, result, importing, onImport, type }: ImportButtonProps) {
  if (result?.status === 'success') {
    return (
      <div className="flex items-center justify-end gap-2">
        <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
          <CheckCircle className="w-3.5 h-3.5" />
          {result.message}
        </span>
        {result.projectId && (
          <Link
            href={`/cs/projects/${result.projectId}`}
            className="text-blue-600 hover:text-blue-500"
            title="View project"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    )
  }

  if (result?.status === 'duplicate') {
    return (
      <div className="flex items-center justify-end gap-2">
        <span className="flex items-center gap-1 text-yellow-600 text-xs font-medium">
          <AlertCircle className="w-3.5 h-3.5" />
          Already imported
        </span>
        {result.projectId && (
          <Link
            href={`/cs/projects/${result.projectId}`}
            className="text-blue-600 hover:text-blue-500"
            title="View project"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    )
  }

  if (result?.status === 'error') {
    return (
      <div className="flex items-center justify-end gap-2">
        <span className="flex items-center gap-1 text-red-600 text-xs">
          <AlertCircle className="w-3.5 h-3.5" />
          {result.message.slice(0, 30)}
        </span>
        <button
          onClick={() => onImport(id)}
          className="text-xs text-blue-600 hover:underline"
        >
          Retry
        </button>
      </div>
    )
  }

  const isLoading = importing === id

  return (
    <button
      onClick={() => onImport(id)}
      disabled={isLoading}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors"
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Download className="w-3.5 h-3.5" />
      )}
      Import {type === 'quotation' ? 'Quotation' : 'Invoice'}
    </button>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────

interface PaginationProps {
  meta: ListMeta | null
  page: number
  onPageChange: (p: number) => void
}

function Pagination({ meta, page, onPageChange }: PaginationProps) {
  if (!meta || meta.last_page <= 1) return null

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50 text-sm">
      <span className="text-gray-500">
        Page {page} of {meta.last_page} — {meta.total} total records
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-md border border-gray-200 hover:bg-white disabled:opacity-40 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= meta.last_page}
          className="p-1.5 rounded-md border border-gray-200 hover:bg-white disabled:opacity-40 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
      <FileText className="w-8 h-8 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  )
}
