'use client'

import { TrendingUp, Zap, AlertCircle, Banknote, LucideIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface StatItem {
  label: string
  value: string | number
  delta?: string
  tone: 'indigo' | 'emerald' | 'amber' | 'violet'
  icon: LucideIcon
}

interface ProjectStatsBarProps {
  totalProjects: number
  activeProjects: number
  needsAttention: number
  pipelineValue: number
  loading?: boolean
}

const TONE_STYLES: Record<StatItem['tone'], { ring: string; iconBg: string; iconColor: string; accent: string }> = {
  indigo: {
    ring: 'from-indigo-500/20 via-indigo-500/5 to-transparent',
    iconBg: 'bg-indigo-500/10',
    iconColor: 'text-indigo-400',
    accent: 'text-indigo-300',
  },
  emerald: {
    ring: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    accent: 'text-emerald-300',
  },
  amber: {
    ring: 'from-amber-500/20 via-amber-500/5 to-transparent',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-400',
    accent: 'text-amber-300',
  },
  violet: {
    ring: 'from-violet-500/20 via-violet-500/5 to-transparent',
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-400',
    accent: 'text-violet-300',
  },
}

export function ProjectStatsBar({
  totalProjects,
  activeProjects,
  needsAttention,
  pipelineValue,
  loading = false,
}: ProjectStatsBarProps) {
  const stats: StatItem[] = [
    {
      label: 'Total Projects',
      value: totalProjects,
      tone: 'indigo',
      icon: TrendingUp,
    },
    {
      label: 'Active Now',
      value: activeProjects,
      tone: 'emerald',
      icon: Zap,
    },
    {
      label: 'Needs Attention',
      value: needsAttention,
      tone: 'amber',
      icon: AlertCircle,
    },
    {
      label: 'Pipeline Value',
      value: formatCurrency(pipelineValue),
      tone: 'violet',
      icon: Banknote,
    },
  ]

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 animate-pulse"
          >
            <div className="h-4 bg-zinc-800 rounded w-24 mb-3" />
            <div className="h-8 bg-zinc-800 rounded w-20" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {stats.map((stat) => {
        const styles = TONE_STYLES[stat.tone]
        const Icon = stat.icon
        return (
          <div
            key={stat.label}
            className="group relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-5 transition-all hover:border-zinc-700 hover:bg-zinc-900/80"
          >
            <div
              className={`absolute inset-0 bg-gradient-to-br ${styles.ring} opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`}
            />
            <div className="relative flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold text-zinc-100 tabular-nums truncate">{stat.value}</p>
              </div>
              <div className={`flex-shrink-0 p-2.5 rounded-xl ${styles.iconBg}`}>
                <Icon className={`w-4 h-4 ${styles.iconColor}`} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
