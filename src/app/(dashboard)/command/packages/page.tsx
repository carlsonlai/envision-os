'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Package,
  Plus,
  Edit3,
  Trash2,
  X,
  Save,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Clock,
  RotateCcw,
  Loader2,
  LayoutGrid,
  List,
} from 'lucide-react'

type ViewMode = 'bento' | 'list'

interface TemplateItem {
  itemType: string
  quantity: number
  defaultRevisionLimit: number
  estimatedMinutes: number
}

interface PackageTemplate {
  id: string
  name: string
  description: string
  items: TemplateItem[]
  defaultDeadlineDays: number
  basePrice: number
  usageCount?: number
}

const ITEM_TYPES = [
  'BANNER',
  'BROCHURE',
  'LOGO',
  'SOCIAL',
  'PRINT',
  'THREE_D',
  'VIDEO',
  'OTHER',
]

const EMPTY_ITEM: TemplateItem = {
  itemType: 'BANNER',
  quantity: 1,
  defaultRevisionLimit: 2,
  estimatedMinutes: 60,
}

const EMPTY_FORM = {
  name: '',
  description: '',
  items: [{ ...EMPTY_ITEM }],
  defaultDeadlineDays: 7,
  basePrice: 0,
}

function minutesToHours(min: number): string {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}

