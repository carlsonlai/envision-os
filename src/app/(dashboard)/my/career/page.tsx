'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp,
  Star,
  Award,
  Target,
  CheckCircle2,
  Lock,
  Zap,
  Trophy,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react'
import type { CareerData, CareerAchievement, CareerGoal } from '@/app/api/my/career/route'

interface CareerLevel {
  title: string
  level: number
  minKPI: number
  salaryRange: string
  requirements: string[]
  perks: string[]
}

const CAREER_LEVELS: CareerLevel[] = [
  { title: 'Junior Designer', level: 1, minKPI: 60, salaryRange: 'RM 2,000 – 2,800', requirements: ['Complete onboarding', 'Pass 3-month review', 'Basic Figma proficiency'], perks: ['14 days annual leave', 'Medical coverage', 'EPF + SOCSO'] },
  { title: 'Graphic Designer', level: 2, minKPI: 65, salaryRange: 'RM 2,800 – 3,500', requirements: ['6+ months tenure', 'KPI ≥ 65 for 2 quarters', 'Handle independent briefs', 'No revision escalations'], perks: ['Transport allowance', 'Phone allowance', '+2 annual leave days'] },
  { title: 'Senior Graphic Designer', level: 3, minKPI: 72, salaryRange: 'RM 3,500 – 4,800', requirements: ['12+ months tenure', 'KPI ≥ 72 for 3 quarters', 'Mentor 1 junior', 'QC pass rate ≥ 90%'], perks: ['Freelance project allowance', '+training budget RM 500/yr', 'Flexible hours'] },
  { title: 'Art Director', level: 4, minKPI: 78, salaryRange: 'RM 4,800 – 6,500', requirements: ['18+ months as Senior', 'KPI ≥ 78 consistently', 'Lead 3+ campaigns', 'Client presentation skills'], perks: ['Annual bonus eligible', 'Conference allocation', 'Remote work 2d/week'] },
  { title: 'Senior Art Director', level: 5, minKPI: 85, salaryRange: 'RM 6,500 – 9,000', requirements: ['24+ months as AD', 'KPI ≥ 85', 'Manage team of 3+', 'Revenue contribution'], perks: ['20% bonus', 'Share of project profit', 'Full flexibility'] },
  { title: 'Creative Director', level: 6, minKPI: 90, salaryRange: 'RM 9,000+', requirements: ['Exceptional portfolio', 'KPI ≥ 90', 'Department leadership', 'New business wins'], perks: ['Executive package', 'Company equity options', 'Unlimited leave'] },
]

const CATEGORY_COLORS: Record<string, string> = {
  performance: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  milestone: 'text-[#818cf8] bg-[#6366f1]/10 border-[#6366f1]/20',
  skill: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  team: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
}

