'use client'

import { use, useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Upload,
  ArrowLeft,
  Loader2,
  Zap,
  Clock,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react'

type Priority = 'NORMAL' | 'HIGH' | 'RUSH'
type QualityResult = 'pass' | 'warn' | 'fail'

interface ProjectItem {
  id: string
  itemType: string
  quantity: number
  estimatedMinutes: number
  deadlineDate?: string
  revisionLimit: number
}

interface ProjectData {
  id: string
  projectCode: string
  invoiceRef?: string
  items: ProjectItem[]
  status: string
}

interface BriefData {
  styleNotes?: string
  specialInstructions?: string
  priority?: Priority
  qualityGatePassed?: boolean
}

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'NORMAL', label: 'Normal', color: 'text-zinc-400' },
  { value: 'HIGH', label: 'High', color: 'text-amber-400' },
  { value: 'RUSH', label: 'Rush', color: 'text-red-400' },
]

function formatDeadline(iso?: string): string {
  if (!iso) return 'TBD'
  const d = new Date(iso)
  return d.toLocaleDateString('en-MY', { weekday: 'short', month: 'short', day: 'numeric' })
}

function minutesToLabel(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}min`
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}

function checkQuality(styleNotes: string, specialInstructions: string, priority: Priority): {
  result: QualityResult
  missing: string[]
  message: string
} {
  const missing: string[] = []
  if (!styleNotes.trim()) missing.push('style / mood reference')
  if (!specialInstructions.trim()) missing.push('client instructions')
  if (missing.length === 0) {
    return { result: 'pass', missing: [], message: 'Brief complete — ready to assign' }
  }
  if (missing.length === 1) {
    return {
      result: 'warn',
      missing,
      message: `Missing: ${missing.join(', ')}`,
    }
  }
  return {
    result: 'fail',
    missing,
    message: `Critical info missing: ${missing.join(', ')}`,
  }
}

export default function BriefQualityGatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()

  const [project, setProject] = useState<ProjectData | null>(null)
  const [brief, setBrief] = useState<BriefData>({})
  const [loading, setLoading] = useState(true)
  const [styleNotes, setStyleNotes] = useState('')
  const [referenceUrl, setReferenceUrl] = useState('')
  const [specialInstructions, setSpecialInstructions] = useState('')
  const [priority, setPriority] = useState<Priority>('NORMAL')
  const [qualityResult, setQualityResult] = useState<{
    result: QualityResult; missing: string[]; message: string
  } | null>(null)
  const [checking, setChecking] = useState(false)
  const [activating, setActivating] = useState(false)
  const [activated, setActivated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [refImages, setRefImages] = useState<string[]>([])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetchProject()
    fetchBrief()
  }, [status, id])

  async function fetchProject() {
    try {
      const res = await fetch(`/api/projects/${id}`)
      const json = await res.json() as { data: ProjectData }
      setProject(json.data)
    } catch {
      setError('Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  async function fetchBrief() {
    try {
      const res = await fetch(`/api/projects/${id}/brief`)
      if (res.ok) {
        const json = await res.json() as { data: BriefData }
        const b = json.data
        setBrief(b)
        setStyleNotes(b.styleNotes ?? '')
        setSpecialInstructions(b.specialInstructions ?? '')
        setPriority(b.priority ?? 'NORMAL')
      }
    } catch {
      // Brief may not exist yet
    }
  }

  function handleReferenceFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const urls = files.map(f => URL.createObjectURL(f))
    setRefImages(prev => [...prev, ...urls])
    e.target.value = ''
  }

  function handleQualityCheck() {
    setChecking(true)
    // Real synchronous quality check — no simulated delay
    const result = checkQuality(styleNotes, specialInstructions, priority)
    setQualityResult(result)
    setChecking(false)
  }

  async function handleActivate() {
    if (!project) return
    if (qualityResult?.result === 'fail') return
    setActivating(true)
    setError(null)
    try {
      const resultVal: string = qualityResult?.result ?? 'none'
      const passed = resultVal !== 'fail'
      await fetch(`/api/projects/${id}/brief`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          styleNotes: styleNotes + (referenceUrl ? `\nRef: ${referenceUrl}` : ''),
          specialInstructions,
          priority,
          qualityGatePassed: passed,
          qualityGateScore: qualityResult?.result === 'pass' ? 100 : qualityResult?.result === 'warn' ? 60 : 20,
        }),
      })
      setActivated(true)
      setTimeout(() => router.push(`/cs/projects/${id}`), 1500)
    } catch {
      setError('Failed to activate project')
    } finally {
      setActivating(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-16 text-zinc-500">Project not found.</div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button type="button"
          onClick={() => router.back()}
          className="mt-0.5 rounded-md p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#818cf8]" />
            <span className="text-xs font-semibold text-[#818cf8] uppercase tracking-wider">New Project Ready</span>
          </div>
          <h1 className="text-xl font-bold text-zinc-100 mt-1">{project.projectCode}</h1>
          {project.invoiceRef && (
            <p className="text-sm text-zinc-500 mt-0.5">Auto-filled from {project.invoiceRef}</p>
          )}
        </div>
      </div>

      {/* Auto-filled items */}
      <div className="rounded-xl border border-zinc-800 bg-[#0d0d14] p-5 space-y-3">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Deliverables</h2>
        <div className="space-y-2">
          {(project.items ?? []).length === 0 ? (
            <p className="text-sm text-zinc-600">No items found for this project.</p>
          ) : (
            (project.items ?? []).map((item: ProjectItem) => (
              <div key={item.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  <span className="text-sm text-zinc-200">
                    {item.itemType} × {item.quantity}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {minutesToLabel(item.estimatedMinutes)}/ea
                  </span>
                  {item.deadlineDate && (
                    <span>due {formatDeadline(item.deadlineDate)}</span>
                  )}
                  <span className="flex items-center gap-1">
                    <RotateCcw className="h-3 w-3" />
                    {item.revisionLimit} rev
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 3 Fields */}
      <div className="rounded-xl border border-[#6366f1]/30 bg-[#0d0d14] p-5 space-y-5">
        <h2 className="text-sm font-semibold text-zinc-100 uppercase tracking-wider">
          Complete These 3 Fields
        </h2>

        {/* 1. Style / mood */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#6366f1]/50 text-[10px] text-[#818cf8]">1</span>
            Style / Mood Reference
          </label>
          <div
            className="flex items-center gap-2 cursor-pointer rounded-lg border-2 border-dashed border-zinc-700 px-4 py-2.5 text-xs text-zinc-500 hover:border-zinc-600 hover:text-zinc-400 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Upload reference images
            <input ref={fileRef} type="file" multiple accept="image/*" onChange={handleReferenceFiles} className="hidden" />
          </div>
          {refImages.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {refImages.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt="reference" className="h-16 w-16 rounded-lg object-cover border border-zinc-700" />
              ))}
            </div>
          )}
          <input
            type="url"
            value={referenceUrl}
            onChange={e => setReferenceUrl(e.target.value)}
            placeholder="or paste URL (Pinterest, Behance, etc.)"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-[#6366f1] focus:outline-none"
          />
          <textarea
            value={styleNotes}
            onChange={e => setStyleNotes(e.target.value)}
            placeholder="Describe the mood, tone, style direction (e.g. 'minimalist dark luxury, gold accents')..."
            rows={2}
            className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-[#6366f1] focus:outline-none"
          />
        </div>

        {/* 2. Special instructions */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#6366f1]/50 text-[10px] text-[#818cf8]">2</span>
            Special Client Instructions
          </label>
          <textarea
            value={specialInstructions}
            onChange={e => setSpecialInstructions(e.target.value)}
            placeholder="Any special requirements, must-avoid elements, or client preferences..."
            rows={3}
            className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-[#6366f1] focus:outline-none"
          />
        </div>

        {/* 3. Priority */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#6366f1]/50 text-[10px] text-[#818cf8]">3</span>
            Priority Level
          </label>
          <div className="flex items-center gap-3">
            {PRIORITY_OPTIONS.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="priority"
                  value={opt.value}
                  checked={priority === opt.value}
                  onChange={() => setPriority(opt.value)}
                  className="accent-[#6366f1]"
                />
                <span className={`text-sm font-medium ${opt.color}`}>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Quality Check Result */}
      {qualityResult && (
        <div className={`rounded-xl border p-4 ${
          qualityResult.result === 'pass'
            ? 'border-emerald-500/20 bg-emerald-500/5'
            : qualityResult.result === 'warn'
            ? 'border-amber-500/20 bg-amber-500/5'
            : 'border-red-500/20 bg-red-500/5'
        }`}>
          <div className="flex items-start gap-3">
            {qualityResult.result === 'pass' && <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />}
            {qualityResult.result === 'warn' && <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />}
            {qualityResult.result === 'fail' && <XCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />}
            <div>
              <p className={`text-sm font-medium ${
                qualityResult.result === 'pass' ? 'text-emerald-300'
                : qualityResult.result === 'warn' ? 'text-amber-300'
                : 'text-red-300'
              }`}>
                {qualityResult.message}
              </p>
              {qualityResult.result === 'warn' && (
                <p className="text-xs text-zinc-500 mt-1">You can still activate with a warning — the team will proceed without these details.</p>
              )}
              {qualityResult.result === 'fail' && (
                <p className="text-xs text-zinc-500 mt-1">Please complete the required fields before activating this project.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button type="button"
          onClick={handleQualityCheck}
          disabled={checking}
          className="cursor-pointer flex items-center gap-2 rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:text-zinc-100 hover:border-zinc-600 transition-colors disabled:opacity-60"
        >
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Run Quality Check
        </button>
        <button type="button"
          onClick={handleActivate}
          disabled={activating || qualityResult?.result === 'fail' || activated}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all ${
            activated
              ? 'bg-emerald-600 text-white'
              : qualityResult?.result === 'fail'
              ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              : 'bg-[#6366f1] text-white hover:bg-[#5558e3]'
          } disabled:opacity-60`}
        >
          {activating ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Activating...</>
          ) : activated ? (
            <><CheckCircle2 className="h-4 w-4" /> Activated! Redirecting...</>
          ) : (
            <><Zap className="h-4 w-4" /> Activate Project → Assign to Designers</>
          )}
        </button>
      </div>
    </div>
  )
}
