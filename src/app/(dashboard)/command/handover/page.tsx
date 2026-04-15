'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeftRight,
  Users,
  ChevronDown,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Briefcase,
  Calendar,
  DollarSign,
} from 'lucide-react'

interface StaffMember {
  id: string
  name: string
  role: string
  email: string
}

interface ActiveProject {
  id: string
  projectCode: string
  clientName: string
  status: string
  unbilledAmount: number
  pendingClientActions: number
  lastCSMessage?: string
  items: number
  assignedCSId: string | null
}

interface WorkloadTask {
  id: string
  projectCode: string
  itemType: string
  quantity: number
  deadlineDate?: string
  estimatedMinutes: number
}

type HandoverSection = 'cs' | 'designer'

const DESIGNER_ROLES = [
  'GRAPHIC_DESIGNER',
  'JUNIOR_DESIGNER',
  'SENIOR_ART_DIRECTOR',
  'JUNIOR_ART_DIRECTOR',
  'DESIGNER_3D',
  'CREATIVE_DIRECTOR',
]


const ROLE_LABELS: Record<string, string> = {
  CLIENT_SERVICING: 'Client Servicing',
  GRAPHIC_DESIGNER: 'Graphic Designer',
  SENIOR_ART_DIRECTOR: 'Senior Art Director',
  JUNIOR_DESIGNER: 'Junior Designer',
  JUNIOR_ART_DIRECTOR: 'Junior Art Director',
  DESIGNER_3D: '3D Designer',
}

