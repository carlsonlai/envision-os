'use client'

import { Globe, ExternalLink, AlertCircle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

const SETUP_STEPS = [
  {
    step: 1,
    title: 'Add Search Console scope to Google OAuth',
    detail: 'In Admin → Social Connect → YouTube, the current scope is youtube.readonly only. You need to re-authorise with webmasters.readonly added.',
    done: false,
  },
  {
    step: 2,
    title: 'Verify your site in Search Console',
    detail: 'Go to search.google.com/search-console → Add property → enter https://envicionstudio.com.my',
    url: 'https://search.google.com/search-console',
    done: false,
  },
  {
    step: 3,
    title: 'Connect Google account in Admin → Social Connect',
    detail: 'Re-run the Google OAuth flow with the updated scope so the access token covers Search Console.',
    url: '/admin/social-connect',
    done: false,
  },
]

export default function SearchConsolePage() {
  const isConnected = !!(
    process.env.NEXT_PUBLIC_GSC_CONNECTED === 'true'
  )

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Globe className="h-5 w-5 text-emerald-400" />
            Search Console
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Google Search rankings, impressions, and keyword positions for envicionstudio.com.my
          </p>
        </div>
        <a
          href="https://search.google.com/search-console"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open Search Console
        </a>
      </div>

      {/* Not connected banner */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0" />
          <p className="text-sm font-medium text-amber-300">
            Search Console is not connected
          </p>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed">
          The current Google OAuth only grants YouTube access. To pull live ranking data, click positions, and impressions into this dashboard, complete the steps below.
        </p>
      </div>

      {/* Setup steps */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Setup steps</p>
        </div>
        <div className="divide-y divide-zinc-800/60">
          {SETUP_STEPS.map((s) => (
            <div key={s.step} className="flex items-start gap-4 px-5 py-4">
              <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold mt-0.5 ${s.done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                {s.done ? <CheckCircle2 className="h-4 w-4" /> : s.step}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200">{s.title}</p>
                <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{s.detail}</p>
                {s.url && (
                  s.url.startsWith('http') ? (
                    <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs text-[#818cf8] hover:underline">
                      <ExternalLink className="h-3 w-3" />
                      {s.url.replace('https://', '')}
                    </a>
                  ) : (
                    <Link href={s.url} className="inline-flex items-center gap-1 mt-2 text-xs text-[#818cf8] hover:underline">
                      Go to {s.url}
                    </Link>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* What you'll see once connected */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 space-y-3">
        <p className="text-sm font-medium text-zinc-300">Once connected you'll see:</p>
        <div className="grid grid-cols-2 gap-3 text-xs text-zinc-500">
          {[
            'Top ranking keywords with position changes',
            'Click-through rates per page',
            'Total impressions & clicks (28-day)',
            'Pages needing SEO attention',
            'Core Web Vitals pass/fail status',
            'Index coverage errors',
          ].map((item) => (
            <div key={item} className="flex items-start gap-1.5">
              <span className="text-zinc-700 mt-0.5">•</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick access to GSC */}
      <div className="flex gap-3">
        <a
          href="https://search.google.com/search-console/performance/search-analytics"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
        >
          <Globe className="h-4 w-4" />
          View live data in Search Console
        </a>
        <Link
          href="/admin/social-connect"
          className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:text-zinc-100 hover:border-zinc-500 transition-colors"
        >
          Set up Google connection
        </Link>
      </div>
    </div>
  )
}
