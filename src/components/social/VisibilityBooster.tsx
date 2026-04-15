'use client'

/**
 * VisibilityBooster — Envicion-specific playbook widget for the Social Hub.
 *
 * Goal: surface concrete, high-leverage actions that increase visibility for
 * Envicion Studios across its platforms. Each card is a direct CTA that either
 * opens the composer with a pre-loaded brief, navigates to analytics, or
 * triggers an autopilot task.
 */

import Link from 'next/link'
import {
  Megaphone,
  Users,
  TrendingUp,
  Search,
  Star,
  Share2,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react'

type Action = {
  title: string
  desc: string
  icon: typeof Megaphone
  href: string
  tone: 'amber' | 'cyan' | 'pink' | 'emerald' | 'violet' | 'rose'
  impact: 'High' | 'Medium'
}

const ACTIONS: Action[] = [
  {
    title: 'Publish a brand story reel',
    desc: 'Short-form reel showcasing a recent Envicion project. Reels drive the fastest follower growth.',
    icon: Sparkles,
    href: '/social-hub/create?contentType=reel&goal=brand_awareness&topic=Envicion%20project%20showcase',
    tone: 'amber',
    impact: 'High',
  },
  {
    title: 'Case study carousel',
    desc: 'LinkedIn carousel from a signed-off project. Signals authority + attracts enterprise leads.',
    icon: TrendingUp,
    href: '/social-hub/create?contentType=post&goal=thought_leadership&topic=Envicion%20case%20study',
    tone: 'cyan',
    impact: 'High',
  },
  {
    title: 'Client testimonial spotlight',
    desc: 'Turn a glowing testimonial into a shareable quote card. Social proof converts cold traffic.',
    icon: Star,
    href: '/social-hub/create?contentType=post&goal=sales&topic=Envicion%20client%20testimonial',
    tone: 'emerald',
    impact: 'High',
  },
  {
    title: 'Hashtag + SEO audit',
    desc: 'Review what hashtags and keywords your last 10 posts used. Swap out low performers.',
    icon: Search,
    href: '/social-hub/analytics?view=hashtags',
    tone: 'violet',
    impact: 'Medium',
  },
  {
    title: 'Engage top 20 followers',
    desc: 'Reply to their recent posts. Algorithm favours accounts with outbound engagement.',
    icon: Users,
    href: '/social-hub/analytics?view=top-followers',
    tone: 'rose',
    impact: 'Medium',
  },
  {
    title: 'Cross-post to all platforms',
    desc: 'Take your best-performing post and reformat for IG / LinkedIn / TikTok / RedNote.',
    icon: Share2,
    href: '/social-hub/create?contentType=post&goal=brand_awareness&multiplatform=1',
    tone: 'pink',
    impact: 'High',
  },
]

const TONE: Record<Action['tone'], { ring: string; icon: string; text: string }> = {
  amber:   { ring: 'border-amber-500/30 hover:border-amber-400/60 bg-amber-500/5',   icon: 'text-amber-300',   text: 'text-amber-200' },
  cyan:    { ring: 'border-cyan-500/30 hover:border-cyan-400/60 bg-cyan-500/5',      icon: 'text-cyan-300',    text: 'text-cyan-200' },
  pink:    { ring: 'border-pink-500/30 hover:border-pink-400/60 bg-pink-500/5',      icon: 'text-pink-300',    text: 'text-pink-200' },
  emerald: { ring: 'border-emerald-500/30 hover:border-emerald-400/60 bg-emerald-500/5', icon: 'text-emerald-300', text: 'text-emerald-200' },
  violet:  { ring: 'border-violet-500/30 hover:border-violet-400/60 bg-violet-500/5', icon: 'text-violet-300',   text: 'text-violet-200' },
  rose:    { ring: 'border-rose-500/30 hover:border-rose-400/60 bg-rose-500/5',      icon: 'text-rose-300',    text: 'text-rose-200' },
}

export function VisibilityBooster() {
  return (
    <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-amber-500/5 via-black/0 to-pink-500/5 p-5">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-amber-300" />
          <h2 className="text-lg font-semibold text-white">Envicion Visibility Booster</h2>
        </div>
        <span className="text-xs text-white/50">Playbook · refreshes daily</span>
      </header>

      <p className="text-sm text-white/60 mb-4">
        High-leverage moves to grow Envicion&apos;s visibility across Instagram, LinkedIn, TikTok,
        Facebook, YouTube, RedNote, and the Envicion mailing list.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {ACTIONS.map(a => {
          const t = TONE[a.tone]
          const Icon = a.icon
          return (
            <Link
              key={a.title}
              href={a.href}
              className={`group block rounded-xl border ${t.ring} p-4 transition`}
            >
              <div className="flex items-start justify-between mb-2">
                <Icon className={`w-5 h-5 ${t.icon}`} />
                <span className={`text-[10px] uppercase tracking-wide font-semibold ${t.text}`}>
                  {a.impact} impact
                </span>
              </div>
              <div className="text-sm font-semibold text-white mb-1 flex items-center gap-1">
                {a.title}
                <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition" />
              </div>
              <p className="text-xs text-white/60 leading-relaxed">{a.desc}</p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
