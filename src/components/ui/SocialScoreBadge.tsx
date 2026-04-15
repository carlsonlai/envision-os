/**
 * Score badge for Social Hub pages (0–100 numeric score).
 * Shared between social-hub/page.tsx and social-hub/analytics/page.tsx.
 */
export function SocialScoreBadge({ score }: { score: number }) {
  const color =
    score >= 85 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
    score >= 65 ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
                  'text-red-400 bg-red-500/10 border-red-500/30'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums ${color}`}>
      {score}
    </span>
  )
}
