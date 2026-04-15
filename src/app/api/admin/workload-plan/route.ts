/**
 * GET  /api/admin/workload-plan  — AI priority plan for all active tasks
 * POST /api/admin/workload-plan  — Apply suggested reassignments
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, createAuditLog } from '@/lib/db'
import { generateAIWorkloadPlan, autoAssign } from '@/services/workload'
import { notify } from '@/services/lark'
import { z } from 'zod'
import { logger, getErrorMessage } from '@/lib/logger'

const ALLOWED_ROLES = ['ADMIN', 'CREATIVE_DIRECTOR']

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const plan = await generateAIWorkloadPlan()
    return NextResponse.json({ data: plan })
  } catch (error) {
    logger.error('GET /api/admin/workload-plan error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to generate workload plan' }, { status: 500 })
  }
}

const applySchema = z.object({
  reassignments: z.array(z.object({
    itemId: z.string(),
    toDesignerId: z.string(),
  })),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = applySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const applied: string[] = []
  const failed: string[] = []

  for (const { itemId, toDesignerId } of parsed.data.reassignments) {
    try {
      const item = await prisma.deliverableItem.findUnique({
        where: { id: itemId },
        include: { project: { select: { id: true, code: true } } },
      })
      if (!item) continue

      const prevDesignerId = item.assignedDesignerId

      await prisma.deliverableItem.update({
        where: { id: itemId },
        data: { assignedDesignerId: toDesignerId },
      })

      const newDesigner = await prisma.user.findUnique({
        where: { id: toDesignerId },
        select: { name: true },
      })

      await createAuditLog({
        projectId: item.project.id,
        deliverableItemId: itemId,
        action: 'TASK_REASSIGNED_BY_AI',
        performedById: session.user.id,
        metadata: {
          fromDesignerId: prevDesignerId,
          toDesignerId,
          toDesignerName: newDesigner?.name,
          reason: 'AI workload plan applied',
        },
      })

      applied.push(`${item.itemType} (${item.project.code}) → ${newDesigner?.name ?? toDesignerId}`)
    } catch (err) {
      logger.error(`Reassignment failed for item ${itemId}`, { error: getErrorMessage(err) })
      failed.push(itemId)
    }
  }

  // Notify creative team
  if (applied.length > 0) {
    try {
      await notify('CREATIVE', {
        title: '🔄 Workload Rebalanced by AI',
        body: `${applied.length} task(s) have been reassigned based on the AI workload plan:\n\n${applied.map((a) => `• ${a}`).join('\n')}`,
        actionLabel: 'View Workload',
        actionUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/cd`,
      })
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({
    data: {
      applied: applied.length,
      failed: failed.length,
      details: applied,
    },
  })
}
