'use client'

interface ProjectProgressRingProps {
  /** Value between 0 and 1 */
  progress: number
  /** Pixel size of the ring */
  size?: number
  /** Stroke width in pixels */
  stroke?: number
  /** Center label text (defaults to percentage) */
  label?: string
  /** Tone color */
  tone?: 'indigo' | 'emerald' | 'amber' | 'red'
  /** Background ring opacity */
  trackOpacity?: number
}

const TONE_COLORS: Record<NonNullable<ProjectProgressRingProps['tone']>, string> = {
  indigo: '#6366f1',
  emerald: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
}

export function ProjectProgressRing({
  progress,
  size = 64,
  stroke = 6,
  label,
  tone = 'indigo',
  trackOpacity = 0.12,
}: ProjectProgressRingProps) {
  const clamped = Math.max(0, Math.min(1, progress))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped)
  const color = TONE_COLORS[tone]
  const displayLabel = label ?? `${Math.round(clamped * 100)}%`

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeOpacity={trackOpacity}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums"
        style={{ color }}
      >
        {displayLabel}
      </span>
    </div>
  )
}
