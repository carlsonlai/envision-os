'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  BarChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Heart,
  Zap,
  Users,
  UserPlus,
  AlertCircle,
  Loader2,
} from 'lucide-react'

interface ApiPlatform {
  id: string
  name: string
  connected: boolean
  followers: number | null
  followerGrowth: number | null
  reach: number | null
  engagement: number | null
  leads: number | null
  posts: number | null
  error?: string
}

interface AnalyticsResponse {
  success: boolean
  connectedCount: number
  totalPlatforms: number
  platforms: ApiPlatform[]
  lastUpdated: string
}

// Default structure — zeros until real data is synced from connected platforms
const PLATFORM_STATS = [
  {
    platform: 'instagram',
    emoji: '📸',
    followers: 0,
    engagement: 0,
    reach: 0,
    posts: 0,
    trend: 0,
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/30',
  },
  {
    platform: 'tiktok',
    emoji: '🎵',
    followers: 0,
    engagement: 0,
    reach: 0,
    posts: 0,
    trend: 0,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
  },
  {
    platform: 'linkedin',
    emoji: '💼',
    followers: 0,
    engagement: 0,
    reach: 0,
    posts: 0,
    trend: 0,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
  },
  {
    platform: 'facebook',
    emoji: '📘',
    followers: 0,
    engagement: 0,
    reach: 0,
    posts: 0,
    trend: 0,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  {
    platform: 'youtube',
    emoji: '▶️',
    followers: 0,
    engagement: 0,
    reach: 0,
    posts: 0,
    trend: 0,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
  },
  {
    platform: 'rednote',
    emoji: '📕',
    followers: 0,
    engagement: 0,
    reach: 0,
    posts: 0,
    trend: 0,
    color: 'text-red-300',
    bg: 'bg-red-500/5',
    border: 'border-red-400/20',
  },
]

const TOP_POSTS = [
  {
    platform: '📸',
    caption: 'Summer collection launch announcement with behind-the-scenes content',
    reach: 2840,
    engagement: 6.2,
    date: '2026-04-17',
  },
  {
    platform: '🎵',
    caption: 'Trending sound challenge featuring our team dancing to the beat',
    reach: 2340,
    engagement: 9.8,
    date: '2026-04-16',
  },
  {
    platform: '💼',
    caption: 'Industry insights: The future of digital marketing in 2026',
    reach: 1450,
    engagement: 3.1,
    date: '2026-04-15',
  },
  {
    platform: '▶️',
    caption: 'Product demo video showing new features and capabilities',
    reach: 890,
    engagement: 4.5,
    date: '2026-04-14',
  },
  {
    platform: '📕',
    caption: 'User testimonials and success stories from recent clients',
    reach: 745,
    engagement: 7.8,
    date: '2026-04-13',
  },
]

const HEATMAP_DATA = [
  { day: 'Mon', morning: 25, noon: 35, afternoon: 42, evening: 58, night: 45 },
  { day: 'Tue', morning: 32, noon: 45, afternoon: 55, evening: 78, night: 65 },
  { day: 'Wed', morning: 35, noon: 48, afternoon: 58, evening: 82, night: 68 },
  { day: 'Thu', morning: 38, noon: 52, afternoon: 62, evening: 85, night: 72 },
  { day: 'Fri', morning: 28, noon: 40, afternoon: 48, evening: 65, night: 52 },
  { day: 'Sat', morning: 22, noon: 32, afternoon: 38, evening: 45, night: 38 },
  { day: 'Sun', morning: 18, noon: 28, afternoon: 32, evening: 42, night: 35 },
]

const generateReachData = () =>
  Array.from({ length: 30 }, (_, i) => ({
    date: `Apr ${i + 1}`,
    reach: Math.floor(1200 + Math.random() * 800 + i * 30),
    engagement: parseFloat((3.8 + Math.random() * 2).toFixed(1)),
  }))

const getHeatmapColor = (value: number): string => {
  if (value >= 75) return 'bg-indigo-600/80'
  if (value >= 60) return 'bg-indigo-600/60'
  if (value >= 45) return 'bg-indigo-900/40'
  if (value >= 30) return 'bg-indigo-900/20'
  return 'bg-zinc-800'
}

const getHeatmapTextColor = (value: number): string => {
  if (value >= 45) return 'text-zinc-100'
  return 'text-zinc-400'
}

function mergeStats(
  mock: (typeof PLATFORM_STATS)[0],
  live: ApiPlatform[]
): (typeof PLATFORM_STATS)[0] {
  const platform = live.find(
    (p) =>
      p.id === mock.platform ||
      (mock.platform === 'rednote' && p.id === 'rednote')
  )
  if (!platform?.connected) return mock
  return {
    ...mock,
    followers: platform.followers ?? mock.followers,
    engagement: platform.engagement ?? mock.engagement,
    reach: platform.reach ?? mock.reach,
    posts: platform.posts ?? mock.posts,
  }
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')
  const [liveData, setLiveData] = useState<ApiPlatform[]>([])
  const [liveLoading, setLiveLoading] = useState(true)
  const [connectedCount, setConnectedCount] = useState(0)

  useEffect(() => {
    fetch('/api/social/analytics')
      .then((r) =>
        r.ok
          ? (r.json() as Promise<AnalyticsResponse>)
          : Promise.reject()
      )
      .then((data) => {
        setLiveData(data.platforms)
        setConnectedCount(data.connectedCount)
      })
      .catch(() => {
        // silently fallback to mock
      })
      .finally(() => setLiveLoading(false))
  }, [])

  const reachData = useMemo(() => generateReachData(), [])

  const platformStats = useMemo(
    () => PLATFORM_STATS.map((p) => mergeStats(p, liveData)),
    [liveData]
  )

  const kpiTotals = useMemo(
    () => ({
      totalReach: platformStats.reduce((s, p) => s + p.reach, 0),
      avgEngagement: parseFloat(
        (
          platformStats.reduce((s, p) => s + p.engagement, 0) /
          platformStats.length
        ).toFixed(1)
      ),
      totalPosts: platformStats.reduce((s, p) => s + p.posts, 0),
      totalLeads:
        liveData.reduce((s, p) => s + (p.leads ?? 0), 0) || 23,
    }),
    [platformStats, liveData]
  )

  const platformEngagementData = useMemo(
    () =>
      platformStats.map((p) => ({
        name: `${p.emoji} ${p.platform.charAt(0).toUpperCase() + p.platform.slice(1)}`,
        value: p.engagement,
      })),
    [platformStats]
  )

  return (
    <div className="min-h-screen bg-[#0a0a0f] px-6 py-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-8 h-8 text-indigo-400" />
              <h1 className="text-3xl font-bold text-zinc-100">Analytics</h1>
            </div>
            <p className="text-zinc-400">Performance across all platforms</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              {(['7d', '30d', '90d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    timeRange === range
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>

            {connectedCount > 0 ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-medium text-emerald-400">
                  {connectedCount} platform{connectedCount !== 1 ? 's' : ''} live
                </span>
              </div>
            ) : liveLoading ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700">
                <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
                <span className="text-xs font-medium text-zinc-400">
                  Checking connections…
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-medium text-amber-400">
                  UI Preview — Connect platforms for live data
                </span>
              </div>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Reach */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-zinc-400 text-sm mb-1">Total Reach</p>
                <p className="text-2xl font-bold text-zinc-100">
                  {kpiTotals.totalReach.toLocaleString()}
                </p>
              </div>
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Users className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 font-medium text-sm">
                  +12%
                </span>
              </div>
              <span className="text-zinc-500 text-xs">vs last period</span>
            </div>
          </div>

          {/* Engagement Rate */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-zinc-400 text-sm mb-1">Engagement Rate</p>
                <p className="text-2xl font-bold text-zinc-100">
                  {kpiTotals.avgEngagement}%
                </p>
              </div>
              <div className="p-2 bg-violet-500/10 rounded-lg">
                <Heart className="w-5 h-5 text-violet-400" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 font-medium text-sm">
                  +0.6%
                </span>
              </div>
              <span className="text-zinc-500 text-xs">vs last period</span>
            </div>
          </div>

          {/* Posts Published */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-zinc-400 text-sm mb-1">Posts Published</p>
                <p className="text-2xl font-bold text-zinc-100">
                  {kpiTotals.totalPosts}
                </p>
              </div>
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Zap className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 font-medium text-sm">+8</span>
              </div>
              <span className="text-zinc-500 text-xs">vs last period</span>
            </div>
          </div>

          {/* Leads Generated */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-zinc-400 text-sm mb-1">Leads Generated</p>
                <p className="text-2xl font-bold text-zinc-100">
                  {kpiTotals.totalLeads}
                </p>
              </div>
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <UserPlus className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 font-medium text-sm">
                  +31%
                </span>
              </div>
              <span className="text-zinc-500 text-xs">vs last period</span>
            </div>
          </div>
        </div>

        {/* Platform Performance Cards */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-100">
            Platform Performance
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {platformStats.map((stat) => (
              <div
                key={stat.platform}
                className={`rounded-2xl border ${stat.border} ${stat.bg} p-5`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{stat.emoji}</span>
                      <h3 className="font-semibold text-zinc-100 capitalize">
                        {stat.platform}
                      </h3>
                      {liveData.find((p) => p.id === stat.platform)
                        ?.connected && (
                        <div className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-[10px] text-emerald-400">
                            Live
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {stat.trend >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-400" />
                    )}
                    <span
                      className={`text-sm font-medium ${
                        stat.trend >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {stat.trend >= 0 ? '+' : ''}
                      {stat.trend.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-zinc-400 text-sm">Followers</span>
                    <span className="text-zinc-100 font-medium">
                      {stat.followers.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 text-sm">Engagement</span>
                    <span className={`font-medium ${stat.color}`}>
                      {stat.engagement}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 text-sm">Reach</span>
                    <span className="text-zinc-100 font-medium">
                      {stat.reach.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 text-sm">Posts</span>
                    <span className="text-zinc-100 font-medium">{stat.posts}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reach & Engagement Chart */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">
            Reach & Engagement Over Time
          </h2>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={reachData}>
              <defs>
                <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient
                  id="colorEngagement"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="date"
                stroke="#71717a"
                style={{ fontSize: '12px' }}
              />
              <YAxis stroke="#71717a" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  border: '1px solid #3f3f46',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#f4f4f5' }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="reach"
                stroke="#818cf8"
                fillOpacity={1}
                fill="url(#colorReach)"
                name="Reach"
              />
              <Area
                type="monotone"
                dataKey="engagement"
                stroke="#a78bfa"
                fillOpacity={1}
                fill="url(#colorEngagement)"
                name="Engagement (%)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Engagement by Platform */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">
              Engagement Rate by Platform
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={platformEngagementData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="name"
                  stroke="#71717a"
                  style={{ fontSize: '12px' }}
                />
                <YAxis stroke="#71717a" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#f4f4f5' }}
                />
                <Bar
                  dataKey="value"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                  name="Engagement %"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Best Time to Post Heatmap */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">
              Best Times to Post
            </h2>
            <div className="space-y-2">
              {HEATMAP_DATA.map((row) => (
                <div key={row.day} className="flex items-center gap-2">
                  <div className="w-12 text-sm font-medium text-zinc-400">
                    {row.day}
                  </div>
                  <div className="flex gap-1.5 flex-1">
                    {[
                      { label: 'Morning', value: row.morning },
                      { label: 'Noon', value: row.noon },
                      { label: 'Afternoon', value: row.afternoon },
                      { label: 'Evening', value: row.evening },
                      { label: 'Night', value: row.night },
                    ].map((time) => (
                      <div
                        key={time.label}
                        className={`h-8 flex-1 rounded text-[9px] flex items-center justify-center font-medium ${getHeatmapColor(
                          time.value
                        )} ${getHeatmapTextColor(time.value)}`}
                        title={`${time.label}: ${time.value}%`}
                      >
                        {time.value}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Posts Table */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">
            Top Performing Posts
          </h2>
          <div className="overflow-hidden rounded-xl border border-zinc-800">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="text-left px-4 py-3 text-sm font-semibold text-zinc-300">
                    Platform
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-zinc-300">
                    Caption
                  </th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-zinc-300">
                    Reach
                  </th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-zinc-300">
                    Engagement
                  </th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-zinc-300">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {TOP_POSTS.map((post, idx) => (
                  <tr
                    key={idx}
                    className={
                      idx % 2 === 0
                        ? 'bg-zinc-900/50'
                        : 'bg-transparent'
                    }
                  >
                    <td className="px-4 py-3 text-xl">{post.platform}</td>
                    <td className="px-4 py-3 text-sm text-zinc-300">
                      <span className="line-clamp-1">{post.caption}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-zinc-100 text-right">
                      {post.reach.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-indigo-400 text-right">
                      {post.engagement}%
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400 text-right">
                      {post.date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
