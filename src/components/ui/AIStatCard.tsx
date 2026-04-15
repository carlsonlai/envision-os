/**
 * StatCard used across AI dashboards (AI CS, AI Sales).
 * Has an icon, label, numeric value, optional sub-text, and accent colour.
 */
interface AIStatCardProps {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  color: string
}

export function AIStatCard({ icon: Icon, label, value, sub, color }: AIStatCardProps) {
  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-2">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xl font-bold text-zinc-100">{value}</p>
        <p className="text-xs text-zinc-500">{label}</p>
        {sub && <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}
