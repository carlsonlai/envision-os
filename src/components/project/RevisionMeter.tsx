'use client'

import { RotateCcw } from 'lucide-react'

interface RevisionMeterProps {
  used: number
  limit: number
  /** If "dark" the meter uses zinc-900 background colors; "light" uses zinc-100. */
  theme?: 'dark' | 'light'
  /** Show an icon + "Revisions" label above the bar. Defaults to true. */
  showLabel?: boolean
  /** Show "x/y used" counter text. Defaults to true. */
  showCount?: boolean
  /** Compact mode — smaller vertical padding. */
  compact?: boolean
}

export function RevisionMeter({
  used,
  limit,
  theme = 'light',
  showLabel = true,
  showCount = true,
  compact = false,
}: RevisionMeterProps) {
  const safeLimit = Math.max(limit, 1)
  const percent = Math.min(100, (used / safeLimit) * 100)
  const remaining = Math.max(limit - used, 0)
  const exhausted = used >= limit
  const warning = !exhausted && used / safeLimit >= 0.75

  const barColor = exhausted ? 'bg-red-500' : warning ? 'bg-amber-400' : 'bg-[#6366f1]'
  const textColor = exhausted
    ? theme === 'dark' ? 'text-red-400' : 'text-red-600'
    : warning
      ? theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
      : theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'
  const labelColor = theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'
  const trackColor = theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'

  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      {(showLabel || showCount) && (
        <div className="flex items-center justify-between text-xs">
          {showLabel && (
            <span className={`flex items-center gap-1 ${labelColor}`}>
              <RotateCcw className="h-3 w-3" />
              Revisions
            </span>
          )}
          {showCount && (
            <span className={`font-medium tabular-nums ${textColor}`}>
              {used}/{limit} used
              {!compact && ` (${remaining} left)`}
            </span>
          )}
        </div>
      )}
      <div className={`h-1.5 w-full rounded-full ${trackColor} overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