export default function HandoverPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [activeSection, setActiveSection] = useState<HandoverSection>('cs')
  const [departing, setDeparting] = useState<string>('')
  const [replacement, setReplacement] = useState<string>('')
  const [absentDesigner, setAbsentDesigner] = useState<string>('')
  const [absenceFrom, setAbsenceFrom] = useState('')
  const [absenceTo, setAbsenceTo] = useState('')
  const [redistributing, setRedistributing] = useState(false)
  const [reassigning, setReassigning] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Real data from DB
  const [csStaff, setCsStaff] = useState<StaffMember[]>([])
  const [designers, setDesigners] = useState<StaffMember[]>([])
  const [activeProjects, setActiveProjects] = useState<ActiveProject[]>([])
  const [designerTasks, setDesignerTasks] = useState<WorkloadTask[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && session.user.role !== 'ADMIN') router.push('/command')
  }, [status, session, router])

  // Fetch real staff and projects on mount
  useEffect(() => {
    if (status !== 'authenticated') return
    async function loadData() {
      setDataLoading(true)
      try {
        const [usersRes, projectsRes] = await Promise.all([
          fetch('/api/admin/users'),
          fetch('/api/projects'),
        ])
        if (usersRes.ok) {
          const usersJson = await usersRes.json() as { data: Array<{ id: string; name: string; role: string; email: string; active: boolean }> }
          const activeUsers = usersJson.data.filter(u => u.active)
          setCsStaff(activeUsers.filter(u => u.role === 'CLIENT_SERVICING'))
          setDesigners(activeUsers.filter(u => DESIGNER_ROLES.includes(u.role)))
        }
        if (projectsRes.ok) {
          interface RawProject {
            id: string
            code: string
            status: string
            quotedAmount?: number
            billedAmount?: number
            assignedCSId: string | null
            client?: { name: string }
            deliverableItems?: unknown[]
          }
          const projectsJson = await projectsRes.json() as { data: RawProject[] }
          const ongoing = projectsJson.data
            .filter(p => p.status === 'ONGOING' || p.status === 'PROJECTED')
            .map(p => ({
              id: p.id,
              projectCode: p.code,
              clientName: p.client?.name ?? 'Unknown Client',
              status: p.status,
              unbilledAmount: (p.quotedAmount ?? 0) - (p.billedAmount ?? 0),
              pendingClientActions: 0,
              items: p.deliverableItems?.length ?? 0,
              assignedCSId: p.assignedCSId,
            }))
          setActiveProjects(ongoing)
        }
      } catch {
        // silently fall through — selects just show empty
      } finally {
        setDataLoading(false)
      }
    }
    void loadData()
  }, [status])

  // Fetch tasks for the selected absent designer
  useEffect(() => {
    if (!absentDesigner) { setDesignerTasks([]); return }
    async function loadTasks() {
      try {
        const res = await fetch(`/api/workload?designerId=${absentDesigner}`)
        if (!res.ok) { setDesignerTasks([]); return }
        interface WorkloadItem { id: string; projectCode?: string; code?: string; itemType: string; quantity: number; estimatedMinutes?: number; deadline?: string }
        const json = await res.json() as { data?: WorkloadItem[] }
        const items = (json.data ?? []).map((t: WorkloadItem) => ({
          id: t.id,
          projectCode: t.projectCode ?? t.code ?? '',
          itemType: t.itemType,
          quantity: t.quantity,
          estimatedMinutes: t.estimatedMinutes ?? 0,
          deadlineDate: t.deadline,
        }))
        setDesignerTasks(items)
      } catch {
        setDesignerTasks([])
      }
    }
    void loadTasks()
  }, [absentDesigner])

  async function handleCSHandover() {
    if (!departing || !replacement) { setError('Select both departing CS and replacement'); return }
    if (departing === replacement) { setError('Cannot reassign to the same person'); return }
    setReassigning(true)
    setError(null)
    try {
      await fetch('/api/crm/handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: departing,
          toUserId: replacement,
          type: 'CS',
        }),
      })
      setDone(true)
      setTimeout(() => setDone(false), 2500)
    } catch {
      setError('Failed to complete handover')
    } finally {
      setReassigning(false)
    }
  }

  async function handleAutoRedistribute() {
    if (!absentDesigner || !absenceFrom || !absenceTo) {
      setError('Select designer and absence date range')
      return
    }
    setRedistributing(true)
    setError(null)
    try {
      const res = await fetch('/api/workload/rebalance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: absentDesigner, absenceDate: absenceFrom }),
      })
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        throw new Error(body.error ?? 'Failed to redistribute')
      }
      setDone(true)
      setTimeout(() => setDone(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to redistribute tasks')
    } finally {
      setRedistributing(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5 text-[#818cf8]" />
          Handover Protocol
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">Manage team transitions with zero disruption</p>
      </div>

      {/* Section Tabs */}
      <div className="flex rounded-xl border border-zinc-800 bg-zinc-900 p-1 w-fit gap-1">
        {(
          [
            { key: 'cs' as HandoverSection, label: 'CS Handover', icon: Briefcase },
            { key: 'designer' as HandoverSection, label: 'Designer Absence', icon: Users },
          ] as const
        ).map(tab => {
          const Icon = tab.icon
          return (
            <button type="button"
              key={tab.key}
              onClick={() => setActiveSection(tab.key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                activeSection === tab.key
                  ? 'bg-[#6366f1] text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {done && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          Handover complete! Notifications sent via Lark.
        </div>
      )}

      {/* CS Handover Section */}
      {activeSection === 'cs' && (
        <div className="space-y-5">
          {/* Staff selectors */}
          <div className="rounded-xl border border-zinc-800 bg-[#0d0d14] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-300">Select Staff</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Departing CS</label>
                <div className="relative">
                  <select
                    value={departing}
                    onChange={e => setDeparting(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-[#6366f1] focus:outline-none pr-8"
                  >
                    <option value="">{dataLoading ? 'Loading…' : 'Select CS member...'}</option>
                    {csStaff.map(cs => (
                      <option key={cs.id} value={cs.id}>{cs.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Reassign All To</label>
                <div className="relative">
                  <select
                    value={replacement}
                    onChange={e => setReplacement(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-[#6366f1] focus:outline-none pr-8"
                  >
                    <option value="">Select replacement...</option>
                    {csStaff.filter(cs => cs.id !== departing).map(cs => (
                      <option key={cs.id} value={cs.id}>{cs.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Active Projects Preview */}
          {departing && (() => {
            const departingProjects = activeProjects.filter(p => p.assignedCSId === departing)
            return (
            <div className="rounded-xl border border-zinc-800 bg-[#0d0d14] p-5 space-y-3">
              <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-[#818cf8]" />
                Active Projects to Transfer ({departingProjects.length})
              </h2>
              {departingProjects.length === 0 && (
                <p className="text-xs text-zinc-600">No active or projected projects assigned to this CS member.</p>
              )}
              <div className="space-y-3">
                {departingProjects.map(proj => (
                  <div key={proj.id} className="flex items-start justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-100">{proj.projectCode}</span>
                        <span className="text-xs text-zinc-500">·</span>
                        <span className="text-xs text-zinc-500">{proj.clientName}</span>
                      </div>
                      <p className="text-xs text-zinc-600 mt-0.5">{proj.lastCSMessage}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-xs text-zinc-500">
                      {proj.unbilledAmount > 0 && (
                        <span className="flex items-center gap-1 text-amber-400">
                          <DollarSign className="h-3 w-3" />
                          RM {proj.unbilledAmount.toLocaleString()} unbilled
                        </span>
                      )}
                      {proj.pendingClientActions > 0 && (
                        <span className="flex items-center gap-1 text-orange-400">
                          <AlertTriangle className="h-3 w-3" />
                          {proj.pendingClientActions} pending actions
                        </span>
                      )}
                      <span>{proj.items} items</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )
          })()}

          <button type="button"
            onClick={handleCSHandover}
            disabled={reassigning || !departing || !replacement}
            className="cursor-pointer flex items-center gap-2 rounded-xl bg-[#6366f1] px-6 py-3 text-sm font-semibold text-white hover:bg-[#5558e3] disabled:opacity-50 transition-colors"
          >
            {reassigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
            Reassign All Projects → {replacement ? (csStaff.find(c => c.id === replacement)?.name ?? '...') : '...'}
          </button>
        </div>
      )}

      {/* Designer Absence Section */}
      {activeSection === 'designer' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-zinc-800 bg-[#0d0d14] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-300">Designer Absence Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Absent Designer</label>
                <div className="relative">
                  <select
                    value={absentDesigner}
                    onChange={e => setAbsentDesigner(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-[#6366f1] focus:outline-none pr-8"
                  >
                    <option value="">{dataLoading ? 'Loading…' : 'Select designer...'}</option>
                    {designers.map(d => (
                      <option key={d.id} value={d.id}>{d.name} · {ROLE_LABELS[d.role] ?? d.role}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">From</label>
                <input
                  type="date"
                  value={absenceFrom}
                  onChange={e => setAbsenceFrom(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-[#6366f1] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">To</label>
                <input
                  type="date"
                  value={absenceTo}
                  onChange={e => setAbsenceTo(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-[#6366f1] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Tasks Preview */}
          {absentDesigner && (
            <div className="rounded-xl border border-zinc-800 bg-[#0d0d14] p-5 space-y-3">
              <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#818cf8]" />
                Assigned Tasks ({designerTasks.length})
              </h2>
              {designerTasks.length === 0 ? (
                <p className="text-xs text-zinc-600">No open tasks found for this designer.</p>
              ) : (
                <div className="space-y-2">
                  {designerTasks.map(task => (
                    <div key={task.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-zinc-400">{task.projectCode}</span>
                        <span className="text-sm text-zinc-200">{task.quantity}× {task.itemType}</span>
                      </div>
                      <span className="text-xs text-zinc-500">{task.estimatedMinutes > 0 ? `${Math.round(task.estimatedMinutes / 60)}h est.` : '–'}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-zinc-600 pt-1">
                System will redistribute based on current team capacity and skill match.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button type="button"
              onClick={handleAutoRedistribute}
              disabled={redistributing || !absentDesigner || !absenceFrom || !absenceTo}
              className="cursor-pointer flex items-center gap-2 rounded-xl bg-[#6366f1] px-6 py-3 text-sm font-semibold text-white hover:bg-[#5558e3] disabled:opacity-50 transition-colors"
            >
              {redistributing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              Auto-Redistribute Tasks
            </button>
            <p className="text-xs text-zinc-600">Team will be notified via Lark</p>
          </div>
        </div>
      )}
    </div>
  )
}
