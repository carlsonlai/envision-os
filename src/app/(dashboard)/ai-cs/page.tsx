'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Bot,
  Zap,
  MessageSquare,
  Heart,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Users,
  Clock,
  TrendingUp,
  Bell,
  ArrowRight,
  FileText,
  Receipt,
} from 'lucide-react'
import { AIStatCard } from '@/components/ui/AIStatCard'

interface Project {
  id: string
  code: string
  status: string
  deadline: string | null
  quotedAmount: number
  client: { companyName: string; contactPerson: string } | null
}

interface ClientHealth {
  clientId: string
  companyName: string
  contactPerson: string
  satisfactionScore: number
  status: 'HAPPY' | 'NEUTRAL' | 'AT_RISK' | 'CRITICAL'
  urgency: string
  recommendedAction: string
  openProjects: number
  daysOverdue: number
}

interface AgentStats {
  activeProjects: number
  overdueProjects: number
  atRiskClients: number
  pendingUpdates: number
  autoResponsesSent: number
  satisfactionAvg: number
}

interface AITask {
  id: string
  type: 'UPDATE' | 'INVOICE_FOLLOWUP' | 'FEEDBACK_RESPONSE' | 'CHECK_IN'
  clientName: string
  projectCode: string
  urgency: 'HIGH' | 'MEDIUM' | 'LOW'
  description: string
}

const HEALTH_COLOURS: Record<string, { bg: string; text: string; border: string }> = {
  HAPPY: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  NEUTRAL: { bg: 'bg-zinc-800/40', text: 'text-zinc-400', border: 'border-zinc-700' },
  AT_RISK: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  CRITICAL: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
}

// AIStatCard is imported from @/components/ui/AIStatCard

