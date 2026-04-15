'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Users,
  Plus,
  X,
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Briefcase,
  DollarSign,
} from 'lucide-react'
import { ViewToggle, type ViewMode } from '@/components/ui/view-toggle'

type FreelancerStatus = 'AVAILABLE' | 'ON_PROJECT' | 'UNAVAILABLE'

interface Freelancer {
  id: string
  name: string
  email: string
  skills: string[]
  hourlyRate: number
  status: FreelancerStatus
  assignments?: FreelancerAssignment[]
}

interface FreelancerAssignment {
  id: string
  projectId: string
  projectCode?: string
}

const ALL_SKILLS = [
  'Logo Design',
  'Brand Identity',
  'Social Media',
  'Banner Design',
  '3D Rendering',
  'Video Editing',
  'Photography',
  'Copywriting',
  'Web Design',
  'Motion Graphics',
]

const STATUS_CONFIG: Record<FreelancerStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  AVAILABLE: {
    label: 'Available',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  ON_PROJECT: {
    label: 'On Project',
    color: 'text-[#818cf8]',
    bg: 'bg-[#6366f1]/10',
    border: 'border-[#6366f1]/20',
    dot: 'bg-[#818cf8]',
  },
  UNAVAILABLE: {
    label: 'Unavailable',
    color: 'text-zinc-500',
    bg: 'bg-zinc-500/10',
    border: 'border-zinc-500/20',
    dot: 'bg-zinc-500',
  },
}

const EMPTY_FORM = {
  name: '',
  email: '',
  skills: [] as string[],
  hourlyRate: 80,
  status: 'AVAILABLE' as FreelancerStatus,
}

