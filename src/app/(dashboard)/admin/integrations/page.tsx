'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import {
  ExternalLink,
  Zap,
  Radio,
  Mail,
  CheckCircle2,
  AlertCircle,
  Copy,
  ArrowRight,
  Shield,
  Clock,
  Webhook,
} from 'lucide-react'

interface Integration {
  id: string
  name: string
  tagline: string
  description: string
  usedFor: string[]
  envVars: string[]
  url: string
  docsUrl: string
  icon: React.ElementType
  color: string
  bg: string
  border: string
  buttonLabel: string
  priority: 'required' | 'recommended' | 'optional'
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'inngest',
    name: 'Inngest',
    tagline: 'Autonomous Agent Orchestration',
    description: 'Runs all 12 AI agents on schedule and via events. Without Inngest, agents only run manually from this page.',
    usedFor: [
      'Run AI agents on schedule (daily, weekly)',
      'Trigger agents from business events',
      'Retry failed agent runs automatically',
      'Monitor all agent activity in one dashboard',
    ],
    envVars: ['INNGEST_SIGNING_KEY', 'INNGEST_EVENT_KEY'],
    url: 'https://app.inngest.com',
    docsUrl: 'https://www.inngest.com/docs/sdk/serve',
    icon: Zap,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    buttonLabel: 'Open Inngest Dashboard',
    priority: 'required',
  },
  {
    id: 'pusher',
    name: 'Pusher',
    tagline: 'Real-time WebSocket Notifications',
    description: 'Powers live notifications across the dashboard — project updates, lead alerts, payment confirmations appear instantly without page refresh.',
    usedFor: [
      'Live project status updates',
      'Instant lead & payment notifications',
      'Real-time agent activity feed',
      'Team collaboration events',
    ],
    envVars: ['PUSHER_APP_ID', 'PUSHER_KEY', 'PUSHER_SECRET', 'NEXT_PUBLIC_PUSHER_KEY'],
    url: 'https://dashboard.pusher.com',
    docsUrl: 'https://pusher.com/docs/channels/getting_started/javascript/',
    icon: Radio,
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/30',
    buttonLabel: 'Open Pusher Dashboard',
    priority: 'recommended',
  },
  {
    id: 'resend',
    name: 'Resend',
    tagline: 'Transactional Email Delivery',
    description: 'Sends password resets, client notifications, invoice emails, and system alerts. Without Resend, email features are silently disabled.',
    usedFor: [
      'Password reset emails',
      'Client portal invite links',
      'System alert notifications',
      'Invoice / quotation email delivery',
    ],
    envVars: ['RESEND_API_KEY'],
    url: 'https://resend.com/api-keys',
    docsUrl: 'https://resend.com/docs/introduction',
    icon: Mail,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    buttonLabel: 'Open Resend Dashboard',
    priority: 'recommended',
  },
]

