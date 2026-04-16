/**
 * PATCH /api/admin/agents/decisions/[id] — approve or reject a PENDING_APPROVAL decision
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { getErrorMessage, logger } from '@/lib/logger'
import type { Prisma } from '@prisma/client'

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject', 'override']),
  note: z.string().max(500).optional(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await ctx.params

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const parsed = reviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid payload', issues: parsed.error.issues }, { status: 400 })
  }

  try {
    const decision = await prisma.agentDecision.findUnique({ where: { id } })
    if (!decision) return NextResponse.json({ error: 'not found' }, { status: 404 })

    if (decision.status !== 'PENDING_APPROVAL' && decision.status !== 'AUTO_EXECUTED') {
      return NextResponse.json({ error: `cannot review a ${decision.status} decision` }, { status: 409 })
    }

    const statusMap = {
      approve: 'APPROVED' as const,
      reject: 'REJECTED' as const,
      override: 'OVERRIDDEN' as const,
    }

    const newStatus = statusMap[parsed.data.action]

    // If approving, execute the proposed change
    let executionResult: Record<string, unknown> | null = null
    if (parsed.data.action === 'approve' && decision.proposedChange) {
      executionResult = await executeDecision(decision)
    }

    await prisma.agentDecision.update({
      where: { id },
      data: {
        status: newStatus,
        reviewedByUserId: session.user.id,
        reviewedAt: new Date(),
        reviewNote: parsed.data.note ?? null,
        result: executionResult ? (executionResult as Prisma.InputJsonValue) : undefined,
      },
    })

    logger.info('agent.decision.reviewed', {
      decisionId: id,
      action: parsed.data.action,
      agent: decision.agent,
      by: session.user.id,
    })

    return NextResponse.json({ status: newStatus })
  } catch (error: unknown) {
    logger.error('agent.decision.review.failed', { id, error: getErrorMessage(error) })
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

/**
 * Execute the proposed change from an approved decision.
 * This is the "human approves → system acts" path.
 */
async function executeDecision(
  decision: { agent: string; entityType: string | null; entityId: string | null; proposedChange: unknown; action: string }
): Promise<Record<string, unknown>> {
  const change = decision.proposedChange as Record<string, unknown> | null
  if (!change || !decision.entityType || !decision.entityId) {
    return { executed: false, reason: 'missing change or entity' }
  }

  try {
    switch (decision.entityType) {
      case 'Lead': {
        const data: Record<string, unknown> = {}
        if ('score' in change) data.score = change.score
        if ('status' in change) data.status = change.status
        if ('assignedSalesId' in change) data.assignedSalesId = change.assignedSalesId
        if (Object.keys(data).length > 0) {
          await prisma.lead.update({ where: { id: decision.entityId }, data })
          return { executed: true, updated: data }
        }
        break
      }
      case 'AdCampaign': {
        const data: Record<string, unknown> = {}
        if ('status' in change) data.status = change.status
        if ('hookAngle' in change) data.hookAngle = change.hookAngle
        if ('adCopy' in change) data.adCopy = change.adCopy
        if ('visualConcept' in change) data.visualConcept = change.visualConcept
        if (Object.keys(data).length > 0) {
          await prisma.adCampaign.update({ where: { id: decision.entityId }, data })
          return { executed: true, updated: data }
        }
        break
      }
      case 'Project': {
        const data: Record<string, unknown> = {}
        if ('status' in change) data.status = change.status
        if (Object.keys(data).length > 0) {
          await prisma.project.update({ where: { id: decision.entityId }, data })
          return { executed: true, updated: data }
        }
        break
      }
      case 'Client': {
        const data: Record<string, unknown> = {}
        if ('tier' in change) data.tier = change.tier
        if (Object.keys(data).length > 0) {
          await prisma.client.update({ where: { id: decision.entityId }, data })
          return { executed: true, updated: data }
        }
        break
      }
      case 'DeliverableItem': {
        const data: Record<string, unknown> = {}
        if ('assignedDesignerId' in change) data.assignedDesignerId = change.assignedDesignerId
        if (Object.keys(data).length > 0) {
          await prisma.deliverableItem.update({ where: { id: decision.entityId }, data })
          return { executed: true, updated: data }
        }
        break
      }
      case 'Invoice': {
        const data: Record<string, unknown> = {}
        if ('notifiedAt' in change) data.notifiedAt = new Date()
        if (Object.keys(data).length > 0) {
          await prisma.invoice.update({ where: { id: decision.entityId }, data })
          return { executed: true, updated: data }
        }
        break
      }
      case 'Proposal': {
        // Proposals are flagged, not mutated — approval just acknowledges
        return { executed: true, acknowledged: true }
      }
    }
    return { executed: false, reason: 'no applicable mutations' }
  } catch (error: unknown) {
    return { executed: false, error: error instanceof Error ? error.message : String(error) }
  }
}
