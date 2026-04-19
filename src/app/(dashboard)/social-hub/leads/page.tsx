'use client'

import { UserPlus, TrendingUp, Star, Zap, ArrowRight, Mail, Clock, CheckCircle2, Filter, Search } from 'lucide-react'
import { useState, useMemo } from 'react'

interface Lead {
  id: string
  name: string
  email: string
  phone?: string
  platform: string
  campaign: string
  source: string
  date: string
  status: 'new' | 'contacted' | 'qualified' | 'converted'
  notes?: string
}

const MOCK_LEADS: Lead[] = [
  {
    id: '1',
    name: 'Ahmad Faizal',
    email: 'faizal@techco.my',
    platform: 'instagram',
    campaign: 'Brand Awareness Apr',
    source: 'Story Link',
    date: '2026-04-18',
    status: 'new',
  },
  {
    id: '2',
    name: 'Siti Nurhaliza Bte Rahman',
    email: 'siti.nurhaliza@gmail.com',
    platform: 'linkedin',
    campaign: 'Thought Leadership',
    source: 'Article Comment',
    date: '2026-04-17',
    status: 'qualified',
  },
  {
    id: '3',
    name: 'Lim Wei Jian',
    email: 'weijian.lim@startup.io',
    platform: 'instagram',
    campaign: 'Brand Awareness Apr',
    source: 'Bio Link',
    date: '2026-04-17',
    status: 'contacted',
  },
  {
    id: '4',
    name: 'Priya Devi Krishnan',
    email: 'priya@designco.my',
    platform: 'tiktok',
    campaign: 'Creative Showcase',
    source: 'Video CTA',
    date: '2026-04-16',
    status: 'converted',
  },
  {
    id: '5',
    name: 'Muhammad Haziq',
    email: 'haziq.creatives@gmail.com',
    platform: 'facebook',
    campaign: 'Local Business Week',
    source: 'Post Share',
    date: '2026-04-16',
    status: 'new',
  },
  {
    id: '6',
    name: 'Rachel Tan Mei Ling',
    email: 'rachel@brandstudio.my',
    platform: 'instagram',
    campaign: 'Brand Awareness Apr',
    source: 'Reel CTA',
    date: '2026-04-15',
    status: 'qualified',
  },
  {
    id: '7',
    name: 'Danial Ariff',
    email: 'danial.ariff@corp.my',
    platform: 'linkedin',
    campaign: 'Thought Leadership',
    source: 'DM Response',
    date: '2026-04-14',
    status: 'contacted',
  },
  {
    id: '8',
    name: 'Nurul Ain Bt Zulkifli',
    email: 'ain.zulkifli@email.com',
    platform: 'tiktok',
    campaign: 'Creative Showcase',
    source: 'Video Comment',
    date: '2026-04-13',
    status: 'new',
  },
  {
    id: '9',
    name: 'Kevin Chong',
    email: 'kevin@agencygroup.my',
    platform: 'instagram',
    campaign: 'Portfolio Launch',
    source: 'Story Poll',
    date: '2026-04-12',
    status: 'converted',
  },
  {
    id: '10',
    name: 'Amirah Binti Hassan',
    email: 'amirah.hassan@sme.my',
    platform: 'facebook',
    campaign: 'Local Business Week',
    source: 'Carousel Swipe',
    date: '2026-04-11',
    status: 'contacted',
  },
  {
    id: '11',
    name: 'Tan Boon Keat',
    email: 'boonkeat@venture.my',
    platform: 'linkedin',
    campaign: 'Thought Leadership',
    source: 'Article Like',
    date: '2026-04-10',
    status: 'new',
  },
  {
    id: '12',
    name: 'Farhana Bt Ramli',
    email: 'farhana@creative.io',
    platform: 'tiktok',
    campaign: 'Creative Showcase',
    source: 'Duet Response',
    date: '2026-04-09',
    status: 'qualified',
  },
  {
    id: '13',
    name: 'Joseph Raj',
    email: 'joseph.raj@techsolutions.my',
    platform: 'instagram',
    campaign: 'Brand Awareness Apr',
    source: 'Bio Link',
    date: '2026-04-08',
    status: 'converted',
  },
  {
    id: '14',
    name: 'Zulaikha Bte Ahmad',
    email: 'zulaikha@enterprise.my',
    platform: 'instagram',
    campaign: 'Portfolio Launch',
    source: 'Reel CTA',
    date: '2026-04-07',
    status: 'new',
  },
  {
    id: '15',
    name: 'Marcus Wong',
    email: 'marcus@digitalfirm.my',
    platform: 'linkedin',
    campaign: 'Thought Leadership',
    source: 'Comment Thread',
    date: '2026-04-06',
    status: 'qualified',
  },
]

