'use client'

import { Globe, Eye, TrendingUp, Award, ExternalLink, ArrowUp, ArrowDown, Minus, Target } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area } from 'recharts'
import { useMemo } from 'react'

interface KeywordRank {
  keyword: string
  position: number
  change: number
  impressions: number
  clicks: number
  ctr: string
}

interface TopPage {
  url: string
  impressions: number
  clicks: number
  ctr: string
}

interface KeywordOpportunity {
  keyword: string
  volume: number
  difficulty: 'easy' | 'medium' | 'hard'
}

export default function SearchConsolePage() {
  const trendData = useMemo(() => {
    const data = []
    const now = new Date()
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const baseImp = 300 + Math.sin(i / 5) * 100
      const baseClicks = Math.floor(baseImp * (0.065 + Math.random() * 0.01))
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        impressions: Math.floor(baseImp + Math.random() * 50),
        clicks: baseClicks + Math.floor(Math.random() * 10),
      })
    }
    return data
  }, [])

  const keywordRanks: KeywordRank[] = [
    { keyword: 'creative agency kuala lumpur', position: 8, change: 2, impressions: 1200, clicks: 89, ctr: '7.4%' },
    { keyword: 'branding agency malaysia', position: 12, change: 4, impressions: 980, clicks: 67, ctr: '6.8%' },
    { keyword: 'social media management kl', position: 6, change: 1, impressions: 870, clicks: 78, ctr: '9.0%' },
    { keyword: 'graphic design studio malaysia', position: 15, change: -1, impressions: 740, clicks: 42, ctr: '5.7%' },
    { keyword: 'video production malaysia', position: 11, change: 3, impressions: 620, clicks: 51, ctr: '8.2%' },
    { keyword: 'digital marketing agency kl', position: 19, change: 0, impressions: 590, clicks: 28, ctr: '4.7%' },
    { keyword: 'logo design malaysia', position: 7, change: 2, impressions: 480, clicks: 45, ctr: '9.4%' },
    { keyword: 'content creation agency', position: 22, change: 5, impressions: 410, clicks: 18, ctr: '4.4%' },
    { keyword: 'instagram marketing malaysia', position: 9, change: 1, impressions: 380, clicks: 34, ctr: '8.9%' },
    { keyword: 'envicion studios', position: 1, change: 0, impressions: 340, clicks: 312, ctr: '91.8%' },
  ]

  const topPages: TopPage[] = [
    { url: 'envicionstudios.com/', impressions: 2840, clicks: 312, ctr: '11.0%' },
    { url: 'envicionstudios.com/services', impressions: 2120, clicks: 156, ctr: '7.4%' },
    { url: 'envicionstudios.com/portfolio', impressions: 1890, clicks: 189, ctr: '10.0%' },
    { url: 'envicionstudios.com/blog/branding-tips', impressions: 1340, clicks: 134, ctr: '10.0%' },
    { url: 'envicionstudios.com/contact', impressions: 1210, clicks: 56, ctr: '4.6%' },
  ]

  const opportunities: KeywordOpportunity[] = [
    { keyword: 'envicion creative studio', volume: 480, difficulty: 'easy' },
    { keyword: 'best branding agency selangor', volume: 320, difficulty: 'medium' },
    { keyword: 'social media agency petaling jaya', volume: 210, difficulty: 'easy' },
    { keyword: 'affordable logo design kl', volume: 180, difficulty: 'medium' },
  ]

  const getPositionColor = (pos: number) => {
    if (pos <= 5) return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
    if (pos <= 15) return 'bg-amber-500/10 border-amber-500/30 text-amber-400'
    return 'bg-zinc-800 border-zinc-700 text-zinc-400'
  }

  const getDifficultyColor = (diff: string) => {
    if (diff === 'easy') return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
    if (diff === 'medium') return 'bg-amber-500/10 border-amber-500/30 text-amber-400'
    return 'bg-red-500/10 border-red-500/30 text-red-400'
  }

  const kpiCards = [
    {
      label: 'Total Impressions',
      value: '12,400',
      change: '+18%',
      icon: Eye,
      color: '#3b82f6',
    },
    {
      label: 'Total Clicks',
      value: '847',
      change: '+24%',
      icon: TrendingUp,
      color: '#10b981',
    },
    {
      label: 'Average CTR',
      value: '6.8%',
      change: '+0.5%',
      icon: TrendingUp,
      color: '#8b5cf6',
    },
    {
      label: 'Average Position',
      value: '14.2',
      change: '-2.1',
      changeType: 'improvement',
      icon: Award,
      color: '#f59e0b',
    },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="h-8 w-8 text-[#818cf8]" />
          <div>
            <h1 className="text-3xl font-bold text-white">Search Console</h1>
            <p className="text-sm text-zinc-400">Organic search performance & keyword opportunities</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2">
          <span className="text-xs font-medium text-amber-400">Connect Google Search Console for live data</span>
          <ExternalLink className="h-4 w-4 text-amber-400" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-8 grid grid-cols-4 gap-6">
        {kpiCards.map((card, idx) => {
          const Icon = card.icon
          const isImprovement = card.changeType === 'improvement'
          return (
            <div
              key={idx}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-400">{card.label}</span>
                <Icon className="h-5 w-5" style={{ color: card.color }} />
              </div>
              <div className="mb-3">
                <h3 className="text-3xl font-bold text-white">{card.value}</h3>
              </div>
              <div className={`text-xs font-medium ${isImprovement ? 'text-emerald-400' : 'text-sky-400'}`}>
                {card.change}
                {isImprovement && ' (improvement)'}
              </div>
            </div>
          )
        })}
      </div>

      {/* Clicks & Impressions Trend */}
      <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur">
        <h2 className="mb-4 text-lg font-semibold text-white">Clicks & Impressions Trend</h2>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={trendData}>
            <defs>
              <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="date" stroke="#71717a" style={{ fontSize: '12px' }} />
            <YAxis stroke="#71717a" style={{ fontSize: '12px' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181b',
                border: '1px solid #27272a',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#fafafa' }}
            />
            <Area
              type="monotone"
              dataKey="impressions"
              stroke="#6366f1"
              fillOpacity={1}
              fill="url(#colorImpressions)"
              name="Impressions"
            />
            <Area
              type="monotone"
              dataKey="clicks"
              stroke="#8b5cf6"
              fillOpacity={1}
              fill="url(#colorClicks)"
              name="Clicks"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Top Keywords Table */}
      <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Top Keywords</h2>
          <span className="text-xs font-medium text-zinc-500 bg-zinc-800/50 px-2 py-1 rounded">
            last 90 days
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-4 py-3 text-left font-medium text-zinc-400">Keyword</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-400">Position</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-400">Change</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-400">Impressions</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-400">Clicks</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-400">CTR</th>
              </tr>
            </thead>
            <tbody>
              {keywordRanks.map((row, idx) => (
                <tr key={idx} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                  <td className="px-4 py-3 text-white">{row.keyword}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-lg border px-2 py-1 text-xs font-medium ${getPositionColor(
                        row.position,
                      )}`}
                    >
                      {row.position}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {row.change > 0 && (
                        <>
                          <ArrowUp className="h-4 w-4 text-emerald-400" />
                          <span className="text-emerald-400">+{row.change}</span>
                        </>
                      )}
                      {row.change < 0 && (
                        <>
                          <ArrowDown className="h-4 w-4 text-red-400" />
                          <span className="text-red-400">{row.change}</span>
                        </>
                      )}
                      {row.change === 0 && <Minus className="h-4 w-4 text-zinc-500" />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{row.impressions.toLocaleString()}</td>
                  <td className="px-4 py-3 text-zinc-300">{row.clicks}</td>
                  <td className="px-4 py-3 text-zinc-300">{row.ctr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Pages Table */}
      <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur">
        <h2 className="mb-4 text-lg font-semibold text-white">Top Pages</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-4 py-3 text-left font-medium text-zinc-400">Page URL</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-400">Impressions</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-400">Clicks</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-400">CTR</th>
              </tr>
            </thead>
            <tbody>
              {topPages.map((row, idx) => (
                <tr key={idx} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                  <td className="px-4 py-3 text-white font-mono text-xs">{row.url}</td>
                  <td className="px-4 py-3 text-zinc-300">{row.impressions.toLocaleString()}</td>
                  <td className="px-4 py-3 text-zinc-300">{row.clicks}</td>
                  <td className="px-4 py-3 text-zinc-300">{row.ctr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Keyword Opportunities */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur">
        <h2 className="mb-6 flex items-center gap-2 text-lg font-semibold text-white">
          <Target className="h-5 w-5 text-[#6366f1]" />
          Keyword Opportunities
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {opportunities.map((opp, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-zinc-800 bg-zinc-800/30 p-4 hover:bg-zinc-800/50 transition-colors"
            >
              <h3 className="mb-3 text-sm font-semibold text-white">{opp.keyword}</h3>
              <div className="flex items-center justify-between">
                <div className="text-xs text-zinc-400">
                  <span className="font-medium text-zinc-300">{opp.volume}</span> searches/month
                </div>
                <span
                  className={`inline-block rounded-full border px-2 py-1 text-xs font-medium capitalize ${getDifficultyColor(
                    opp.difficulty,
                  )}`}
                >
                  {opp.difficulty}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