export default function FreelancersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [freelancers, setFreelancers] = useState<Freelancer[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [view, setView] = useState<ViewMode>('bento')

  // Team capacity alert (mock)
  const teamCapacity = 87

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (
      status === 'authenticated' &&
      session.user.role !== 'ADMIN' &&
      session.user.role !== 'CREATIVE_DIRECTOR'
    ) {
      router.push('/command')
    }
  }, [status, session, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetchFreelancers()
  }, [status])

  async function fetchFreelancers() {
    setLoading(true)
    try {
      const res = await fetch('/api/freelancers')
      const json = await res.json() as { data: Freelancer[] }
      setFreelancers(json.data ?? [])
    } catch {
      setError('Failed to load freelancers')
    } finally {
      setLoading(false)
    }
  }

  function toggleSkill(skill: string) {
    setForm(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill],
    }))
  }

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required')
      return
    }
    if (form.skills.length === 0) {
      setError('Select at least one skill')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/freelancers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Save failed')
      const json = await res.json() as { data: Freelancer }
      setFreelancers(prev => [json.data, ...prev])
      setForm(EMPTY_FORM)
      setShowForm(false)
    } catch {
      setError('Failed to add freelancer')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(id: string, newStatus: FreelancerStatus) {
    try {
      await fetch(`/api/freelancers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      setFreelancers(prev => prev.map(f => f.id === id ? { ...f, status: newStatus } : f))
    } catch {
      setError('Failed to update status')
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Users className="h-5 w-5 text-[#818cf8]" />
            Freelancer Pool
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {freelancers.filter(f => f.status === 'AVAILABLE').length} available ·{' '}
            {freelancers.filter(f => f.status === 'ON_PROJECT').length} on project
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle view={view} onChange={setView} />
          <button type="button"
            onClick={() => { setShowForm(true); setError(null) }}
            className="flex items-center gap-2 rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-medium text-white hover:bg-[#5558e3] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Freelancer
          </button>
        </div>
      </div>

      {/* Capacity Alert */}
      {teamCapacity > 85 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-300">
            Team capacity at <strong>{teamCapacity}%</strong> — Consider briefing freelancers to handle overflow
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Add Form */}
      {showForm && (
        <div className="rounded-xl border border-[#6366f1]/30 bg-[#0d0d14] p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-100">Add Freelancer</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-zinc-500 hover:text-zinc-200 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Full Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ahmad Faris"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-[#6366f1] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="faris@example.com"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-[#6366f1] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Hourly Rate (RM)</label>
              <input
                type="number"
                min={0}
                step={10}
                value={form.hourlyRate}
                onChange={e => setForm(prev => ({ ...prev, hourlyRate: Number(e.target.value) }))}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-[#6366f1] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Initial Status</label>
              <div className="relative">
                <select
                  value={form.status}
                  onChange={e => setForm(prev => ({ ...prev, status: e.target.value as FreelancerStatus }))}
                  className="w-full appearance-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-[#6366f1] focus:outline-none pr-8"
                >
                  <option value="AVAILABLE">Available</option>
                  <option value="ON_PROJECT">On Project</option>
                  <option value="UNAVAILABLE">Unavailable</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600 pointer-events-none" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Skills *</label>
            <div className="flex flex-wrap gap-2">
              {ALL_SKILLS.map(skill => (
                <button type="button"
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                    form.skills.includes(skill)
                      ? 'bg-[#6366f1]/20 border-[#6366f1]/50 text-[#818cf8]'
                      : 'border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-800">
            <button type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button type="button"
              onClick={handleSave}
              disabled={saving}
              className="cursor-pointer flex items-center gap-2 rounded-lg bg-[#6366f1] px-5 py-2 text-sm font-medium text-white hover:bg-[#5558e3] disabled:opacity-60 transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Add Freelancer
            </button>
          </div>
        </div>
      )}

      {/* Freelancers — empty */}
      {freelancers.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-16 text-center">
          <Users className="h-10 w-10 text-zinc-700 mb-3" />
          <p className="text-zinc-400 font-medium">No freelancers yet</p>
          <p className="text-sm text-zinc-600 mt-1">Add freelancers to build your overflow capacity</p>
        </div>
      )}

      {/* Bento / Card view */}
      {freelancers.length > 0 && view === 'bento' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {freelancers.map(f => {
            const cfg = STATUS_CONFIG[f.status]
            return (
              <div key={f.id} className="rounded-xl border border-zinc-800 bg-[#0d0d14] p-5 space-y-4 hover:border-zinc-700 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-sm font-semibold text-white flex-shrink-0">
                      {f.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">{f.name}</p>
                      <p className="text-xs text-zinc-500 truncate max-w-[120px]">{f.email}</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${cfg.bg} ${cfg.border} ${cfg.color} flex-shrink-0`}>
                    <div className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />RM {f.hourlyRate}/hr</span>
                  {f.assignments && f.assignments.length > 0 && (
                    <span className="flex items-center gap-1 text-[#818cf8]"><Briefcase className="h-3 w-3" />{f.assignments.length} active</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {f.skills.map(skill => (
                    <span key={skill} className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">{skill}</span>
                  ))}
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-600 mb-1 uppercase tracking-wider">Status</label>
                  <div className="relative">
                    <select value={f.status} onChange={e => handleStatusChange(f.id, e.target.value as FreelancerStatus)}
                      className="w-full appearance-none rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-[#6366f1] focus:outline-none pr-6">
                      <option value="AVAILABLE">Available</option>
                      <option value="ON_PROJECT">On Project</option>
                      <option value="UNAVAILABLE">Unavailable</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-600 pointer-events-none" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* List / Table view */}
      {freelancers.length > 0 && view === 'list' && (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_100px_minmax(0,1fr)_100px_130px] gap-3 px-4 py-2.5 bg-zinc-800/60 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 border-b border-zinc-800">
            <span>Name</span>
            <span>Rate</span>
            <span>Skills</span>
            <span className="text-center">Projects</span>
            <span>Status</span>
          </div>
          {freelancers.map(f => {
            const cfg = STATUS_CONFIG[f.status]
            return (
              <div key={f.id} className="grid grid-cols-[minmax(0,1fr)_100px_minmax(0,1fr)_100px_130px] gap-3 px-4 py-3 border-b border-zinc-800/60 hover:bg-zinc-800/20 items-center transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
                    {f.name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-100 truncate">{f.name}</p>
                    <p className="text-[10px] text-zinc-500 truncate">{f.email}</p>
                  </div>
                </div>
                <span className="text-xs text-zinc-300">RM {f.hourlyRate}/hr</span>
                <div className="flex flex-wrap gap-1">
                  {f.skills.slice(0, 3).map(s => (
                    <span key={s} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">{s}</span>
                  ))}
                  {f.skills.length > 3 && <span className="text-[10px] text-zinc-600">+{f.skills.length - 3}</span>}
                </div>
                <div className="text-center">
                  <span className="text-xs text-zinc-400">{f.assignments?.length ?? 0}</span>
                </div>
                <div className="relative">
                  <select value={f.status} onChange={e => handleStatusChange(f.id, e.target.value as FreelancerStatus)}
                    className={`w-full appearance-none rounded-lg border px-2 py-1 text-[11px] font-medium focus:outline-none pr-5 ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                    <option value="AVAILABLE">Available</option>
                    <option value="ON_PROJECT">On Project</option>
                    <option value="UNAVAILABLE">Unavailable</option>
                  </select>
                  <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none opacity-60" />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
