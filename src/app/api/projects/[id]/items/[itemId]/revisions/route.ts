import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, createAuditLog } from '@/lib/db'
import { triggerEvent, CHANNELS, EVENTS } from '@/services/pusher'
import { notify } from '@/services/lark'
import {
  processFeedback,
  storeFeedbackOnRevision,
  notifyClientFeedbackReceived,
} from '@/services/feedback-processor'
import { canWaiveRevision } from '@/lib/permissions'
import {
  createRevisionAtomic,
  createRevisionWithOverride,
} from '@/lib/revision-limit'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { logger, getErrorMessage } from '@/lib/logger'

const annotationCommentSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  text: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  createdAt: z.string(),
  resolved: z.boolean(),
})

const annotationPayloadSchema = z.object({
  objects: z.array(z.record(z.string(), z.unknown())).default([]),
  comments: z.array(annotationCommentSchema).default([]),
})

/**
 * `override` is only honoured when the actor passes `canWaiveRevision`
 * (ADMIN, CLIENT_SERVICING). It lets the revision be created past the limit
 * so that either an invoice is raised (`chargedAmount > 0`) or a deliberate
 * waiver is recorded. `reason` is required to keep the audit trail complete.
 */
const overrideSchema = z.object({
  reason: z.string().min(1, 'Override reason is required'),
  chargedAmount: z.number().min(0).optional(),
})

const createRevisionSchema = z.object({
  feedback: z.string().min(1, 'Feedback is required'),
  annotationData: annotationPayloadSchema.optional(),
  override: overrideSchema.optional(),
})

type AnnotationPayload = z.infer<typeof annotationPayloadSchema>

