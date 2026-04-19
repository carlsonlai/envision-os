'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  CalendarDays,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  Eye,
  X,
  ArrowRight,
  Zap,
} from 'lucide-react'

interface ScheduledPost {
  id: string
  platform: string
  caption: string
  hashtags: string[]
  imagePrompt: string | null
  bestTime: string | null
  contentType?: string
  status: string
  createdAt: string
  scheduledAt?: string
}

const PLATFORM_CFG: Record<
  string,
  { emoji: string; bg: string; text: string; dot: string }
> = {
  instagram: {
    emoji: '📸',
    bg: 'bg-pink-500/20',
    text: 'text-pink-400',
    dot: 'bg-pink-400',
  },
  tiktok: {
    emoji: '🎵',
    bg: 'bg-rose-500/20',
    text: 'text-rose-400',
    dot: 'bg-rose-400',
  },
  linkedin: {
    emoji: '💼',
    bg: 'bg-sky-500/20',
    text: 'text-sky-400',
    dot: 'bg-sky-400',
  },
  facebook: {
    emoji: '📘',
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    dot: 'bg-blue-400',
  },
  youtube: {
    emoji: '▶️',
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    dot: 'bg-red-400',
  },
  rednote: {
    emoji: '📕',
    bg: 'bg-red-500/10',
    text: 'text-red-300',
    dot: 'bg-red-300',
  },
  mailchimp: {
    emoji: '✉️',
    bg: 'bg-amber-500/20',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
  },
}

