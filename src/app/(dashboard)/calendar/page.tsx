'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Calendar, Circle, AlertCircle, CheckCircle2, Clock, Layers } from 'lucide-react'

interface AssignedUser {
  id: string
  name: string
  role: string
}

interface DeliverableItem {
  id: string
  itemType: string
  description: string | null
  status: string
  deadline: string | null
  assignedDesignerId: string | null
  assignedDesigner: AssignedUser | null
}

interface Project {
  id: string
  code: string
  status: string
  deadline: string | null
  assignedCS: { id: string; name: string; email: string } | null
  deliverableItems: DeliverableItem[]
  brief: { packageType: string | null; priority: string } | null
  client?: { id: string; name: string } | null
}

interface CalendarEvent {
  id: string
  title: string
  subtitle: string
  date: string // YYYY-MM-DD
  status: string
  type: 'project' | 'task'
  priority?: string
  projectCode?: string
  designer?: string | null
  cs?: string | null
  urgent: boolean
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  PENDING:     { bg: 'bg-zinc-800/80',    text: 'text-zinc-400',   dot: 'bg-zinc-500' },
  IN_PROGRESS: { bg: 'bg-blue-950/60',    text: 'text-blue-300',   dot: 'bg-blue-400' },
  IN_REVIEW:   { bg: 'bg-amber-950/60',   text: 'text-amber-300',  dot: 'bg-amber-400' },
  DONE:        { bg: 'bg-emerald-950/60', text: 'text-emerald-300',dot: 'bg-emerald-400' },
  APPROVED:    { bg: 'bg-emerald-950/60', text: 'text-emerald-300',dot: 'bg-emerald-400' },
  PROJECTED:   { bg: 'bg-zinc-800/80',    text: 'text-zinc-400',   dot: 'bg-zinc-500' },
  ACTIVE:      { bg: 'bg-blue-950/60',    text: 'text-blue-300',   dot: 'bg-blue-400' },
  COMPLETED:   { bg: 'bg-emerald-950/60', text: 'text-emerald-300',dot: 'bg-emerald-400' },
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function isDesignerRole(role: string): boolean {
  return ['GRAPHIC_DESIGNER','JUNIOR_DESIGNER','JUNIOR_ART_DIRECTOR','DESIGNER_3D','DIGITAL_MARKETING','SENIOR_ART_DIRECTOR'].includes(role)
}
function isCDRole(role: string): boolean {
  return ['CREATIVE_DIRECTOR','SENIOR_ART_DIRECTOR'].includes(role)
}

export default function CalendarPage() {
  const { data: session } = useSession()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [today] = useState(new Date())
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(toDateStr(today))
  const [view, setView] = useState<'month' | 'week'>('month')
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date(today)
    d.setDate(d.getDate() - d.getDay())
    return d
  })

  const userRole = session?.user?.role ?? ''
  const userId = session?.user?.id ?? ''

  useEffect(() => {
    if (!session) return
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => {
        // API returns { data: [...] } envelope
        const list = Array.isArray(data) ? data : (data?.data ?? [])
        setProjects(list)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [session])

  // Build calendar events from projects
  const events = useMemo<CalendarEvent[]>(() => {
    const list: CalendarEvent[] = []
    const todayStr = toDateStr(today)

    for (const project of projects) {
      // Project-level deadline
      if (project.deadline) {
        const dateStr = project.deadline.slice(0, 10)
        const urgent = dateStr <= todayStr
        list.push({
          id: `proj-${project.id}`,
          title: project.code,
          subtitle: project.brief?.packageType ?? project.status,
          date: dateStr,
          status: project.status,
          type: 'project',
          priority: project.brief?.priority,
          cs: project.assignedCS?.name ?? null,
          designer: null,
          urgent,
        })
      }

      // Deliverable item deadlines
      for (const item of project.deliverableItems ?? []) {
        // Designers only see their own tasks
        if (isDesignerRole(userRole) && item.assignedDesignerId !== userId) continue
        if (!item.deadline) continue
        const dateStr = item.deadline.slice(0, 10)
        const urgent = dateStr <= todayStr && item.status !== 'DONE' && item.status !== 'APPROVED'
        list.push({
          id: `item-${item.id}`,
          title: item.itemType.replace(/_/g, ' '),
          subtitle: item.description ?? project.code,
          date: dateStr,
          status: item.status,
          type: 'task',
          projectCode: project.code,
          designer: item.assignedDesigner?.name ?? null,
          cs: project.assignedCS?.name ?? null,
          urgent,
        })
      }
    }

    return list
  }, [projects, userRole, userId, today])

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const ev of events) {
      if (!map[ev.date]) map[ev.date] = []
      map[ev.date].push(ev)
    }
    return map
  }, [events])

  // Selected date events
  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] ?? []) : []

  // Month navigation
  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }
  function goToday() {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    setSelectedDate(toDateStr(today))
    const d = new Date(today)
    d.setDate(d.getDate() - d.getDay())
    setWeekStart(d)
  }

  // Week navigation
  function prevWeek() {
    setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d })
  }
  function nextWeek() {
    setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d })
  }

  // Build month grid
  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)
  const todayStr = toDateStr(today)

  // Build week days
  const weekDays: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    weekDays.push(d)
  }

  // Upcoming events (next 7 days) for sidebar
  const upcoming = useMemo(() => {
    const result: CalendarEvent[] = []
    for (let i = 0; i < 14; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      const ds = toDateStr(d)
      if (eventsByDate[ds]) result.push(...eventsByDate[ds])
    }
    return result.slice(0, 10)
  }, [eventsByDate, today])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#6366f1]" />
            Jobs Timeline
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {events.length} deadline{events.length !== 1 ? 's' : ''} tracked
            {' · '}
            {events.filter(e => e.urgent && e.status !== 'DONE' && e.status !== 'APPROVED').length} overdue or due today
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={goToday} className="cursor-pointer px-3 py-1.5 text-xs rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors border border-zinc-700">
            Today
          </button>
          <div className="flex rounded-md overflow-hidden border border-zinc-700">
            <button type="button"
              onClick={() => setView('month')}
              className={`px-3 py-1.5 text-xs transition-colors ${view === 'month' ? 'bg-[#6366f1] text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
            >
              Month
            </button>
            <button type="button"
              onClick={() => setView('week')}
              className={`px-3 py-1.5 text-xs transition-colors ${view === 'week' ? 'bg-[#6366f1] text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Calendar main */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Month/Week nav */}
          <div className="flex items-center justify-between">
            <button type="button"
              onClick={view === 'month' ? prevMonth : prevWeek}
              className="cursor-pointer h-7 w-7 rounded-md flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-zinc-200">
              {view === 'month'
                ? `${MONTH_NAMES[viewMonth]} ${viewYear}`
                : (() => {
                    const end = new Date(weekStart)
                    end.setDate(end.getDate() + 6)
                    return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                  })()
              }
            </span>
            <button type="button"
              onClick={view === 'month' ? nextMonth : nextWeek}
              className="cursor-pointer h-7 w-7 rounded-md flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 gap-px">
            {DAY_LABELS.map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-zinc-600 py-1">{d}</div>
            ))}
          </div>

          {view === 'month' ? (
            /* Month grid */
            <div className="grid grid-cols-7 gap-px flex-1 bg-zinc-800/30 rounded-lg overflow-hidden border border-zinc-800/60">
              {/* Empty cells before month start */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-[#0d0d14] min-h-[80px] p-1" />
              ))}
              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const dayEvents = eventsByDate[dateStr] ?? []
                const isToday = dateStr === todayStr
                const isSelected = dateStr === selectedDate
                const hasOverdue = dayEvents.some(e => e.urgent && e.status !== 'DONE' && e.status !== 'APPROVED')

                return (
                  <div
                    key={day}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`bg-[#0d0d14] min-h-[80px] p-1.5 cursor-pointer transition-colors hover:bg-zinc-800/50 ${isSelected ? 'ring-1 ring-inset ring-[#6366f1]/60' : ''}`}
                  >
                    <div className={`text-xs font-medium mb-1 w-5 h-5 flex items-center justify-center rounded-full ${
                      isToday
                        ? 'bg-[#6366f1] text-white'
                        : hasOverdue
                        ? 'text-red-400'
                        : 'text-zinc-500'
                    }`}>
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map(ev => {
                        const colors = STATUS_COLORS[ev.status] ?? STATUS_COLORS.PENDING
                        return (
                          <div
                            key={ev.id}
                            className={`flex items-center gap-1 rounded px-1 py-0.5 ${colors.bg}`}
                            title={`${ev.title} – ${ev.subtitle}`}
                          >
                            <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                            <span className={`truncate text-[9px] font-medium ${colors.text}`}>
                              {ev.type === 'task' ? ev.title : ev.title}
                            </span>
                          </div>
                        )
                      })}
                      {dayEvents.length > 3 && (
                        <div className="text-[9px] text-zinc-600 px-1">+{dayEvents.length - 3} more</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* Week grid */
            <div className="grid grid-cols-7 gap-px flex-1 bg-zinc-800/30 rounded-lg overflow-hidden border border-zinc-800/60">
              {weekDays.map((d) => {
                const dateStr = toDateStr(d)
                const dayEvents = eventsByDate[dateStr] ?? []
                const isToday = dateStr === todayStr
                const isSelected = dateStr === selectedDate
                const hasOverdue = dayEvents.some(e => e.urgent && e.status !== 'DONE')

                return (
                  <div
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`bg-[#0d0d14] min-h-[200px] p-2 cursor-pointer transition-colors hover:bg-zinc-800/50 ${isSelected ? 'ring-1 ring-inset ring-[#6366f1]/60' : ''}`}
                  >
                    <div className="flex flex-col items-center mb-2">
                      <span className="text-[10px] text-zinc-600 uppercase">{DAY_LABELS[d.getDay()]}</span>
                      <div className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-[#6366f1] text-white' : hasOverdue ? 'text-red-400' : 'text-zinc-300'
                      }`}>
                        {d.getDate()}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {dayEvents.map(ev => {
                        const colors = STATUS_COLORS[ev.status] ?? STATUS_COLORS.PENDING
                        return (
                          <div
                            key={ev.id}
                            className={`rounded px-1.5 py-1 ${colors.bg}`}
                          >
                            <div className="flex items-center gap-1">
                              <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                              <span className={`text-[10px] font-medium truncate ${colors.text}`}>{ev.title}</span>
                            </div>
                            {ev.projectCode && (
                              <div className="text-[9px] text-zinc-600 pl-2.5 truncate">{ev.projectCode}</div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-3">
          {/* Selected day details */}
          {selectedDate && (
            <div className="rounded-lg border border-zinc-800/60 bg-[#0d0d14] p-3 flex flex-col gap-2">
              <h3 className="text-xs font-semibold text-zinc-300">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h3>
              {selectedEvents.length === 0 ? (
                <p className="text-xs text-zinc-600">No deadlines on this day</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {selectedEvents.map(ev => {
                    const colors = STATUS_COLORS[ev.status] ?? STATUS_COLORS.PENDING
                    return (
                      <div key={ev.id} className={`rounded-md p-2 ${colors.bg} border border-zinc-800/40`}>
                        <div className="flex items-start gap-1.5">
                          <div className={`mt-0.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                          <div className="min-w-0 flex-1">
                            <div className={`text-xs font-medium truncate ${colors.text}`}>{ev.title}</div>
                            <div className="text-[10px] text-zinc-500 truncate">{ev.subtitle}</div>
                            {ev.type === 'task' && ev.projectCode && (
                              <div className="text-[9px] text-zinc-600 mt-0.5">Project: {ev.projectCode}</div>
                            )}
                            {/* Team info */}
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {ev.designer && (
                                <span className="flex items-center gap-0.5 text-[9px] text-zinc-500">
                                  <div className="h-3 w-3 rounded-full bg-[#6366f1]/20 flex items-center justify-center text-[6px] text-[#818cf8] font-bold">
                                    {ev.designer[0]}
                                  </div>
                                  {ev.designer}
                                </span>
                              )}
                              {ev.cs && (
                                <span className="flex items-center gap-0.5 text-[9px] text-zinc-500">
                                  <div className="h-3 w-3 rounded-full bg-emerald-500/20 flex items-center justify-center text-[6px] text-emerald-400 font-bold">
                                    {ev.cs[0]}
                                  </div>
                                  {ev.cs}
                                </span>
                              )}
                              {ev.urgent && ev.status !== 'DONE' && ev.status !== 'APPROVED' && (
                                <span className="text-[9px] text-red-400 font-medium">⚠ Overdue/Due today</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Upcoming deadlines */}
          <div className="rounded-lg border border-zinc-800/60 bg-[#0d0d14] p-3 flex flex-col gap-2 flex-1 min-h-0">
            <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-zinc-500" />
              Upcoming (14 days)
            </h3>
            {upcoming.length === 0 ? (
              <p className="text-xs text-zinc-600">No upcoming deadlines</p>
            ) : (
              <div className="space-y-1.5 overflow-y-auto flex-1">
                {upcoming.map(ev => {
                  const colors = STATUS_COLORS[ev.status] ?? STATUS_COLORS.PENDING
                  const daysLeft = Math.ceil((new Date(ev.date + 'T12:00:00').getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                  return (
                    <div
                      key={ev.id}
                      onClick={() => {
                        setSelectedDate(ev.date)
                        setViewYear(parseInt(ev.date.slice(0,4)))
                        setViewMonth(parseInt(ev.date.slice(5,7)) - 1)
                      }}
                      className={`rounded-md p-2 cursor-pointer hover:opacity-90 transition-opacity ${colors.bg} border border-zinc-800/30`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-[10px] font-medium truncate ${colors.text}`}>{ev.title}</span>
                        <span className={`text-[9px] flex-shrink-0 ${daysLeft <= 0 ? 'text-red-400' : daysLeft <= 2 ? 'text-amber-400' : 'text-zinc-500'}`}>
                          {daysLeft <= 0 ? 'Overdue' : daysLeft === 1 ? '1d' : `${daysLeft}d`}
                        </span>
                      </div>
                      <div className="text-[9px] text-zinc-600 truncate">
                        {new Date(ev.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {ev.projectCode ? ` · ${ev.projectCode}` : ''}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="rounded-lg border border-zinc-800/60 bg-[#0d0d14] p-3">
            <h3 className="text-[10px] font-semibold text-zinc-500 mb-2 uppercase tracking-wide">Legend</h3>
            <div className="space-y-1">
              {[
                { label: 'In Progress', status: 'IN_PROGRESS' },
                { label: 'Pending',     status: 'PENDING' },
                { label: 'In Review',   status: 'IN_REVIEW' },
                { label: 'Done',        status: 'DONE' },
              ].map(({ label, status }) => {
                const c = STATUS_COLORS[status]
                return (
                  <div key={status} className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${c.dot}`} />
                    <span className="text-[10px] text-zinc-500">{label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
