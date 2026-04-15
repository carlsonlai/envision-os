import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  generateAdStrategy,
  planHookAngles,
  draftProspectConversation,
  autoQualifyLead,
  generateLeadGenPlan,
  draftProposal,
} from '@/services/ai'
import { prisma } from '@/lib/prisma-extended'
import { logger, getErrorMessage } from '@/lib/logger'

const ALLOWED_ROLES = ['ADMIN', 'SALES', 'AI_SALES_AGENT']

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = (await req.json()) as Record<string, unknown>
    const action = body.action as string

    // Log AI agent action
    async function logAction(actionType: string, entityId?: string, output?: string) {
      try {
        await prisma.aIAgentLog.create({
          data: {
            agentRole: session!.user.role as never,
            actionType: actionType as never,
            entityId,
            entityType: 'Lead',
            output: output?.slice(0, 500),
            success: true,
          },
        })
      } catch {
        // Non-critical — don't fail request if logging fails
      }
    }

    switch (action) {
      case 'GENERATE_AD_STRATEGY': {
        const result = await generateAdStrategy({
          service: (body.service as string) ?? 'Creative Design',
          targetIndustry: (body.targetIndustry as string) ?? 'SME',
          budget: (body.budget as string) ?? 'RM 2,000',
          goal: (body.goal as string) ?? 'Generate leads',
        })
        await logAction('AD_STRATEGY_GENERATED', undefined, JSON.stringify(result))
        return NextResponse.json({ data: result })
      }

      case 'PLAN_HOOK_ANGLES': {
        const result = await planHookAngles({
          service: (body.service as string) ?? 'Creative Design',
          targetAudience: (body.targetAudience as string) ?? 'SME owners',
          painPoint: (body.painPoint as string) ?? 'Poor brand visibility',
        })
        await logAction('HOOK_PLANNED', undefined, JSON.stringify(result))
        return NextResponse.json({ data: result })
      }

      case 'DRAFT_PROSPECT_CONVERSATION': {
        const result = await draftProspectConversation({
          leadName: (body.leadName as string) ?? 'Prospect',
          company: (body.company as string) ?? 'Company',
          stage: (body.stage as string) ?? 'INTEREST',
          channel: (body.channel as string) ?? 'WHATSAPP',
          context: (body.context as string) ?? '',
        })
        await logAction('PROSPECT_MESSAGE_DRAFTED', body.leadId as string, result.openingMessage)
        return NextResponse.json({ data: result })
      }

      case 'AUTO_QUALIFY_LEAD': {
        const leadId = body.leadId as string
        const result = await autoQualifyLead({
          name: (body.name as string) ?? '',
          company: (body.company as string) ?? '',
          industry: (body.industry as string) ?? '',
          budget: (body.budget as string) ?? '',
          timeline: (body.timeline as string) ?? '',
          source: (body.source as string) ?? '',
          notes: (body.notes as string) ?? '',
        })
        // Update lead score in DB if provided
        if (leadId) {
          await prisma.lead.update({
            where: { id: leadId },
            data: { score: result.qualified ? (result.score >= 70 ? 'HOT' : 'WARM') : 'COLD' },
          })
        }
        await logAction('LEAD_QUALIFIED', leadId, JSON.stringify(result))
        return NextResponse.json({ data: result })
      }

      case 'GENERATE_LEAD_GEN_PLAN': {
        const result = await generateLeadGenPlan({
          targetIndustry: (body.targetIndustry as string) ?? 'SME',
          monthlyRevenueGoal: (body.monthlyRevenueGoal as string) ?? 'RM 80,000',
          avgDealSize: (body.avgDealSize as string) ?? 'RM 8,000',
          currentChannels: (body.currentChannels as string) ?? 'Instagram',
        })
        await logAction('AD_STRATEGY_GENERATED', undefined, JSON.stringify(result))
        return NextResponse.json({ data: result })
      }

      case 'DRAFT_PROPOSAL': {
        const leadId = body.leadId as string
        const result = await draftProposal({
          clientName: (body.clientName as string) ?? 'Client',
          company: (body.company as string) ?? 'Company',
          industry: (body.industry as string) ?? 'General',
          projectType: (body.projectType as string) ?? 'Branding',
          budget: (body.budget as string) ?? 'RM 10,000',
          painPoints: (body.painPoints as string) ?? '',
        })
        await logAction('PROPOSAL_DRAFTED', leadId, result.executiveSummary)
        return NextResponse.json({ data: result })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    logger.error('AI Sales Agent error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'AI processing failed' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const logs = await prisma.aIAgentLog.findMany({
      where: { agentRole: { in: ['AI_SALES_AGENT', 'SALES'] as never[] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json({ data: logs })
  } catch (error) {
    logger.error('AI Sales Agent logs error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }
}
