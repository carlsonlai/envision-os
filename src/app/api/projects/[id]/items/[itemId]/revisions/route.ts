import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, createAuditLog } from '@/lib/db'
import { triggerEvent, CHANNELS, EVENTS } from '@/services/pusher'
import { notify } from '@/services/lark'
import { processFeedback, storeFeedbackOnRevision, notifyClientFeedbackReceived } from '@/services/feedback-processor'
import { z } from 'zod'
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

const createRevisionSchema = z.object({
  feedback: z.string().min(1, 'Feedback is required'),
  annotationData: z
    .object({
      objects: z.array(z.record(z.string(), z.unknown())).default([]),
      comments: z.array(annotationCommentSchema).default([]),
    })
    .optional(),
})

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
    logger.error('GET /api/projects/[id]/items/[itemId]/revisions error:', { error: getErrorMessage(error) })
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
    const { id: userId } = session.user

    const body = await req.json()
    const parsed = createRevisionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const item = await prisma.deliverableItem.findUnique({
      where: { id: itemId },
      include: {
        project: { select: { code: true } },
        assignedDesigner: { select: { id: true, name: true } },
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Deliverable item not found' }, { status: 404 })
    }

    // Check if revision limit is exceeded
    if (item.revisionCount >= item.revisionLimit) {
      // Trigger Pusher alert
      await triggerEvent(CHANNELS.cs, EVENTS.REVISION_LIMIT_HIT, {
        projectId,
        itemId,
        itemType: item.itemType,
        revisionCount: item.revisionCount,
        revisionLimit: item.revisionLimit,
        requestedById: userId,
        timestamp: new Date().toISOString(),
      })

      try {
        await notify('CS', {
          title: 'Revision Limit Reached',
          body: `Project **${item.project.code}** — ${item.itemType} has reached the revision limit (${item.revisionLimit}). CS action required.`,
          projectCode: item.project.code,
          actionLabel: 'Review in Envicion OS',
          actionUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/cs/projects/${projectId}`,
        })
        await notify('MANAGEMENT', {
          title: 'Revision Limit Alert',
          body: `Project **${item.project.code}** — ${item.itemType} has reached revision limit (${item.revisionLimit}/${item.revisionLimit}).`,
          projectCode: item.project.code,
        })
      } catch (err) {
        logger.warn('Lark notify failed (non-fatal):', { error: getErrorMessage(err) })
      }

      return NextResponse.json(
        {
          error: 'Revision limit exceeded',
          limitReached: true,
          message: `This item has reached its revision limit of ${item.revisionLimit}. A waiver or additional charge decision is required from CS.`,
          revisionCount: item.revisionCount,
          revisionLimit: item.revisionLimit,
        },
        { status: 402 }
      )
    }

    // ── AI: rewrite feedback into clear designer brief ────────────────────
    let clarifiedFeedback = parsed.data.feedback
    let requirementChecklist: unknown[] = []
    let clientResponseDraft = ''

    try {
      // Fetch client name for AI context
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          client: { select: { contactPerson: true, phone: true } },
        },
      })

      const processed = await processFeedback({
        clientName: project?.client?.contactPerson ?? 'Client',
        projectCode: item.project.code,
        feedback: parsed.data.feedback,
        revisionCount: item.revisionCount,
        revisionLimit: item.revisionLimit,
      })

      clarifiedFeedback = processed.clarifiedFeedback
      requirementChecklist = processed.requirementChecklist
      clientResponseDraft = processed.clientResponseDraft

      // Notify client via WhatsApp that feedback was received
      if (project?.client?.phone) {
        await notifyClientFeedbackReceived({
          clientPhone: project.client.phone,
          clientName: project.client.contactPerson ?? 'Client',
          projectCode: item.project.code,
          confirmationMessage: clientResponseDraft,
        })
      }
    } catch (aiErr) {
      logger.warn('[Revisions] AI feedback processing failed (non-fatal):', { error: getErrorMessage(aiErr) })
    }

    // Create revision and increment counter atomically
    const [revision] = await prisma.$transaction([
      prisma.revision.create({
        data: {
          deliverableItemId: itemId,
          revisionNumber: item.revisionCount + 1,
          requestedById: userId,
          feedback: parsed.data.feedback,
          annotationData: parsed.data.annotationData
            ? JSON.parse(JSON.stringify(parsed.data.annotationData))
            : undefined,
          status: 'PENDING',
        },
        include: {
          requestedBy: { select: { id: true, name: true, role: true } },
        },
      }),
      prisma.deliverableItem.update({
        where: { id: itemId },
        data: { revisionCount: { increment: 1 }, status: 'IN_PROGRESS' },
      }),
    ])

    // Store AI-processed feedback (raw SQL — safe against schema drift)
    if (clarifiedFeedback !== parsed.data.feedback) {
      await storeFeedbackOnRevision(revision.id, {
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
        revisionNumber: item.revisionCount + 1,
        feedback: parsed.data.feedback,
        hasAnnotations: !!parsed.data.annotationData,
      },
    })

    // Trigger Pusher events
    await triggerEvent(CHANNELS.project(projectId), EVENTS.REVISION_SUBMITTED, {
      itemId,
      revisionId: revision.id,
      revisionNumber: item.revisionCount + 1,
      feedback: parsed.data.feedback,
      requestedById: userId,
      timestamp: new Date().toISOString(),
    })

    if (item.assignedDesigner) {
      await triggerEvent(
        CHANNELS.designer(item.assignedDesigner.id),
        EVENTS.REVISION_SUBMITTED,
        {
          itemId,
          revisionId: revision.id,
          projectCode: item.project.code,
          feedback: parsed.data.feedback,
          timestamp: new Date().toISOString(),
        }
      )
    }

    try {
      const briefSummary = clarifiedFeedback !== parsed.data.feedback
        ? `\n**AI Brief:** ${clarifiedFeedback.slice(0, 200)}${clarifiedFeedback.length > 200 ? '…' : ''}`
        : ''
      await notify('CREATIVE', {
        title: 'Revision Requested',
        body: `Revision requested for **${item.project.code}** — ${item.itemType} (${item.revisionCount + 1}/${item.revisionLimit}).${briefSummary}`,
        projectCode: item.project.code,
        actionLabel: 'View Task',
        actionUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/designer/task/${itemId}`,
      })
    } catch (err) {
      logger.warn('Lark notify failed (non-fatal):', { error: getErrorMessage(err) })
    }

    return NextResponse.json({
      data: {
        ...revision,
        clarifiedFeedback: clarifiedFeedback !== parsed.data.feedback ? clarifiedFeedback : undefined,
        requirementChecklist: requirementChecklist.length > 0 ? requirementChecklist : undefined,
      },
    }, { status: 201 })
  } catch (error) {
    logger.error('POST /api/projects/[id]/items/[itemId]/revisions error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to create revision' }, { status: 500 })
  }
}
