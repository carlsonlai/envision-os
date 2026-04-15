'use client'

import { useState } from 'react'
import {
  Brain,
  Sparkles,
  RefreshCw,
  TrendingUp,
  Users,
  Bot,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  BarChart3,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Zap,
  Shield,
  Target,
} from 'lucide-react'

interface RoleReport {
  role: string
  currentEfficiency: number
  automationPotential: number
  timeToReplace: string
  automatedTasks: string[]
  humanOnlyTasks: string[]
  aiToolsNeeded: string[]
  estimatedMonthlySavings: string
  replacementRoadmap: Array<{ phase: string; timeline: string; action: string }>
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  recommendation: string
}

interface RoleConfig {
  role: string
  label: string
  responsibilities: string[]
  teamSize: number
  avgSalary: string
  currentAIUsage: string
  icon: React.ElementType
  color: string
}

const ROLE_CONFIGS: RoleConfig[] = [
  {
    role: 'SALES',
    label: 'Sales Executive',
    responsibilities: ['Lead qualification', 'Proposal writing', 'Client follow-up', 'Pipeline management', 'WhatsApp outreach', 'Revenue forecasting'],
    teamSize: 1,
    avgSalary: 'RM 4,000-6,000/month',
    currentAIUsage: 'Lead scoring, upsell drafts',
    icon: TrendingUp,
    color: 'from-blue-500/20 to-indigo-500/20 border-blue-500/20',
  },
  {
    role: 'CLIENT_SERVICING',
    label: 'Client Servicing',
    responsibilities: ['Project updates', 'Client communication', 'Brief management', 'Invoice follow-up', 'Revision coordination', 'Client onboarding'],
    teamSize: 1,
    avgSalary: 'RM 3,500-5,500/month',
    currentAIUsage: 'Sentiment recovery drafts',
    icon: Users,
    color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/20',
  },
  {
    role: 'CREATIVE_DIRECTOR',
    label: 'Creative Director',
    responsibilities: ['QC reviews', 'Designer assignment', 'Brief quality check', 'Freelancer management', 'Creative standards', 'Client presentation'],
    teamSize: 1,
    avgSalary: 'RM 6,000-10,000/month',
    currentAIUsage: 'Brief quality check',
    icon: Zap,
    color: 'from-purple-500/20 to-violet-500/20 border-purple-500/20',
  },
  {
    role: 'GRAPHIC_DESIGNER',
    label: 'Graphic Designer',
    responsibilities: ['Design execution', 'File preparation', 'Revision implementation', 'Asset management', 'Template creation', 'Brand compliance'],
    teamSize: 2,
    avgSalary: 'RM 2,500-4,000/month',
    currentAIUsage: 'None currently',
    icon: Zap,
    color: 'from-pink-500/20 to-rose-500/20 border-pink-500/20',
  },
  {
    role: 'DIGITAL_MARKETING',
    label: 'Digital Marketing',
    responsibilities: ['Ad campaign management', 'Social media content', 'Analytics reporting', 'SEO/SEM', 'Email campaigns', 'A/B testing'],
    teamSize: 1,
    avgSalary: 'RM 3,000-5,000/month',
    currentAIUsage: 'None currently',
    icon: BarChart3,
    color: 'from-amber-500/20 to-orange-500/20 border-amber-500/20',
  },
  {
    role: 'JUNIOR_DESIGNER',
    label: 'Junior Designer',
    responsibilities: ['Simple design tasks', 'Template implementation', 'Asset resizing', 'File formatting', 'Basic revisions', 'Asset library maintenance'],
    teamSize: 2,
    avgSalary: 'RM 1,800-2,800/month',
    currentAIUsage: 'None currently',
    icon: Zap,
    color: 'from-cyan-500/20 to-sky-500/20 border-cyan-500/20',
  },
]

