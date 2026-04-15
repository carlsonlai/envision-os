'use client'

import { useEffect, useState } from 'react'
import {
  Megaphone,
  Sparkles,
  Plus,
  RefreshCw,
  ChevronDown,
  Target,
  Eye,
  MousePointerClick,
  Users,
  Copy,
  Check,
} from 'lucide-react'

type Platform = 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK' | 'GOOGLE' | 'LINKEDIN' | 'YOUTUBE'
type Objective = 'AWARENESS' | 'ENGAGEMENT' | 'LEADS' | 'CONVERSION' | 'RETARGETING'

interface AdCampaign {
  id: string
  platform: Platform
  objective: Objective
  targetAudience: string | null
  budget: number | null
  hookAngle: string | null
  adCopy: string | null
  visualConcept: string | null
  callToAction: string | null
  status: string
  leadsGenerated: number
  clicks: number
  impressions: number
  spend: number
  createdAt: string
}

interface GeneratedStrategy {
  platform: string
  objective: string
  targetAudience: string
  budget: string
  duration: string
  hooks: string[]
  adCopy: string
  visualConcept: string
  callToAction: string
  kpis: string[]
}

const PLATFORMS: { value: Platform; label: string; emoji: string }[] = [
  { value: 'FACEBOOK', label: 'Facebook', emoji: '📘' },
  { value: 'INSTAGRAM', label: 'Instagram', emoji: '📸' },
  { value: 'TIKTOK', label: 'TikTok', emoji: '🎵' },
  { value: 'GOOGLE', label: 'Google', emoji: '🔍' },
  { value: 'LINKEDIN', label: 'LinkedIn', emoji: '💼' },
  { value: 'YOUTUBE', label: 'YouTube', emoji: '▶️' },
]

const OBJECTIVES: { value: Objective; label: string }[] = [
  { value: 'LEADS', label: 'Lead Generation' },
  { value: 'AWARENESS', label: 'Brand Awareness' },
  { value: 'CONVERSION', label: 'Conversion' },
  { value: 'ENGAGEMENT', label: 'Engagement' },
  { value: 'RETARGETING', label: 'Retargeting' },
]

function CopiedButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button type="button" onClick={copy} className="cursor-pointer rounded p-1 text-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0">
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

