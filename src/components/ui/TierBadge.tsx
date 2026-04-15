/**
 * Client tier badge + config shared across CRM pages.
 */
import { Crown, Shield, Star, Circle } from 'lucide-react'

export type ClientTier = 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE'

export const TIER_CONFIG: Record<ClientTier, {
  label: string
  color: string
  bg: string
  icon: React.ElementType
}> = {
  PLATINUM: { label: 'Platinum', color: 'text-cyan-300',   bg: 'bg-cyan-500/10 border-cyan-500/20',   icon: Crown  },
  GOLD:     { label: 'Gold',     color: 'text-amber-300',  bg: 'bg-amber-500/10 border-amber-500/20', icon: Star   },
  SILVER:   { label: 'Silver',   color: 'text-zinc-300',   bg: 'bg-zinc-500/10 border-zinc-500/20',   icon: Shield },
  BRONZE:   { label: 'Bronze',   color: 'text-orange-300', bg: 'bg-orange-500/10 border-orange-500/20', icon: Circle },
}

export function TierBadge({ tier }: { tier: ClientTier }) {
  const config = TIER_CONFIG[tier]
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${config.color} ${config.bg}`}>
      <Icon className="h-2.5 w-2.5" />
      {config.label}
    </span>
  )
}
