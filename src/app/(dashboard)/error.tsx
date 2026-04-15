'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Dashboard Error]', error)
  }, [error])

  return (
    <div className="flex h-[60vh] items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 mb-4">
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>
        <h2 className="text-base font-semibold text-zinc-100 mb-1">
          Failed to load this page
        </h2>
        <p className="text-sm text-zinc-500 mb-5 leading-relaxed">
          Something went wrong while rendering this section.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-xl bg-[#6366f1] hover:bg-[#5558e3] px-4 py-2 text-sm font-semibold text-white transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