const platformColors: Record<string, { emoji: string; color: string; bgColor: string }> = {
  instagram: { emoji: '📷', color: '#ec4899', bgColor: 'from-pink-500/20 to-rose-500/20' },
  tiktok: { emoji: '🎵', color: '#000000', bgColor: 'from-gray-900/20 to-gray-800/20' },
  linkedin: { emoji: '💼', color: '#0077b5', bgColor: 'from-blue-500/20 to-cyan-500/20' },
  facebook: { emoji: '👍', color: '#1877f2', bgColor: 'from-blue-600/20 to-blue-500/20' },
  other: { emoji: '🌐', color: '#6366f1', bgColor: 'from-indigo-500/20 to-purple-500/20' },
}

export default function LeadsPage() {
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [platformFilter, setPlatformFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [addedLeads, setAddedLeads] = useState<Record<string, boolean>>({})

  const platformBreakdown = [
    { name: 'Instagram', count: 5, platform: 'instagram', percentage: 38 },
    { name: 'TikTok', count: 4, platform: 'tiktok', percentage: 26 },
    { name: 'LinkedIn', count: 4, platform: 'linkedin', percentage: 19 },
    { name: 'Facebook', count: 2, platform: 'facebook', percentage: 11 },
    { name: 'Other', count: 1, platform: 'other', percentage: 6 },
  ]

  const filteredLeads = useMemo(() => {
    return MOCK_LEADS.filter((lead) => {
      const matchesStatus = !statusFilter || lead.status === statusFilter
      const matchesPlatform = !platformFilter || lead.platform === platformFilter
      const matchesSearch =
        !searchQuery ||
        lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesStatus && matchesPlatform && matchesSearch
    })
  }, [statusFilter, platformFilter, searchQuery])

  const convertedCount = MOCK_LEADS.filter((l) => l.status === 'converted').length
  const conversionRate = Math.round((convertedCount / MOCK_LEADS.length) * 100)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'border-amber-500/30 bg-amber-500/10 text-amber-400'
      case 'contacted':
        return 'border-sky-500/30 bg-sky-500/10 text-sky-400'
      case 'qualified':
        return 'border-violet-500/30 bg-violet-500/10 text-violet-400'
      case 'converted':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
      default:
        return 'border-zinc-700 bg-zinc-800 text-zinc-400'
    }
  }

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  const handleAddToCRM = (leadId: string) => {
    setAddedLeads({ ...addedLeads, [leadId]: true })
    setTimeout(() => {
      setAddedLeads({ ...addedLeads, [leadId]: false })
    }, 2000)
  }

  const getPlatformInfo = (platform: string) => {
    return platformColors[platform] || platformColors['other']
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserPlus className="h-8 w-8 text-[#818cf8]" />
          <div>
            <h1 className="text-3xl font-bold text-white">Lead Collection</h1>
            <p className="text-sm text-zinc-400">Social-sourced contacts flowing to CRM</p>
          </div>
        </div>
        <a
          href="/crm"
          className="flex items-center gap-2 rounded-lg border border-[#6366f1]/30 bg-[#6366f1]/10 px-4 py-2 text-sm font-medium text-[#818cf8] hover:bg-[#6366f1]/20 transition-colors"
        >
          View CRM
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>

      {/* KPI Cards */}
      <div className="mb-8 grid grid-cols-4 gap-6">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-400">Total Leads</span>
            <UserPlus className="h-5 w-5 text-violet-400" />
          </div>
          <h3 className="mb-2 text-3xl font-bold text-white">{MOCK_LEADS.length}</h3>
          <div className="text-xs font-medium text-violet-400">All time</div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-400">Converted</span>
            <TrendingUp className="h-5 w-5 text-emerald-400" />
          </div>
          <h3 className="mb-2 text-3xl font-bold text-white">
            {conversionRate}%
            <span className="text-lg text-zinc-400"> ({convertedCount})</span>
          </h3>
          <div className="text-xs font-medium text-emerald-400">Conversion rate</div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-400">Best Platform</span>
            <Star className="h-5 w-5 text-pink-400" />
          </div>
          <h3 className="mb-2 text-3xl font-bold text-white">Instagram</h3>
          <div className="text-xs font-medium text-pink-400">5 leads (38%)</div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-400">This Week</span>
            <Zap className="h-5 w-5 text-amber-400" />
          </div>
          <h3 className="mb-2 text-3xl font-bold text-white">+12</h3>
          <div className="text-xs font-medium text-amber-400">New leads</div>
        </div>
      </div>

      {/* Platform Breakdown */}
      <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur">
        <h2 className="mb-6 text-lg font-semibold text-white">Platform Source Breakdown</h2>
        <div className="space-y-4">
          {platformBreakdown.map((item, idx) => (
            <div key={idx} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getPlatformInfo(item.platform).emoji}</span>
                  <span className="text-sm font-medium text-white">{item.name}</span>
                </div>
                <div className="text-sm text-zinc-400">
                  {item.count} <span className="text-xs text-zinc-500">({item.percentage}%)</span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full bg-gradient-to-r ${getPlatformInfo(item.platform).bgColor}`}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-8 space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 py-2">
            <Search className="h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 outline-none"
            />
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-zinc-500" />
            <span className="text-xs font-medium text-zinc-400">Status:</span>
          </div>
          <button
            onClick={() => setStatusFilter(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === null
                ? 'border border-[#6366f1] bg-[#6366f1]/20 text-[#818cf8]'
                : 'border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            All
          </button>
          {['new', 'contacted', 'qualified', 'converted'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                statusFilter === status
                  ? 'border border-[#6366f1] bg-[#6366f1]/20 text-[#818cf8]'
                  : 'border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-zinc-500" />
            <span className="text-xs font-medium text-zinc-400">Platform:</span>
          </div>
          <button
            onClick={() => setPlatformFilter(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              platformFilter === null
                ? 'border border-[#6366f1] bg-[#6366f1]/20 text-[#818cf8]'
                : 'border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            All
          </button>
          {['instagram', 'tiktok', 'linkedin', 'facebook'].map((platform) => (
            <button
              key={platform}
              onClick={() => setPlatformFilter(platform)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                platformFilter === platform
                  ? 'border border-[#6366f1] bg-[#6366f1]/20 text-[#818cf8]'
                  : 'border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {getPlatformInfo(platform).emoji} {platform}
            </button>
          ))}
        </div>

        <div className="text-xs text-zinc-500">
          Showing {filteredLeads.length} of {MOCK_LEADS.length} leads
        </div>
      </div>

      {/* Leads Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="px-6 py-4 text-left font-medium text-zinc-400">Name & Email</th>
                <th className="px-6 py-4 text-left font-medium text-zinc-400">Platform</th>
                <th className="px-6 py-4 text-left font-medium text-zinc-400">Campaign</th>
                <th className="px-6 py-4 text-left font-medium text-zinc-400">Source</th>
                <th className="px-6 py-4 text-left font-medium text-zinc-400">Date</th>
                <th className="px-6 py-4 text-left font-medium text-zinc-400">Status</th>
                <th className="px-6 py-4 text-left font-medium text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead, idx) => (
                <tr key={lead.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="font-medium text-white">{lead.name}</div>
                      <div className="flex items-center gap-1 text-xs text-zinc-500">
                        <Mail className="h-3 w-3" />
                        {lead.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <span className="text-lg">{getPlatformInfo(lead.platform).emoji}</span>
                      <span className="text-xs font-medium text-zinc-300 capitalize">{lead.platform}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-zinc-300">{lead.campaign}</td>
                  <td className="px-6 py-4 text-zinc-400">{lead.source}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-xs text-zinc-400">
                      <Clock className="h-3 w-3" />
                      {new Date(lead.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block rounded-full border px-2 py-1 text-xs font-medium ${getStatusColor(
                        lead.status,
                      )}`}
                    >
                      {getStatusLabel(lead.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAddToCRM(lead.id)}
                        className="rounded-lg border border-[#6366f1]/30 bg-[#6366f1]/10 px-2 py-1 text-[10px] font-medium text-[#818cf8] hover:bg-[#6366f1]/20 transition-colors flex items-center gap-1"
                      >
                        {addedLeads[lead.id] ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            Added
                          </>
                        ) : (
                          'Add to CRM'
                        )}
                      </button>
                      <button className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors">
                        Mark Contacted
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredLeads.length === 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
          <UserPlus className="mx-auto mb-4 h-12 w-12 text-zinc-600" />
          <p className="text-zinc-400">No leads match your filters</p>
        </div>
      )}
    </div>
  )
}