export default function PackagesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [view, setView] = useState<ViewMode>('bento')
  const [templates, setTemplates] = useState<PackageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && session.user.role !== 'ADMIN') router.push('/command')
  }, [status, session, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetchTemplates()
  }, [status])

  async function fetchTemplates() {
    setLoading(true)
    try {
      const res = await fetch('/api/package-templates')
      const json = await res.json() as { data: PackageTemplate[] }
      setTemplates(json.data ?? [])
    } catch {
      setError('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  function startNew() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(true)
    setError(null)
  }

  function startEdit(t: PackageTemplate) {
    setForm({
      name: t.name,
      description: t.description,
      items: t.items.map(i => ({ ...i })),
      defaultDeadlineDays: t.defaultDeadlineDays,
      basePrice: t.basePrice,
    })
    setEditingId(t.id)
    setShowForm(true)
    setError(null)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setError(null)
  }

  function addItem() {
    setForm(prev => ({ ...prev, items: [...prev.items, { ...EMPTY_ITEM }] }))
  }

  function removeItem(idx: number) {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))
  }

  function updateItem(idx: number, field: keyof TemplateItem, value: string | number) {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === idx ? { ...item, [field]: value } : item
      ),
    }))
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Package name is required'); return }
    if (form.items.length === 0) { setError('At least one item is required'); return }
    if (form.basePrice <= 0) { setError('Price must be greater than 0'); return }
    setSaving(true)
    setError(null)
    try {
      const url = editingId
        ? `/api/package-templates/${editingId}`
        : '/api/package-templates'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Save failed')
      await fetchTemplates()
      cancelForm()
    } catch {
      setError('Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template?')) return
    setDeletingId(id)
    try {
      await fetch(`/api/package-templates/${id}`, { method: 'DELETE' })
      setTemplates(prev => prev.filter(t => t.id !== id))
    } catch {
      setError('Failed to delete template')
    } finally {
      setDeletingId(null)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
          <span className="text-sm text-zinc-500">Loading templates...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Package className="h-5 w-5 text-[#818cf8]" />
            Package Templates
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Reusable packages for brief creation — {templates.length} templates
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-800/60 p-0.5">
            <button type="button" onClick={() => setView('bento')} title="Grid view"
              className={`rounded-md p-1.5 transition-colors ${view === 'bento' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => setView('list')} title="List view"
              className={`rounded-md p-1.5 transition-colors ${view === 'list' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
          <button type="button"
            onClick={startNew}
            className="cursor-pointer flex items-center gap-2 rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-medium text-white hover:bg-[#5558e3] transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Package
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Inline Form */}
      {showForm && (
        <div className="rounded-xl border border-[#6366f1]/30 bg-[#0d0d14] p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-100">
              {editingId ? 'Edit Package Template' : 'New Package Template'}
            </h2>
            <button type="button" onClick={cancelForm} className="cursor-pointer text-zinc-500 hover:text-zinc-200 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Package Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Social Starter Pack"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-[#6366f1] focus:outline-none focus:ring-1 focus:ring-[#6366f1]/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="5 banners, 3 stories, 1 profile pic"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-[#6366f1] focus:outline-none focus:ring-1 focus:ring-[#6366f1]/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Default Deadline (days)</label>
              <input
                type="number"
                min={1}
                value={form.defaultDeadlineDays}
                onChange={e => setForm(prev => ({ ...prev, defaultDeadlineDays: Number(e.target.value) }))}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-[#6366f1] focus:outline-none focus:ring-1 focus:ring-[#6366f1]/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Base Price (RM) *</label>
              <input
                type="number"
                min={0}
                step={100}
                value={form.basePrice}
                onChange={e => setForm(prev => ({ ...prev, basePrice: Number(e.target.value) }))}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-[#6366f1] focus:outline-none focus:ring-1 focus:ring-[#6366f1]/50"
              />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-zinc-400">Items *</label>
              <button type="button"
                onClick={addItem}
                className="cursor-pointer flex items-center gap-1 text-xs text-[#818cf8] hover:text-[#6366f1] transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add Row
              </button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-5 gap-2 items-center">
                  <select
                    value={item.itemType}
                    onChange={e => updateItem(idx, 'itemType', e.target.value)}
                    className="col-span-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:border-[#6366f1] focus:outline-none"
                  >
                    {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-zinc-500">Qty</span>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:border-[#6366f1] focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-zinc-500">Rev</span>
                    <input
                      type="number"
                      min={0}
                      value={item.defaultRevisionLimit}
                      onChange={e => updateItem(idx, 'defaultRevisionLimit', Number(e.target.value))}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:border-[#6366f1] focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-zinc-500">Min</span>
                    <input
                      type="number"
                      min={0}
                      step={15}
                      value={item.estimatedMinutes}
                      onChange={e => updateItem(idx, 'estimatedMinutes', Number(e.target.value))}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:border-[#6366f1] focus:outline-none"
                    />
                  </div>
                  <button type="button"
                    onClick={() => removeItem(idx)}
                    disabled={form.items.length === 1}
                    className="flex justify-center text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-30"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-800">
            <button type="button"
              onClick={cancelForm}
              className="cursor-pointer rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button type="button"
              onClick={handleSave}
              disabled={saving}
              className="cursor-pointer flex items-center gap-2 rounded-lg bg-[#6366f1] px-5 py-2 text-sm font-medium text-white hover:bg-[#5558e3] disabled:opacity-60 transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Template
            </button>
          </div>
        </div>
      )}

      {/* Template Cards / List */}
      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-16 text-center">
          <Package className="h-10 w-10 text-zinc-700 mb-3" />
          <p className="text-zinc-400 font-medium">No package templates yet</p>
          <p className="text-sm text-zinc-600 mt-1">Create your first template to speed up brief creation</p>
          <button type="button"
            onClick={startNew}
            className="cursor-pointer mt-4 flex items-center gap-2 rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-medium text-white hover:bg-[#5558e3] transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Package
          </button>
        </div>
      ) : view === 'bento' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map(t => {
            const isExpanded = expandedId === t.id
            return (
              <div
                key={t.id}
                className="rounded-xl border border-zinc-800 bg-[#0d0d14] overflow-hidden hover:border-zinc-700 transition-colors"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-zinc-100 truncate">{t.name}</h3>
                      <p className="text-xs text-zinc-500 mt-0.5 truncate">{t.description}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="text-lg font-bold text-[#818cf8]">
                        RM {t.basePrice.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {t.defaultDeadlineDays}d deadline
                    </span>
                    <span className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {t.items.length} item type{t.items.length !== 1 ? 's' : ''}
                    </span>
                    {(t.usageCount !== undefined) && (
                      <span className="text-zinc-600">Used {t.usageCount}×</span>
                    )}
                  </div>

                  {/* Items preview */}
                  <div className="mt-3 space-y-1">
                    {t.items.slice(0, isExpanded ? undefined : 2).map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400">
                          {item.quantity}× {item.itemType}
                        </span>
                        <div className="flex items-center gap-3 text-zinc-600">
                          <span className="flex items-center gap-1">
                            <RotateCcw className="h-2.5 w-2.5" />
                            {item.defaultRevisionLimit} rev
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {minutesToHours(item.estimatedMinutes)}/ea
                          </span>
                        </div>
                      </div>
                    ))}
                    {t.items.length > 2 && (
                      <button type="button"
                        onClick={() => setExpandedId(isExpanded ? null : t.id)}
                        className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 transition-colors mt-1"
                      >
                        {isExpanded ? (
                          <><ChevronUp className="h-3 w-3" /> Show less</>
                        ) : (
                          <><ChevronDown className="h-3 w-3" /> +{t.items.length - 2} more</>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-zinc-800/60 px-5 py-2.5">
                  <span className="text-xs text-zinc-600 flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Base RM {t.basePrice.toLocaleString()}
                  </span>
                  <div className="flex items-center gap-2">
                    <button type="button"
                      onClick={() => startEdit(t)}
                      className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                    >
                      <Edit3 className="h-3 w-3" />
                      Edit
                    </button>
                    <button type="button"
                      onClick={() => handleDelete(t.id)}
                      disabled={deletingId === t.id}
                      className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      {deletingId === t.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Trash2 className="h-3 w-3" />}
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ── List view ── */
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_80px_100px_80px_90px] gap-3 px-4 py-2.5 bg-zinc-800/60 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 border-b border-zinc-800">
            <span>Package Name</span>
            <span className="text-center">Items</span>
            <span className="text-right">Base Price</span>
            <span className="text-center">Deadline</span>
            <span className="text-right">Actions</span>
          </div>
          {templates.map(t => (
            <div
              key={t.id}
              className="grid grid-cols-[minmax(0,1fr)_80px_100px_80px_90px] gap-3 px-4 py-3 border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/20 items-center transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-200 truncate">{t.name}</p>
                {t.description && <p className="text-[11px] text-zinc-500 truncate">{t.description}</p>}
                <div className="flex flex-wrap gap-1 mt-1">
                  {t.items.slice(0, 3).map((item, i) => (
                    <span key={i} className="text-[10px] text-zinc-600 bg-zinc-800/60 rounded px-1.5 py-0.5">
                      {item.quantity}× {item.itemType}
                    </span>
                  ))}
                  {t.items.length > 3 && (
                    <span className="text-[10px] text-zinc-600">+{t.items.length - 3} more</span>
                  )}
                </div>
              </div>
              <div className="text-center">
                <span className="text-xs text-zinc-400 flex items-center justify-center gap-1">
                  <Package className="h-3 w-3" />
                  {t.items.length}
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-[#818cf8]">RM {t.basePrice.toLocaleString()}</span>
              </div>
              <div className="text-center">
                <span className="text-xs text-zinc-400 flex items-center justify-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t.defaultDeadlineDays}d
                </span>
              </div>
              <div className="flex items-center justify-end gap-1">
                <button type="button"
                  onClick={() => startEdit(t)}
                  className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                >
                  <Edit3 className="h-3 w-3" />
                </button>
                <button type="button"
                  onClick={() => handleDelete(t.id)}
                  disabled={deletingId === t.id}
                  className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  {deletingId === t.id
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Trash2 className="h-3 w-3" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