function getDaysInMonth(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const daysArray: Date[] = []

  const startDate = new Date(firstDay)
  startDate.setDate(startDate.getDate() - firstDay.getDay())

  const endDate = new Date(lastDay)
  endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()))

  let currentDate = new Date(startDate)
  while (currentDate <= endDate) {
    daysArray.push(new Date(currentDate))
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return daysArray
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getPlatformLabel(platform: string): string {
  const labels: Record<string, string> = {
    instagram: 'Instagram',
    tiktok: 'TikTok',
    linkedin: 'LinkedIn',
    facebook: 'Facebook',
    youtube: 'YouTube',
    rednote: '小红书',
    mailchimp: 'Newsletter',
  }
  return labels[platform] || platform
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function getStatusBadge(status: string): {
  icon: React.ReactNode
  label: string
  color: string
} {
  switch (status.toLowerCase()) {
    case 'posted':
      return { icon: <CheckCircle2 className="h-3 w-3" />, label: 'Posted', color: 'text-emerald-400' }
    case 'scheduled':
      return { icon: <Clock className="h-3 w-3" />, label: 'Scheduled', color: 'text-blue-400' }
    case 'approved':
      return { icon: <Eye className="h-3 w-3" />, label: 'Approved', color: 'text-amber-400' }
    default:
      return { icon: <Zap className="h-3 w-3" />, label: status, color: 'text-zinc-400' }
  }
}

export default function SocialCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 19))
  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [activePlatformFilter, setActivePlatformFilter] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response = await fetch('/api/social/autopilot')
        const data = await response.json()
        setPosts(
          Array.isArray(data.posts) ? data.posts : []
        )
      } catch (error) {
        setPosts([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchPosts()
  }, [])

  const daysInMonth = useMemo(() => getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth()), [currentDate])

  const postsByDate = useMemo(() => {
    const map = new Map<string, ScheduledPost[]>()
    posts.forEach(post => {
      const dateStr = post.scheduledAt ? formatDateKey(new Date(post.scheduledAt)) : formatDateKey(new Date(post.createdAt))
      if (!map.has(dateStr)) {
        map.set(dateStr, [])
      }
      map.get(dateStr)!.push(post)
    })
    return map
  }, [posts])

  const uniquePlatforms = useMemo(() => {
    const platforms = new Set<string>()
    posts.forEach(post => platforms.add(post.platform.toLowerCase()))
    return Array.from(platforms).sort()
  }, [posts])

  const stats = useMemo(() => {
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

    const monthPosts = posts.filter(post => {
      const postDate = new Date(post.scheduledAt || post.createdAt)
      return postDate >= monthStart && postDate <= monthEnd
    })

    const activePlatformsCount = new Set(monthPosts.map(p => p.platform.toLowerCase())).size
    const avgPerDay = monthPosts.length > 0 ? (monthPosts.length / new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()).toFixed(1) : '0'

    const nextPost = monthPosts
      .map(p => new Date(p.scheduledAt || p.createdAt))
      .filter(d => d >= new Date())
      .sort((a, b) => a.getTime() - b.getTime())[0]

    return {
      postsThisMonth: monthPosts.length,
      activePlatforms: activePlatformsCount,
      avgPerDay,
      nextPost: nextPost ? nextPost.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'None',
    }
  }, [posts, currentDate])

  const filteredPostsByDate = useMemo(() => {
    if (!activePlatformFilter) return postsByDate

    const filtered = new Map<string, ScheduledPost[]>()
    postsByDate.forEach((dayPosts, dateKey) => {
      const platformPosts = dayPosts.filter(p => p.platform.toLowerCase() === activePlatformFilter)
      if (platformPosts.length > 0) {
        filtered.set(dateKey, platformPosts)
      }
    })
    return filtered
  }, [postsByDate, activePlatformFilter])

  const selectedDayPosts = useMemo(() => {
    if (!selectedDay) return []
    const key = formatDateKey(selectedDay)
    return filteredPostsByDate.get(key) || []
  }, [selectedDay, filteredPostsByDate])

  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear()
  }

  const isToday = (date: Date): boolean => {
    const today = new Date()
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()
  }

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
    setSelectedDay(null)
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
    setSelectedDay(null)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
    setSelectedDay(new Date())
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0f]">
        <div className="text-zinc-400">Loading calendar...</div>
      </div>
    )
  }

  const hasPostsThisMonth = stats.postsThisMonth > 0

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded-lg bg-[#6366f1]/10 p-2">
                <CalendarDays className="h-6 w-6 text-[#6366f1]" />
              </div>
              <h1 className="text-3xl font-bold text-zinc-100">Social Calendar</h1>
            </div>
            <p className="text-sm text-zinc-400">All your scheduled content in one view</p>
          </div>

          <Link
            href="/social-hub/create"
            className="flex items-center gap-2 rounded-xl bg-[#6366f1] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#818cf8]"
          >
            <Sparkles className="h-4 w-4" />
            Generate Content
          </Link>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={previousMonth}
              className="rounded-lg border border-zinc-800 p-2 text-zinc-400 transition-all hover:bg-zinc-900/50 hover:text-zinc-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="w-40 text-center text-lg font-semibold text-zinc-100">{formatMonthYear(currentDate)}</h2>
            <button
              onClick={nextMonth}
              className="rounded-lg border border-zinc-800 p-2 text-zinc-400 transition-all hover:bg-zinc-900/50 hover:text-zinc-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <button
            onClick={goToToday}
            className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-all hover:border-zinc-600 hover:bg-zinc-900/50"
          >
            Today
          </button>
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {stats.postsThisMonth > 0 && (
            <>
              <div className="flex-shrink-0 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300">
                <span className="font-semibold text-zinc-100">{stats.postsThisMonth}</span> Posts This Month
              </div>
              <div className="flex-shrink-0 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300">
                <span className="font-semibold text-zinc-100">{stats.activePlatforms}</span> Platforms Active
              </div>
              <div className="flex-shrink-0 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300">
                <span className="font-semibold text-zinc-100">{stats.avgPerDay}</span> Avg per Day
              </div>
              <div className="flex-shrink-0 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300">
                Next Post: <span className="font-semibold text-zinc-100">{stats.nextPost}</span>
              </div>
            </>
          )}
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setActivePlatformFilter(null)}
            className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              activePlatformFilter === null
                ? 'bg-[#6366f1] text-white'
                : 'border border-zinc-700 text-zinc-400 hover:border-zinc-600'
            }`}
          >
            All
          </button>

          {uniquePlatforms.map(platform => (
            <button
              key={platform}
              onClick={() => setActivePlatformFilter(platform)}
              className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                activePlatformFilter === platform
                  ? 'bg-[#6366f1] text-white'
                  : 'border border-zinc-700 text-zinc-400 hover:border-zinc-600'
              }`}
            >
              {getPlatformLabel(platform)}
            </button>
          ))}
        </div>

        {!hasPostsThisMonth ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/50 py-20">
            <Sparkles className="mb-4 h-12 w-12 text-zinc-600" />
            <h3 className="mb-2 text-lg font-semibold text-zinc-200">No posts scheduled for this month</h3>
            <p className="mb-6 text-sm text-zinc-400">Create content to see it here</p>
            <Link
              href="/social-hub/create"
              className="flex items-center gap-2 rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#818cf8]"
            >
              Generate Content
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="grid grid-cols-7 gap-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                    <div
                      key={day}
                      className="pb-2 text-center text-xs font-semibold text-zinc-500 uppercase"
                    >
                      {day}
                    </div>
                  ))}

                  {daysInMonth.map((day, idx) => {
                    const dateKey = formatDateKey(day)
                    const dayPosts = filteredPostsByDate.get(dateKey) || []
                    const isCurrentMonthDay = isCurrentMonth(day)
                    const isTodayDay = isToday(day)
                    const isSelected = selectedDay && formatDateKey(selectedDay) === dateKey

                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedDay(day)}
                        className={`relative min-h-20 cursor-pointer rounded-xl border p-1.5 transition-all ${
                          !isCurrentMonthDay ? 'opacity-30' : ''
                        } ${
                          isSelected
                            ? 'border-[#6366f1] bg-[#6366f1]/10'
                            : isTodayDay
                              ? 'border-[#6366f1]/40 bg-[#6366f1]/5'
                              : 'border-zinc-800/60 bg-zinc-900/30'
                        } ${isCurrentMonthDay ? 'hover:border-zinc-700 hover:bg-zinc-900/50' : ''}`}
                      >
                        <div className="mb-1 text-right text-xs font-semibold text-zinc-300">{day.getDate()}</div>
                        <div className="flex flex-wrap gap-1">
                          {dayPosts.slice(0, 2).map(post => {
                            const cfg = PLATFORM_CFG[post.platform.toLowerCase()] || {
                              emoji: '📱',
                              bg: 'bg-zinc-800/50',
                              text: 'text-zinc-300',
                              dot: 'bg-zinc-400',
                            }
                            return (
                              <div
                                key={post.id}
                                className={`${cfg.bg} rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${cfg.text}`}
                              >
                                {cfg.emoji}
                              </div>
                            )
                          })}
                          {dayPosts.length > 2 && (
                            <div className="rounded-full bg-zinc-800/50 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-300">
                              +{dayPosts.length - 2}
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {selectedDay && selectedDayPosts.length > 0 && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold text-zinc-100">
                    {selectedDay.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </h3>
                  <button
                    onClick={() => setSelectedDay(null)}
                    className="text-zinc-500 transition-colors hover:text-zinc-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {selectedDayPosts.map(post => {
                    const cfg = PLATFORM_CFG[post.platform.toLowerCase()] || {
                      emoji: '📱',
                      bg: 'bg-zinc-800/50',
                      text: 'text-zinc-300',
                      dot: 'bg-zinc-400',
                    }
                    const statusInfo = getStatusBadge(post.status)

                    return (
                      <div
                        key={post.id}
                        className="rounded-lg border border-zinc-800/50 bg-zinc-900/30 p-3"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <div className={`flex items-center gap-1 rounded-full ${cfg.bg} px-2 py-1 text-xs font-semibold ${cfg.text}`}>
                            <span>{cfg.emoji}</span>
                            <span>{getPlatformLabel(post.platform)}</span>
                          </div>
                          <div className={`flex items-center gap-1 text-xs ${statusInfo.color}`}>
                            {statusInfo.icon}
                            <span className="font-medium">{statusInfo.label}</span>
                          </div>
                        </div>

                        <p className="mb-2 text-xs text-zinc-300 line-clamp-2">{post.caption}</p>

                        {post.bestTime && (
                          <div className="flex items-center gap-1 text-xs text-zinc-500">
                            <Clock className="h-3 w-3" />
                            {post.bestTime}
                          </div>
                        )}

                        {post.hashtags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {post.hashtags.slice(0, 3).map((tag, i) => (
                              <span key={i} className="text-[8px] text-[#6366f1]">
                                {tag}
                              </span>
                            ))}
                            {post.hashtags.length > 3 && (
                              <span className="text-[8px] text-zinc-500">
                                +{post.hashtags.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