const RISK_CONFIG = {
  LOW: { label: 'Low Risk', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', icon: CheckCircle2 },
  MEDIUM: { label: 'Medium Risk', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', icon: AlertTriangle },
  HIGH: { label: 'High Risk', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', icon: AlertTriangle },
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  )
}

function RoleCard({ config, report, onGenerate, generating }: {
  config: RoleConfig
  report: RoleReport | null
  onGenerate: () => void
  generating: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const Icon = config.icon
  const risk = report ? RISK_CONFIG[report.riskLevel] : null
  const RiskIcon = risk?.icon ?? AlertTriangle

  return (
    <div className={`rounded-xl border bg-gradient-to-br p-5 space-y-4 ${config.color}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800/60">
            <Icon className="h-4 w-4 text-zinc-300" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">{config.label}</h3>
            <p className="text-[10px] text-zinc-500">{config.teamSize} staff · {config.avgSalary}</p>
          </div>
        </div>
        {report ? (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${risk?.bg} ${risk?.color}`}>
              <RiskIcon className="h-2.5 w-2.5" />
              {risk?.label}
            </span>
          </div>
        ) : (
          <button type="button"
            onClick={onGenerate}
            disabled={generating}
            className="cursor-pointer flex items-center gap-1.5 rounded-lg bg-[#6366f1]/15 border border-[#6366f1]/30 px-3 py-1.5 text-xs text-[#818cf8] hover:bg-[#6366f1]/25 transition-colors disabled:opacity-60 flex-shrink-0"
          >
            {generating ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {generating ? 'Analysing…' : 'Analyse'}
          </button>
        )}
      </div>

      {/* Report Content */}
      {report && (
        <div className="space-y-3">
          {/* Scores */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500">Current Efficiency</span>
                <span className="text-xs font-bold text-zinc-200">{report.currentEfficiency}%</span>
              </div>
              <ProgressBar value={report.currentEfficiency} color="bg-blue-500" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500">Automation Potential</span>
                <span className="text-xs font-bold text-[#818cf8]">{report.automationPotential}%</span>
              </div>
              <ProgressBar value={report.automationPotential} color="bg-[#6366f1]" />
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-zinc-900/40 border border-zinc-800/40 px-3 py-2 text-center">
              <p className="text-sm font-bold text-emerald-400">{report.estimatedMonthlySavings}</p>
              <p className="text-[9px] text-zinc-600">Monthly Savings</p>
            </div>
            <div className="rounded-lg bg-zinc-900/40 border border-zinc-800/40 px-3 py-2 text-center">
              <p className="text-sm font-bold text-amber-400">{report.timeToReplace}</p>
              <p className="text-[9px] text-zinc-600">Time to Replace</p>
            </div>
          </div>

          {/* Recommendation */}
          <div className="rounded-lg bg-zinc-900/40 border border-zinc-700/40 p-3">
            <p className="text-xs text-zinc-300 leading-relaxed">{report.recommendation}</p>
          </div>

          {/* Expandable Details */}
          <button type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-between text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-1"
          >
            <span>{expanded ? 'Hide' : 'Show'} full breakdown</span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {expanded && (
            <div className="space-y-3 pt-1 border-t border-zinc-800/40">
              {/* Tasks */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">Can Automate</p>
                  <div className="space-y-1">
                    {report.automatedTasks.map((task, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <Bot className="h-2.5 w-2.5 text-[#818cf8] flex-shrink-0" />
                        {task}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">Still Human</p>
                  <div className="space-y-1">
                    {report.humanOnlyTasks.map((task, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <Shield className="h-2.5 w-2.5 text-amber-500 flex-shrink-0" />
                        {task}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* AI Tools */}
              <div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">AI Tools Needed</p>
                <div className="flex flex-wrap gap-1.5">
                  {report.aiToolsNeeded.map((tool, i) => (
                    <span key={i} className="rounded-full border border-[#6366f1]/30 bg-[#6366f1]/10 px-2 py-0.5 text-[10px] text-[#818cf8]">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>

              {/* Roadmap */}
              <div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">Replacement Roadmap</p>
                <div className="space-y-2">
                  {report.replacementRoadmap.map((step, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#6366f1]/15 border border-[#6366f1]/30 text-[9px] font-bold text-[#818cf8]">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-zinc-300">{step.phase}</p>
                        <p className="text-[10px] text-zinc-600">{step.timeline} — {step.action}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AIReportPage() {
  const [reports, setReports] = useState<Record<string, RoleReport>>({})
  const [generating, setGenerating] = useState<string | null>(null)
  const [generatingAll, setGeneratingAll] = useState(false)

  const totalSavings = Object.values(reports).reduce((sum, r) => {
    const match = r.estimatedMonthlySavings.match(/RM\s*([\d,]+)/)
    return sum + (match ? parseInt(match[1].replace(',', '')) : 0)
  }, 0)

  const avgAutomation = Object.values(reports).length > 0
    ? Math.round(Object.values(reports).reduce((sum, r) => sum + r.automationPotential, 0) / Object.values(reports).length)
    : 0

  async function generateReport(config: RoleConfig) {
    setGenerating(config.role)
    try {
      const res = await fetch('/api/ai/replacement-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: config.label,
          responsibilities: config.responsibilities,
          teamSize: config.teamSize,
          avgSalary: config.avgSalary,
          currentAIUsage: config.currentAIUsage,
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as { data: RoleReport }
        setReports((prev) => ({ ...prev, [config.role]: data.data }))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setGenerating(null)
    }
  }

  async function generateAllReports() {
    setGeneratingAll(true)
    for (const config of ROLE_CONFIGS) {
      if (!reports[config.role]) {
        await generateReport(config)
        // Small delay between calls to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 800))
      }
    }
    setGeneratingAll(false)
  }

  const analysedCount = Object.keys(reports).length

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#6366f1] to-[#8b5cf6]">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-zinc-100">AI Replacement Report</h1>
          </div>
          <p className="text-sm text-zinc-500">
            Confidential analysis for Carlson (MD) — how to progressively replace each role with AI
          </p>
        </div>
        <button type="button"
          onClick={() => void generateAllReports()}
          disabled={generatingAll || analysedCount === ROLE_CONFIGS.length}
          className="flex items-center gap-2 rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-medium text-white hover:bg-[#5558e3] transition-colors disabled:opacity-60 flex-shrink-0"
        >
          {generatingAll ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {generatingAll ? 'Analysing All Roles…' : analysedCount === ROLE_CONFIGS.length ? 'All Analysed ✓' : 'Analyse All Roles'}
        </button>
      </div>

      {/* Summary Banner */}
      {analysedCount > 0 && (
        <div className="rounded-xl border border-[#6366f1]/30 bg-[#6366f1]/10 p-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-zinc-100">{analysedCount}/{ROLE_CONFIGS.length}</p>
              <p className="text-xs text-zinc-500">Roles Analysed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-400">
                {totalSavings > 0 ? `RM ${totalSavings.toLocaleString()}` : '–'}
              </p>
              <p className="text-xs text-zinc-500">Potential Monthly Savings</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-[#818cf8]">{avgAutomation > 0 ? `${avgAutomation}%` : '–'}</p>
              <p className="text-xs text-zinc-500">Avg Automation Potential</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-400">18 mo</p>
              <p className="text-xs text-zinc-500">Full Transition Timeline</p>
            </div>
          </div>
        </div>
      )}

      {/* Strategy Note */}
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-[#818cf8]" />
          <h2 className="text-sm font-semibold text-zinc-200">MD Strategy: Prove AI Then Replace</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {[
            { phase: 'Phase 1 — Now (0-3 months)', desc: 'Deploy AI agents alongside human staff. Track outputs. Show AI can match or exceed human quality on measurable tasks.', color: 'border-blue-500/20 bg-blue-500/5' },
            { phase: 'Phase 2 — Augment (3-9 months)', desc: 'Reduce human hours for automated tasks. Each role handles exceptions only. Cost reduction starts here.', color: 'border-amber-500/20 bg-amber-500/5' },
            { phase: 'Phase 3 — Replace (9-18 months)', desc: 'Full AI-first operations. 1 human overseer per department. 80%+ cost reduction in admin/repetitive roles.', color: 'border-emerald-500/20 bg-emerald-500/5' },
          ].map(({ phase, desc, color }) => (
            <div key={phase} className={`rounded-lg border p-3 ${color}`}>
              <p className="text-xs font-semibold text-zinc-200 mb-1">{phase}</p>
              <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Self-Improvement Loop */}
      <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-zinc-200">How AI Self-Improves in Envicion OS</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { step: '1', title: 'Log Every Action', desc: 'All AI decisions logged to AIAgentLog with inputs/outputs and success rates' },
            { step: '2', title: 'Score Outcomes', desc: 'Lead conversions, client satisfaction, and task completion tracked as KPIs' },
            { step: '3', title: 'Pattern Analysis', desc: 'Weekly brief identifies which AI actions led to deals, which failed — improve prompts' },
            { step: '4', title: 'Prompt Evolution', desc: 'Best-performing scripts fed back into AI prompts as few-shot examples' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/20 text-[10px] font-bold text-purple-400">{step}</span>
                <p className="text-xs font-semibold text-zinc-300">{title}</p>
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Role Cards Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {ROLE_CONFIGS.map((config) => (
          <RoleCard
            key={config.role}
            config={config}
            report={reports[config.role] ?? null}
            onGenerate={() => void generateReport(config)}
            generating={generating === config.role}
          />
        ))}
      </div>

      {/* AI Agents Already Running */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-zinc-200">AI Agents Already Deployed in Envicion OS</h2>
        </div>
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {[
            { name: 'AI Sales Agent', capabilities: 'Ad strategy, hook planning, prospect scripts, lead qualification, proposal drafting', replaces: 'Sales Executive (80% of tasks)', status: 'ACTIVE' },
            { name: 'AI CS Agent', capabilities: 'Client updates, feedback responses, invoice follow-ups, satisfaction monitoring', replaces: 'Client Servicing (75% of tasks)', status: 'ACTIVE' },
            { name: 'Lead Scoring AI', capabilities: 'Auto-scores leads HOT/WARM/COLD with reasoning and suggested action', replaces: 'Manual lead review (100%)', status: 'ACTIVE' },
            { name: 'Brief Quality AI', capabilities: 'Validates project briefs before designer assignment', replaces: 'CD quality gate check (60%)', status: 'ACTIVE' },
            { name: 'Weekly Strategy AI', capabilities: 'Generates MD strategy brief with revenue, utilisation, churn risks', replaces: 'Weekly strategy meeting prep (90%)', status: 'ACTIVE' },
            { name: 'Sentiment Recovery AI', capabilities: 'Detects at-risk clients, drafts recovery messages', replaces: 'CS client health monitoring (70%)', status: 'ACTIVE' },
          ].map((agent) => (
            <div key={agent.name} className="flex items-start gap-3 rounded-lg border border-zinc-800/40 bg-zinc-900/40 p-3">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
                <Bot className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-zinc-200">{agent.name}</p>
                  <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-1.5 py-0.5">
                    {agent.status}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-0.5">{agent.capabilities}</p>
                <p className="text-[10px] text-amber-400 mt-0.5">Replaces: {agent.replaces}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