export default function MyCareerPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [careerData, setCareerData] = useState<CareerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'path' | 'achievements' | 'goals'>('path')
  const [expandedLevel, setExpandedLevel] = useState<number | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    setLoading(true)
    setLoadError(null)
    fetch('/api/my/career')
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{ data: CareerData }>
      })
      .then(({ data }) => {
        setCareerData(data)
        setExpandedLevel(data.currentLevel + 1) // auto-expand next level
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Failed to load career data')
      })
      .finally(() => setLoading(false))
  }, [status])

  if (loading || status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  if (loadError || !careerData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-red-400">{loadError ?? 'No career data available.'}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      </div>
    )
  }

  const {
    currentLevel,
    kpiScore,
    monthsAtCompany,
    achievements,
    goals,
  } = careerData

  const currentLevelData = CAREER_LEVELS[currentLevel - 1]
  const nextLevel = CAREER_LEVELS[currentLevel] // index = currentLevel (0-based, next is currentLevel)
  const unlockedCount = achievements.filter((a: CareerAchievement) => a.unlocked).length
  const kpiToNext = nextLevel ? Math.max(0, nextLevel.minKPI - kpiScore) : 0
  const requiredMonths: Record<number, number> = { 1: 3, 2: 6, 3: 12, 4: 18, 5: 24 }
  const monthsToNext = nextLevel ? Math.max(0, (requiredMonths[currentLevel] ?? 6) - monthsAtCompany) : 0

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#818cf8]" />
            Career Path & Achievements
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">Your growth journey at Envision Studios</p>
        </div>
        <p className="text-xs text-zinc-600">
          Logged in as <span className="text-zinc-400">{session?.user?.name}</span>
        </p>
      </div>

      {/* Current status card */}
      <div className="rounded-xl border border-[#6366f1]/30 bg-gradient-to-br from-[#6366f1]/10 to-[#8b5cf6]/5 p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-2xl shadow-lg shadow-[#6366f1]/20">
            🎨
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-lg font-bold text-zinc-100">{currentLevelData?.title ?? 'Staff'}</h2>
              <span className="rounded-full border border-[#6366f1]/30 bg-[#6366f1]/10 px-2 py-0.5 text-[10px] font-semibold text-[#818cf8]">Level {currentLevel}</span>
            </div>
            <p className="text-xs text-zinc-400">
              {monthsAtCompany} month{monthsAtCompany !== 1 ? 's' : ''} at Envision Studios · KPI Score:{' '}
              <span className={`font-bold ${kpiScore >= 80 ? 'text-emerald-400' : kpiScore >= 65 ? 'text-amber-400' : 'text-red-400'}`}>
                {kpiScore > 0 ? kpiScore : '—'}
              </span>
            </p>
            {nextLevel && (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Progress to {nextLevel.title}</span>
                  <span className="text-zinc-400">{kpiScore}/100</span>
                </div>
                <div className="h-2 w-full rounded-full bg-zinc-800/60">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6]"
                    style={{ width: `${Math.min(100, kpiScore)}%` }}
                  />
                </div>
                <div className="flex items-center gap-4 text-[10px] text-zinc-500">
                  {kpiToNext > 0 && (
                    <span className="flex items-center gap-1">
                      <Target className="h-3 w-3 text-amber-400" /> Need +{kpiToNext} KPI pts
                    </span>
                  )}
                  {monthsToNext > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-[#818cf8]" /> {monthsToNext} more month{monthsToNext !== 1 ? 's' : ''} tenure
                    </span>
                  )}
                  {kpiToNext <= 0 && monthsToNext <= 0 && (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> Eligible for promotion!
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-zinc-500 mb-0.5">Achievements</p>
            <p className="text-2xl font-bold text-amber-400">{unlockedCount}</p>
            <p className="text-[10px] text-zinc-600">of {achievements.length}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/50 p-1 w-fit">
        {[
          { key: 'path', label: 'Career Path', icon: TrendingUp },
          { key: 'achievements', label: `Achievements (${unlockedCount})`, icon: Trophy },
          { key: 'goals', label: 'My Goals', icon: Target },
        ].map((t) => {
          const Icon = t.icon
          return (
            <button
              type="button"
              key={t.key}
              onClick={() => setActiveTab(t.key as 'path' | 'achievements' | 'goals')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${activeTab === t.key ? 'bg-[#6366f1] text-white' : 'text-zinc-500 hover:text-zinc-200'}`}
            >
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab: Career Path */}
      {activeTab === 'path' && (
        <div className="space-y-2">
          {CAREER_LEVELS.map((level, i) => {
            const levelNum = i + 1
            const isCurrent = levelNum === currentLevel
            const isPast = levelNum < currentLevel
            const isNext = levelNum === currentLevel + 1
            const isFuture = levelNum > currentLevel
            const isExpanded = expandedLevel === levelNum

            return (
              <div
                key={level.title}
                className={`rounded-xl border overflow-hidden transition-all ${
                  isCurrent ? 'border-[#6366f1]/40 bg-[#6366f1]/5'
                  : isPast ? 'border-emerald-500/20 bg-emerald-500/5'
                  : isNext ? 'border-amber-500/20 bg-amber-500/5'
                  : 'border-zinc-800/40 bg-zinc-900/20'
                }`}
              >
                <div
                  className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setExpandedLevel(isExpanded ? null : levelNum)}
                >
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    isPast ? 'bg-emerald-500/20 text-emerald-400'
                    : isCurrent ? 'bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-white shadow shadow-[#6366f1]/20'
                    : isNext ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-zinc-800/60 text-zinc-600'
                  }`}>
                    {isPast ? <CheckCircle2 className="h-4 w-4" /> : isFuture ? <Lock className="h-3.5 w-3.5" /> : levelNum}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-semibold ${isCurrent ? 'text-[#818cf8]' : isPast ? 'text-emerald-400' : 'text-zinc-300'}`}>{level.title}</p>
                      {isCurrent && <span className="rounded-full border border-[#6366f1]/30 bg-[#6366f1]/10 px-2 py-0.5 text-[10px] font-semibold text-[#818cf8]">Current</span>}
                      {isNext && <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">Next Target</span>}
                      {isPast && <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">Achieved</span>}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">{level.salaryRange} · Min KPI {level.minKPI}</p>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-zinc-500 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-zinc-500 flex-shrink-0" />}
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-zinc-800/40 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Requirements</p>
                      {level.requirements.map((r, ri) => (
                        <div key={ri} className={`flex items-start gap-2 text-xs ${isPast ? 'text-emerald-400' : 'text-zinc-300'}`}>
                          {isPast ? <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" /> : <div className="h-1.5 w-1.5 rounded-full bg-zinc-600 mt-1.5 flex-shrink-0" />}
                          {r}
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Perks at This Level</p>
                      {level.perks.map((p, pi) => (
                        <div key={pi} className="flex items-start gap-2 text-xs text-zinc-400">
                          <Star className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-400" />
                          {p}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Tab: Achievements */}
      {activeTab === 'achievements' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(['performance', 'milestone', 'skill', 'team'] as const).map((cat) => {
              const count = achievements.filter((a: CareerAchievement) => a.category === cat && a.unlocked).length
              const total = achievements.filter((a: CareerAchievement) => a.category === cat).length
              return (
                <div key={cat} className={`rounded-xl border p-3 text-center ${CATEGORY_COLORS[cat]}`}>
                  <p className="text-lg font-bold">{count}/{total}</p>
                  <p className="text-[10px] capitalize font-medium">{cat}</p>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {achievements.map((a: CareerAchievement) => (
              <div key={a.id} className={`rounded-xl border p-3 text-center space-y-1.5 transition-all ${a.unlocked ? 'border-zinc-700/60 bg-zinc-800/30' : 'border-zinc-800/30 bg-zinc-900/20 opacity-50'}`}>
                <div className={`text-2xl ${!a.unlocked ? 'grayscale' : ''}`}>{a.icon}</div>
                <p className={`text-xs font-semibold ${a.unlocked ? 'text-zinc-200' : 'text-zinc-500'}`}>{a.title}</p>
                <p className="text-[10px] text-zinc-500 leading-relaxed">{a.desc}</p>
                {a.unlocked ? (
                  <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CATEGORY_COLORS[a.category]}`}>{a.earnedAt ?? '—'}</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] text-zinc-600"><Lock className="h-2.5 w-2.5" /> Locked</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Goals */}
      {activeTab === 'goals' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-[#6366f1]/20 bg-[#6366f1]/5 px-4 py-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#818cf8] flex-shrink-0" />
            <p className="text-xs text-zinc-300">These goals reflect your live progress this quarter. Completing them accelerates your path to the next level.</p>
          </div>
          {goals.map((goal: CareerGoal) => {
            const pct = goal.unit === 'escalations'
              ? goal.current === 0 ? 100 : Math.max(0, 100 - goal.current * 20)
              : Math.min(100, Math.round((goal.current / goal.target) * 100))
            const isDone = goal.unit === 'escalations' ? goal.current <= goal.target : goal.current >= goal.target
            return (
              <div key={goal.id} className={`rounded-xl border px-4 py-4 transition-all ${isDone ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-zinc-800/60 bg-zinc-900/40'}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-zinc-200">{goal.title}</p>
                      {isDone && (
                        <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400 font-semibold">
                          <CheckCircle2 className="h-3 w-3" /> Done
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-500">{goal.category} · Due {goal.deadline}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold ${isDone ? 'text-emerald-400' : 'text-zinc-200'}`}>
                      {goal.current} / {goal.target} {goal.unit}
                    </p>
                    <p className="text-[10px] text-zinc-500">{pct}%</p>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-zinc-800/60">
                  <div
                    className={`h-2 rounded-full transition-all ${isDone ? 'bg-emerald-400' : pct >= 70 ? 'bg-[#818cf8]' : pct >= 40 ? 'bg-amber-400' : 'bg-zinc-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
          <p className="text-[10px] text-zinc-600 pt-1">
            Note: &quot;Complete Figma Advanced&quot; requires manual verification — course completions are not yet tracked automatically.
          </p>
        </div>
      )}
    </div>
  )
}