function annotationToJson(
  data: AnnotationPayload | undefined
): Prisma.InputJsonValue | undefined {
  if (!data) return undefined
  return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { itemId } = await params

    const revisions = await prisma.revision.findMany({
      where: { deliverableItemId: itemId },
      include: {
        requestedBy: {
          select: { id: true, name: true, role: true },
        },
        waivedBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { revisionNumber: 'asc' },
    })

    return NextResponse.json({ data: revisions })
  } catch (error) {
    logger.error('GET /api/projects/[id]/items/[itemId]/revisions error:', {
      error: getErrorMessage(error),
    })
    return NextResponse.json({ error: 'Failed to fetch revisions' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, itemId } = await params
    const { id: userId, role: userRole } = session.user

    const body = await req.json()
    const parsed = createRevisionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { feedback, annotationData, override } = parsed.data
    const annotationJson = annotationToJson(annotationData)

    // --- Override path (ADMIN / CS only) ---------------------------------
    if (override) {
      if (!canWaiveRevision(userRole)) {
        return NextResponse.json(
          { error: 'Forbidden — override requires CS or Admin role' },
          { status: 403 }
        )
      }

      const result = await createRevisionWithOverride({
        itemId,
        userId,
        feedback,
        annotationData: annotationJson,
        overrideReason: override.reason,
        chargedAmount: override.chargedAmount,
      })

      if (!result.ok) {
        return NextResponse.json(
          { error: 'Deliverable item not found' },
          { status: 404 }
        )
      }

      await createAuditLog({
        projectId,
        deliverableItemId: itemId,
        action: 'REVISION_OVERRIDE',
        performedById: userId,
        metadata: {
          revisionId: result.revision.id,
          revisionNumber: result.revisionNumber,
          reason: override.reason,
          chargedAmount: result.chargedAmount,
          invoiceId: result.invoiceId,
        },
      })

      await triggerEvent(CHANNELS.project(projectId), EVENTS.REVISION_SUBMITTED, {
        itemId,
        revisionId: result.revision.id,
        revisionNumber: result.revisionNumber,
        override: true,
        chargedAmount: result.chargedAmount,
        timestamp: new Date().toISOString(),
      })

      try {
        // Per `src/services/lark.ts` policy, financial content is filtered
        // by `containsBlockedContent`. Keep the operational alert clean of
        // amounts / billing terms; finance details live in Bukku.
        await notify('CS', {
          title: 'Revision Override Applied',
          body: `Project **${result.projectCode}** — override on ${result.itemType} recorded. Reason: ${override.reason}.`,
          projectCode: result.projectCode,
        })
      } catch (err) {
        logger.warn('Lark notify failed (non-fatal):', { error: getErrorMessage(err) })
      }

      return NextResponse.json(
        {
          data: {
            ...result.revision,
            override: true,
            invoiceId: result.invoiceId,
            chargedAmount: result.chargedAmount,
          },
        },
        { status: 201 }
      )
    }

    // --- Normal path (atomic CAS) ----------------------------------------
    const result = await createRevisionAtomic({
      itemId,
      userId,
      feedback,
      annotationData: annotationJson,
    })

    if (!result.ok && result.reason === 'not_found') {
      return NextResponse.json({ error: 'Deliverable item not found' }, { status: 404 })
    }

    if (!result.ok && result.reason === 'limit_hit') {
      // Notify CS + management so someone decides waive vs charge.
      await triggerEvent(CHANNELS.cs, EVENTS.REVISION_LIMIT_HIT, {
        projectId,
        itemId,
        itemType: result.itemType,
        revisionCount: result.currentCount,
        revisionLimit: result.limit,
        requestedById: userId,
        timestamp: new Date().toISOString(),
      })

      try {
        await notify('CS', {
          title: 'Revision Limit Reached',
          body: `Project **${result.projectCode}** — ${result.itemType} has reached the revision limit (${result.limit}). CS action required.`,
          projectCode: result.projectCode,
          actionLabel: 'Review in Envicion OS',
          actionUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/cs/projects/${projectId}`,
        })
        await notify('MANAGEMENT', {
          title: 'Revision Limit Alert',
          body: `Project **${result.projectCode}** — ${result.itemType} has reached revision limit (${result.limit}/${result.limit}).`,
          projectCode: result.projectCode,
        })
      } catch (err) {
        logger.warn('Lark notify failed (non-fatal):', { error: getErrorMessage(err) })
      }

      return NextResponse.json(
        {
          error: 'Revision limit exceeded',
          limitReached: true,
          message: `This item has reached its revision limit of ${result.limit}. A waiver or additional charge decision is required from CS.`,
          revisionCount: result.currentCount,
          revisionLimit: result.limit,
        },
        { status: 402 }
      )
    }

    // From here the discriminated union narrows to ok: true.
    if (!result.ok) {
      // Should be unreachable; keeps the type-checker honest.
      return NextResponse.json({ error: 'Unexpected revision state' }, { status: 500 })
    }

    // ── AI: rewrite feedback into clear designer brief ────────────────────
    let clarifiedFeedback = feedback
    let requirementChecklist: unknown[] = []
    let clientResponseDraft = ''

    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          client: { select: { contactPerson: true, phone: true } },
        },
      })

      const processed = await processFeedback({
        clientName: project?.client?.contactPerson ?? 'Client',
        projectCode: result.projectCode,
        feedback,
        revisionCount: result.revisionNumber,
        revisionLimit: result.itemRevisionLimit,
      })

      clarifiedFeedback = processed.clarifiedFeedback
      requirementChecklist = processed.requirementChecklist
      clientResponseDraft = processed.clientResponseDraft

      if (project?.client?.phone) {
        await notifyClientFeedbackReceived({
          clientPhone: project.client.phone,
          clientName: project.client.contactPerson ?? 'Client',
          projectCode: result.projectCode,
          confirmationMessage: clientResponseDraft,
        })
      }
    } catch (aiErr) {
      logger.warn('[Revisions] AI feedback processing failed (non-fatal):', {
        error: getErrorMessage(aiErr),
      })
    }

    if (clarifiedFeedback !== feedback) {
      await storeFeedbackOnRevision(result.revision.id, {
        clarifiedFeedback,
        designerBrief: clarifiedFeedback,
        requirementChecklist: requirementChecklist as never,
        clientResponseDraft,
        sentiment: 'NEUTRAL',
        escalate: false,
      })
    }

    await createAuditLog({
      projectId,
      deliverableItemId: itemId,
      action: 'REVISION_REQUESTED',
      performedById: userId,
      metadata: {
        revisionNumber: result.revisionNumber,
        feedback,
        hasAnnotations: !!annotationData,
      },
    })

    await triggerEvent(CHANNELS.project(projectId), EVENTS.REVISION_SUBMITTED, {
      itemId,
      revisionId: result.revision.id,
      revisionNumber: result.revisionNumber,
      feedback,
      requestedById: userId,
      timestamp: new Date().toISOString(),
    })

    if (result.assignedDesignerId) {
      await triggerEvent(
        CHANNELS.designer(result.assignedDesignerId),
        EVENTS.REVISION_SUBMITTED,
        {
          itemId,
          revisionId: result.revision.id,
          projectCode: result.projectCode,
          feedback,
          timestamp: new Date().toISOString(),
        }
      )
    }

    try {
      const briefSummary =
        clarifiedFeedback !== feedback
          ? `\n**AI Brief:** ${clarifiedFeedback.slice(0, 200)}${clarifiedFeedback.length > 200 ? '…' : ''}`
          : ''
      await notify('CREATIVE', {
        title: 'Revision Requested',
        body: `Revision requested for **${result.projectCode}** — ${result.itemType} (${result.revisionNumber}/${result.itemRevisionLimit}).${briefSummary}`,
        projectCode: result.projectCode,
        actionLabel: 'View Task',
        actionUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/designer/task/${itemId}`,
      })
    } catch (err) {
      logger.warn('Lark notify failed (non-fatal):', { error: getErrorMessage(err) })
    }

    return NextResponse.json(
      {
        data: {
          ...result.revision,
          clarifiedFeedback: clarifiedFeedback !== feedback ? clarifiedFeedback : undefined,
          requirementChecklist:
            requirementChecklist.length > 0 ? requirementChecklist : undefined,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    logger.error('POST /api/projects/[id]/items/[itemId]/revisions error:', {
      error: getErrorMessage(error),
    })
    return NextResponse.json({ error: 'Failed to create revision' }, { status: 500 })
  }
}
