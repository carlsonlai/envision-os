/**
 * prisma-extended.ts
 *
 * Extends the generated Prisma client with models that exist in schema.prisma
 * but are not yet in the generated client (because `prisma generate` can't run
 * in this sandbox environment — blocked by binary download restrictions).
 *
 * Once the app is deployed on a real machine, run:
 *   npx prisma generate
 *   npx prisma db push (or migrate deploy)
 *
 * After that, the AI route files can switch back to `@/lib/db` directly.
 */

import { prisma as basePrisma } from '@/lib/db'

// ─── Minimal row types for the three AI models ────────────────────────────────

export interface AdCampaignRow {
  id: string
  clientId?: string | null
  leadId?: string | null
  platform: string
  objective: string
  targetAudience?: string | null
  budget?: number | null
  hookAngle?: string | null
  adCopy?: string | null
  visualConcept?: string | null
  callToAction?: string | null
  status: string
  aiGenerated: boolean
  impressions: number
  clicks: number
  leadsGenerated: number
  conversions: number
  spend: number
  notes?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface AIAgentLogRow {
  id: string
  agentRole: string
  actionType: string
  entityId?: string | null
  entityType?: string | null
  input?: unknown
  output?: string | null
  tokensUsed?: number | null
  durationMs?: number | null
  success: boolean
  createdAt: Date
}

export interface AIRoleReportRow {
  id: string
  role: string
  period: string
  efficiencyScore: number
  automationScore: number
  tasksAnalyzed: number
  tasksAutomated: number
  humanHoursSaved: number
  reportData: unknown
  createdAt: Date
}

// ─── Extended client type ─────────────────────────────────────────────────────

type FindManyArgs = {
  where?: Record<string, unknown>
  orderBy?: Record<string, unknown> | Record<string, unknown>[]
  take?: number
  skip?: number
  include?: Record<string, unknown>
  select?: Record<string, unknown>
}

type CreateArgs<T> = { data: Partial<T> }
type UpdateArgs<T> = { where: Record<string, unknown>; data: Partial<T> }

interface ExtendedPrisma {
  adCampaign: {
    findMany:   (args?: FindManyArgs)          => Promise<AdCampaignRow[]>
    findUnique: (args: FindManyArgs)           => Promise<AdCampaignRow | null>
    create:     (args: CreateArgs<AdCampaignRow>)  => Promise<AdCampaignRow>
    update:     (args: UpdateArgs<AdCampaignRow>)  => Promise<AdCampaignRow>
    delete:     (args: { where: Record<string, unknown> }) => Promise<AdCampaignRow>
  }
  aIAgentLog: {
    create:     (args: CreateArgs<AIAgentLogRow>)  => Promise<AIAgentLogRow>
    findMany:   (args?: FindManyArgs)              => Promise<AIAgentLogRow[]>
  }
  aIRoleReport: {
    create:     (args: CreateArgs<AIRoleReportRow>)   => Promise<AIRoleReportRow>
    findMany:   (args?: FindManyArgs)                 => Promise<AIRoleReportRow[]>
    findFirst:  (args?: FindManyArgs)                 => Promise<AIRoleReportRow | null>
  }
}

export const prisma = basePrisma as typeof basePrisma & ExtendedPrisma