export default function AdCampaignsPage() {
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [strategy, setStrategy] = useState<GeneratedStrategy | null>(null)
  const [showBuilder, setShowBuilder] = useState(false)

  const [form, setForm] = useState({
    service: 'Brand Identity Design',
    targetIndustry: 'F&B / Retail',
    budget: 'RM 2,000/month',
    goal: 'Generate 20 qualified leads per month',
  })

  useEffect(() => {
    void fetch('/api/ai/ad-campaign')
      .then(async (r) => r.ok ? (await r.json() as { data: AdCampaign[] }).data ?? [] : [])
      .then((data) => { setCampaigns(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function generateStrategy() {
    setGenerating(true)
    setStrategy(null)
    try {
      const res = await fetch('/api/ai/sales-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'GENERATE_AD_STRATEGY', ...form }),
      })
      if (res.ok) {
        const data = (await res.json()) as { data: GeneratedStrategy }
        setStrategy(data.data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setGenerating(false)
    }
  }

  async function saveCampaign() {
    if (!strategy) return
    try {
      const platformMap: Record<string, Platform> = {
        FB: 'FACEBOOK', FACEBOOK: 'FACEBOOK', IG: 'INSTAGRAM', INSTAGRAM: 'INSTAGRAM',
        TIKTOK: 'TIKTOK', GOOGLE: 'GOOGLE', LINKEDIN: 'LINKEDIN', YOUTUBE: 'YOUTUBE',
      }
      const objectiveMap: Record<string, Objective> = {
        LEADS: 'LEADS', AWARENESS: 'AWARENESS', CONVERSION: 'CONVERSION',
        ENGAGEMENT: 'ENGAGEMENT', RETARGETING: 'RETARGETING',
      }
      const res = await fetch('/api/ai/ad-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: platformMap[strategy.platform.toUpperCase()] ?? 'INSTAGRAM',
          objective: objectiveMap[strategy.objective.toUpperCase()] ?? 'LEADS',
          targetAudience: strategy.targetAudience,
          budget: parseFloat(form.budget.replace(/[^0-9.]/g, '')) || 2000,
          hookAngle: strategy.hooks[0] ?? '',
          adCopy: strategy.adCopy,
          visualConcept: strategy.visualConcept,
          callToAction: strategy.callToAction,
        }),
      })
      if (res.ok) {
        const saved = (await res.json()) as { data: AdCampaign }
        setCampaigns((prev) => [saved.data, ...prev])
        setStrategy(null)
        setShowBuilder(false)
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Ad Campaigns</h1>
          <p className="text-sm text-zinc-500 mt-0.5">AI-planned and managed ad campaigns</p>
        </div>
        <button type="button"
          onClick={() => setShowBuilder(!showBuilder)}
          className="flex items-center gap-2 rounded-lg bg-[#6366f1] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#5558e3] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Campaign
        </button>
      </div>

      {/* ── AI Campaign Builder ── */}
      {showBuilder && (
        <div className="rounded-xl border border-[#6366f1]/30 bg-[#6366f1]/5 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#818cf8]" />
            <h2 className="text-sm font-semibold text-zinc-200">AI Ad Strategy Generator</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Service to Promote</label>
              <input
                value={form.service}
                onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#6366f1]/50"
                placeholder="e.g. Brand Identity Design"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Target Industry</label>
              <input
                value={form.targetIndustry}
                onChange={(e) => setForm((f) => ({ ...f, targetIndustry: e.target.value }))}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#6366f1]/50"
                placeholder="e.g. F&B, Retail, Healthcare"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Monthly Budget</label>
              <input
                value={form.budget}
                onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#6366f1]/50"
                placeholder="e.g. RM 2,000/month"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Campaign Goal</label>
              <input
                value={form.goal}
                onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#6366f1]/50"
                placeholder="e.g. 20 qualified leads/month"
              />
            </div>
          </div>

          <button type="button"
            onClick={() => void generateStrategy()}
            disabled={generating}
            className="flex items-center gap-2 rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-medium text-white hover:bg-[#5558e3] transition-colors disabled:opacity-60"
          >
            {generating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {generating ? 'Generating Strategy…' : 'Generate Full Ad Strategy'}
          </button>

          {/* Strategy Output */}
          {strategy && (
            <div className="mt-4 rounded-xl border border-zinc-700/60 bg-zinc-900/60 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-200">Generated Strategy</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">{strategy.platform} · {strategy.objective}</span>
                  <button type="button"
                    onClick={() => void saveCampaign()}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                  >
                    <Check className="h-3 w-3" />
                    Save Campaign
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Target Audience</p>
                  <p className="text-sm text-zinc-300">{strategy.targetAudience}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Budget & Duration</p>
                  <p className="text-sm text-zinc-300">{strategy.budget} · {strategy.duration}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Hook Angles</p>
                <div className="space-y-1">
                  {strategy.hooks.map((hook, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[#6366f1]/20 text-[9px] text-[#818cf8] font-bold">{i + 1}</span>
                      <p className="text-sm text-zinc-300">{hook}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Ad Copy</p>
                  <CopiedButton text={strategy.adCopy} />
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed bg-zinc-800/40 rounded-lg p-3">{strategy.adCopy}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Visual Concept</p>
                  <p className="text-sm text-zinc-300">{strategy.visualConcept}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Call to Action</p>
                  <p className="text-sm font-semibold text-[#818cf8]">{strategy.callToAction}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider">KPIs to Track</p>
                <div className="flex flex-wrap gap-2">
                  {strategy.kpis.map((kpi, i) => (
                    <span key={i} className="rounded-full border border-zinc-700 bg-zinc-800/40 px-2.5 py-1 text-xs text-zinc-400">{kpi}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Campaigns List */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-12 text-center space-y-3">
          <Megaphone className="h-10 w-10 text-zinc-700 mx-auto" />
          <p className="text-sm text-zinc-500">No campaigns yet</p>
          <p className="text-xs text-zinc-600">Create your first AI-generated ad strategy above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <div key={c.id} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-zinc-200">{c.platform}</p>
                    <span className="text-zinc-600">·</span>
                    <p className="text-xs text-zinc-500">{c.objective}</p>
                    <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      c.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      c.status === 'DRAFT' ? 'bg-zinc-800 text-zinc-500 border border-zinc-700' :
                      'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                  {c.targetAudience && <p className="text-xs text-zinc-500 truncate">Audience: {c.targetAudience}</p>}
                  {c.hookAngle && <p className="text-xs text-zinc-600 italic truncate">Hook: {c.hookAngle}</p>}
                  {c.adCopy && <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{c.adCopy}</p>}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-3 pt-4 border-t border-zinc-800/40">
                {[
                  { icon: Eye, label: 'Impressions', value: c.impressions.toLocaleString() },
                  { icon: MousePointerClick, label: 'Clicks', value: c.clicks.toLocaleString() },
                  { icon: Users, label: 'Leads', value: c.leadsGenerated },
                  { icon: Target, label: 'Spend', value: `RM ${c.spend.toFixed(0)}` },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="text-center">
                    <div className="flex items-center justify-center gap-1 text-zinc-600 mb-1">
                      <Icon className="h-3 w-3" />
                      <span className="text-[9px] uppercase tracking-wider">{label}</span>
                    </div>
                    <p className="text-sm font-bold text-zinc-200">{value}</p>
                  </div>
                ))}
              </div>

              {c.callToAction && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[10px] text-zinc-600">CTA:</span>
                  <span className="text-[10px] font-semibold text-[#818cf8] bg-[#6366f1]/10 border border-[#6366f1]/20 rounded px-2 py-0.5">{c.callToAction}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