const PRIORITY_CONFIG = {
  required:    { label: 'Required',    color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30' },
  recommended: { label: 'Recommended', color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/30' },
  optional:    { label: 'Optional',    color: 'text-zinc-400',   bg: 'bg-zinc-800 border-zinc-700' },
}

function StepsPanel({ integration }: { integration: Integration }) {
  const steps: Record<string, { steps: string[] }> = {
    inngest: {
      steps: [
        'Sign up at inngest.com (free tier available)',
        'Create a new App → copy the Signing Key',
        'Create an Event Key from the same screen',
        'In Vercel → Settings → Environment Variables, add INNGEST_SIGNING_KEY and INNGEST_EVENT_KEY',
        'Redeploy from Vercel or push a new commit',
        'Return to Inngest → your app should appear and sync',
      ],
    },
    pusher: {
      steps: [
        'Sign up at pusher.com (free Sandbox plan)',
        'Create a new Channels app → choose region ap1 (Singapore)',
        'Go to App Keys tab and copy all 4 values',
        'In Vercel → add PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, NEXT_PUBLIC_PUSHER_KEY',
        'NEXT_PUBLIC_PUSHER_KEY is the same value as PUSHER_KEY',
        'Redeploy to activate real-time notifications',
      ],
    },
    resend: {
      steps: [
        'Sign up at resend.com (free tier: 3,000 emails/month)',
        'Add and verify your domain (e.g. envicionstudio.com.my)',
        'Go to API Keys → Create API Key with Send access',
        'In Vercel → add RESEND_API_KEY',
        'RESEND_FROM_EMAIL is already set — update it to match your verified domain',
        'Redeploy to enable transactional email',
      ],
    },
  }

  const cfg = steps[integration.id]
  if (!cfg) return null

  return (
    <div className="mt-4 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-2">
      <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Setup Steps</p>
      <ol className="space-y-1.5">
        {cfg.steps.map((step, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="flex-shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-[9px] font-bold text-zinc-400 mt-0.5">
              {i + 1}
            </span>
            <p className="text-xs text-zinc-400 leading-relaxed">{step}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}

function IntegrationCard({ integration }: { integration: Integration }) {
  const Icon = integration.icon
  const priority = PRIORITY_CONFIG[integration.priority]

  function copyEnvVars() {
    const text = integration.envVars.map(v => `${v}=`).join('\n')
    navigator.clipboard.writeText(text).catch(() => {})
  }

  return (
    <div className={`rounded-2xl border ${integration.border} bg-zinc-900/50 overflow-hidden`}>
      {/* Card header */}
      <div className={`${integration.bg} border-b ${integration.border} px-5 py-4`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${integration.bg} border ${integration.border}`}>
              <Icon className={`h-5 w-5 ${integration.color}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-100">{integration.name}</h3>
                <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${priority.bg} ${priority.color}`}>
                  {priority.label}
                </span>
              </div>
              <p className={`text-xs ${integration.color} font-medium`}>{integration.tagline}</p>
            </div>
          </div>
          {/* Status indicator */}
          <div className="flex items-center gap-1.5 flex-shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1">
            <AlertCircle className="h-3 w-3 text-amber-400" />
            <span className="text-[10px] font-semibold text-amber-400">Not Connected</span>
          </div>
        </div>
      </div>

      {/* Card body */}
      <div className="px-5 py-4 space-y-4">
        <p className="text-xs text-zinc-400 leading-relaxed">{integration.description}</p>

        {/* Used for list */}
        <div className="space-y-1.5">
          {integration.usedFor.map((use, i) => (
            <div key={i} className="flex items-center gap-2">
              <CheckCircle2 className={`h-3 w-3 flex-shrink-0 ${integration.color}`} />
              <p className="text-xs text-zinc-400">{use}</p>
            </div>
          ))}
        </div>

        {/* Env vars needed */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 space-y-1.5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Env Variables Required</p>
            <button
              type="button"
              onClick={copyEnvVars}
              className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <Copy className="h-2.5 w-2.5" /> Copy keys
            </button>
          </div>
          {integration.envVars.map(v => (
            <div key={v} className="flex items-center gap-2">
              <AlertCircle className="h-3 w-3 text-amber-400 flex-shrink-0" />
              <code className="text-xs text-amber-300 font-mono">{v}</code>
            </div>
          ))}
        </div>

        {/* Setup steps */}
        <StepsPanel integration={integration} />

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <a
            href={integration.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl border ${integration.border} ${integration.bg} py-2.5 text-sm font-semibold ${integration.color} hover:opacity-80 transition-all`}
          >
            <ExternalLink className="h-4 w-4" />
            {integration.buttonLabel}
          </a>
          <a
            href="https://vercel.com/carlson-envicionstuds-projects/envision-os/settings/environment-variables"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-all"
            title="Add keys to Vercel"
          >
            <Shield className="h-3.5 w-3.5" />
            Vercel Env
          </a>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && session.user.role !== 'ADMIN') router.push('/dashboard')
  }, [status, session, router])

  if (status === 'loading') {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Webhook className="h-5 w-5 text-[#818cf8]" />
            Service Integrations
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Connect third-party services to unlock autonomous agents, real-time updates, and email delivery.
          </p>
        </div>
        <a
          href="https://vercel.com/carlson-envicionstuds-projects/envision-os/settings/environment-variables"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:border-zinc-600 transition-all"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open Vercel Environment Variables
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Status summary */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-400">3 services not yet connected</p>
          <p className="text-xs text-zinc-400 mt-0.5">
            AI agents will only run manually until Inngest is connected. Real-time notifications are disabled until Pusher is configured. Email delivery requires Resend.
          </p>
        </div>
      </div>

      {/* How to connect — quick guide */}
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 px-5 py-4 space-y-2">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-[#818cf8]" /> How to connect — takes ~5 min per service
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 mt-2">
          {[
            { n: '1', text: 'Click "Open Dashboard" below to sign up / log in to the service' },
            { n: '2', text: 'Find or create the API key / credentials (links in the Setup Steps)' },
            { n: '3', text: 'Click "Vercel Env" → add the variables → redeploy' },
          ].map(step => (
            <div key={step.n} className="flex items-start gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5">
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#6366f1]/20 border border-[#6366f1]/30 text-[10px] font-bold text-[#818cf8]">{step.n}</span>
              <p className="text-xs text-zinc-400 leading-relaxed">{step.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Integration cards */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {INTEGRATIONS.map(integration => (
          <IntegrationCard key={integration.id} integration={integration} />
        ))}
      </div>

    </div>
  )
}