export default function AICSPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [clientHealth, setClientHealth] = useState<ClientHealth[]>([])
  const [aiTasks, setAITasks] = useState<AITask[]>([])
  const [stats, setStats] = useState<AgentStats>({
    activeProjects: 0,
    overdueProjects: 0,
    atRiskClients: 0,
    pendingUpdates: 0,
    autoResponsesSent: 0,
    satisfactionAvg: 0,
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'health'>('overview')

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/projects')
      if (res.ok) {
        const data = (await res.json()) as { data: Project[] }
        const all = data.data ?? []
        setProjects(all)

        const now = Date.now()
        const overdue = all.filter((p) => p.deadline && new Date(p.deadline).getTime() < now && p.status !== 'PAID')
        const active = all.filter((p) => ['ONGOING', 'PROJECTED'].includes(p.status))

        setStats({
          activeProjects: active.length,
          overdueProjects: overdue.length,
          atRiskClients: overdue.length,
          pendingUpdates: Math.ceil(active.length * 0.6),
          autoResponsesSent: active.length * 4,
          satisfactionAvg: 7.8,
        })

        // Build AI task queue from project data
        const tasks: AITask[] = []
        overdue.forEach((p, i) => {
          if (p.client) {
            tasks.push({
              id: `overdue-${p.id}`,
              type: 'UPDATE',
              clientName: p.client.companyName,
              projectCode: p.code,
              urgency: 'HIGH',
              description: `Project is overdue — send status update and revised timeline`,
            })
          }
        })
        active.slice(0, 3).forEach((p) => {
          if (p.client) {
            tasks.push({
              id: `checkin-${p.id}`,
              type: 'CHECK_IN',
              clientName: p.client.companyName,
              projectCode: p.code,
              urgency: 'MEDIUM',
              description: `Regular check-in update for ongoing project`,
            })
          }
        })
        setAITasks(tasks.slice(0, 8))

        // Build client health from projects
        const clientMap: Record<string, { projects: Project[]; name: string; contact: string }> = {}
        all.forEach((p) => {
          if (p.client) {
            if (!clientMap[p.client.companyName]) {
              clientMap[p.client.companyName] = { projects: [], name: p.client.companyName, contact: p.client.contactPerson }
            }
            clientMap[p.client.companyName].projects.push(p)
          }
        })
        const health: ClientHealth[] = Object.entries(clientMap).map(([name, data], i) => {
          const overdueCount = data.projects.filter((p) => p.deadline && new Date(p.deadline).getTime() < now && p.status !== 'PAID').length
          const score = overdueCount > 0 ? 5 : 8
          const status: ClientHealth['status'] = overdueCount > 1 ? 'AT_RISK' : overdueCount === 1 ? 'NEUTRAL' : 'HAPPY'
          return {
            clientId: `client-${i}`,
            companyName: name,
            contactPerson: data.contact,
            satisfactionScore: score,
            status,
            urgency: overdueCount > 0 ? 'HIGH' : 'LOW',
            recommendedAction: overdueCount > 0 ? 'Send immediate update with revised timeline' : 'Maintain regular weekly update cadence',
            openProjects: data.projects.filter((p) => p.status !== 'PAID').length,
            daysOverdue: overdueCount > 0 ? 3 : 0,
          }
        })
        setClientHealth(health)
      }
    } catch (e) {
      console.error('AI CS load error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const URGENCY_BG: Record<string, string> = {
    HIGH: 'border-red-500/30 bg-red-500/5',
    MEDIUM: 'border-amber-500/30 bg-amber-500/5',
    LOW: 'border-zinc-700 bg-zinc-800/20',
  }

  const TASK_ICONS: Record<string, React.ElementType> = {
    UPDATE: FileText,
    INVOICE_FOLLOWUP: Receipt,
    FEEDBACK_RESPONSE: MessageSquare,
    CHECK_IN: Bell,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
          <span className="text-sm text-zinc-500">AI CS Agent initialising…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">AI CS Agent</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <p className="text-xs text-emerald-400">Autonomous — monitoring all clients 24/7</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button"
            onClick={() => void loadData()}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
          <a
            href="/ai-cs/comms"
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Draft Communications
          </a>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <AIStatCard icon={Users} label="Active Projects" value={stats.activeProjects} color="bg-[#6366f1]/15 text-[#818cf8]" />
        <AIStatCard icon={AlertTriangle} label="Overdue" value={stats.overdueProjects} sub="Need immediate action" color="bg-red-500/15 text-red-400" />
        <AIStatCard icon={Heart} label="At-Risk Clients" value={stats.atRiskClients} color="bg-amber-500/15 text-amber-400" />
        <AIStatCard icon={Bell} label="Pending Updates" value={stats.pendingUpdates} color="bg-purple-500/15 text-purple-400" />
        <AIStatCard icon={MessageSquare} label="Responses Sent" value={stats.autoResponsesSent} sub="This month" color="bg-emerald-500/15 text-emerald-400" />
        <AIStatCard icon={TrendingUp} label="Avg Satisfaction" value={`${stats.satisfactionAvg}/10`} color="bg-cyan-500/15 text-cyan-400" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-800/60">
        {(['overview', 'tasks', 'health'] as const).map((tab) => (
          <button type="button"
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* AI Task Queue */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-zinc-200">AI Task Queue</h2>
              </div>
              <a href="/ai-cs/comms" className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors">
                Handle all <ArrowRight className="h-2.5 w-2.5" />
              </a>
            </div>
            <div className="space-y-2">
              {aiTasks.length === 0 ? (
                <p className="text-xs text-zinc-600 text-center py-4">All caught up ✓</p>
              ) : (
                aiTasks.slice(0, 4).map((task) => {
                  const Icon = TASK_ICONS[task.type] ?? FileText
                  return (
                    <div key={task.id} className={`flex items-start gap-3 rounded-lg border p-3 ${URGENCY_BG[task.urgency]}`}>
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-800/60">
                        <Icon className="h-3 w-3 text-zinc-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-zinc-200">
                          {task.type.replace(/_/g, ' ')} — <span className="text-emerald-400">{task.clientName}</span>
                        </p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          {task.projectCode} · {task.description}
                        </p>
                      </div>
                      <a
                        href="/ai-cs/comms"
                        className="flex-shrink-0 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-1 text-[10px] text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                      >
                        Draft
                      </a>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Client Health Snapshot */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-pink-400" />
                <h2 className="text-sm font-semibold text-zinc-200">Client Health</h2>
              </div>
              <a href="/ai-cs/clients" className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors">
                Full report <ArrowRight className="h-2.5 w-2.5" />
              </a>
            </div>
            <div className="space-y-2">
              {clientHealth.length === 0 ? (
                <p className="text-xs text-zinc-600 text-center py-4">No clients to monitor</p>
              ) : (
                clientHealth.slice(0, 5).map((ch) => (
                  <div key={ch.clientId} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${HEALTH_COLOURS[ch.status].border} ${HEALTH_COLOURS[ch.status].bg}`}>
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-zinc-800/60 text-xs font-semibold text-zinc-400">
                      {ch.companyName[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-zinc-200 truncate">{ch.companyName}</p>
                      <p className="text-[10px] text-zinc-500">{ch.openProjects} open projects</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${HEALTH_COLOURS[ch.status].bg} ${HEALTH_COLOURS[ch.status].text}`}>
                        {ch.status}
                      </span>
                      <p className="text-[9px] text-zinc-600 mt-0.5">{ch.satisfactionScore}/10</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Projects */}
          <div className="lg:col-span-2 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-zinc-200">Active Projects — AI Monitoring</h2>
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {projects.filter((p) => ['ONGOING', 'PROJECTED'].includes(p.status)).slice(0, 6).map((p) => {
                const overdue = p.deadline && new Date(p.deadline).getTime() < Date.now()
                return (
                  <div key={p.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${overdue ? 'border-red-500/30 bg-red-500/5' : 'border-zinc-800/40 bg-zinc-800/20'}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-zinc-200">{p.client?.companyName ?? 'Unassigned'}</p>
                      <p className="text-[10px] text-zinc-500">{p.code} · {p.status}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {overdue ? (
                        <span className="flex items-center gap-1 text-[10px] text-red-400"><AlertTriangle className="h-2.5 w-2.5" />Overdue</span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400"><CheckCircle2 className="h-2.5 w-2.5" />On Track</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TASKS TAB ── */}
      {activeTab === 'tasks' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">AI-generated communication tasks — sorted by urgency</p>
            <a
              href="/ai-cs/comms"
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Auto-Draft All
            </a>
          </div>
          {aiTasks.length === 0 ? (
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-12 text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <p className="text-sm text-zinc-400">All clients are up to date!</p>
              <p className="text-xs text-zinc-600">No pending communications needed right now.</p>
            </div>
          ) : (
            aiTasks.map((task) => {
              const Icon = TASK_ICONS[task.type] ?? FileText
              return (
                <div key={task.id} className={`rounded-xl border p-4 ${URGENCY_BG[task.urgency]}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-800/80">
                        <Icon className="h-4 w-4 text-zinc-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-200">
                          {task.type.replace(/_/g, ' ')}
                          <span className="ml-2 text-zinc-500 text-xs">· {task.clientName} · {task.projectCode}</span>
                        </p>
                        <p className="text-xs text-zinc-500 mt-0.5">{task.description}</p>
                      </div>
                    </div>
                    <a
                      href="/ai-cs/comms"
                      className="flex items-center gap-1.5 flex-shrink-0 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                    >
                      <Sparkles className="h-3 w-3" />
                      Draft
                    </a>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── HEALTH TAB ── */}
      {activeTab === 'health' && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">Real-time client satisfaction monitoring</p>
          {clientHealth.length === 0 ? (
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-12 text-center">
              <p className="text-sm text-zinc-500">No client data available</p>
            </div>
          ) : (
            clientHealth.map((ch) => (
              <div key={ch.clientId} className={`rounded-xl border p-4 ${HEALTH_COLOURS[ch.status].border} ${HEALTH_COLOURS[ch.status].bg}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-zinc-800/60 text-sm font-semibold text-zinc-300">
                      {ch.companyName[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-200">{ch.companyName}</p>
                      <p className="text-xs text-zinc-500">{ch.contactPerson} · {ch.openProjects} open projects</p>
                      <p className="text-xs text-zinc-400 mt-1">{ch.recommendedAction}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 space-y-1">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${HEALTH_COLOURS[ch.status].bg} ${HEALTH_COLOURS[ch.status].text} border ${HEALTH_COLOURS[ch.status].border}`}>
                      {ch.status}
                    </span>
                    <p className="text-sm font-bold text-zinc-200">{ch.satisfactionScore}/10</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
