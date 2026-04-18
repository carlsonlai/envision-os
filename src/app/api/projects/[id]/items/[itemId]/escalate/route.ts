/**
 * POST /api/projects/[id]/items/[itemId]/escalate
 *
 * Replaces the old client-side alert() "Flag Issue" dialog on the Designer queue
 * with a structured, audited escalation that CS / Creative Director can actually
 * see and action.
 *
 * Categories are fixed so the team can triage quickly:
 *   - BLOCKED_BRIEF    — designer cannot start because brief is unclear / incomplete
 *   - MISSING_ASSETS   — artwork / logos / copy not provided by CS
 *   - UNREALISTIC_DEADLINE — scope vs time mismatch
 *   - CLIENT_CHANGE    — client changed scope mid-job
 *   - OTHER            — free text (required: description)
 *
 * Effects:
 *   - Writes an AuditLog row (action = 'DELIVERABLE_ESCALATED')
 *   - Emits Pusher ESCALATED event to project + CS + creative channels
 *   - Sends Lark CS + CREATIVE notification (no financial keywords — safe)
 *
 * Business rule (CLAUDE.md): the Lark notification must NOT contain invoice /
 * quotation / pricing / payment / RM. This route keeps the body to workflow
 * content only and routes financial concerns to Bukku.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, createAuditLog } from '@/lib/db'
import { triggerEvent, CHANNELS, EVENTS } from '@/services/pusher'
import { notify } from '@/services/lark'
import { z } from 'zod'
import { logger, getErrorMessage } from '@/lib/logger'

const ESCALATION_CATEGORIES = [
  'BLOCKED_BRIEF',
  'MISSING_ASSETS',
  'UNREALISTIC_DEADLINE',
  'CLIENT_CHANGE',
  'OTHER',
] as const

type EscalationCategory = (typeof ESCALATION_CATEGORIES)[number]

const CATEGORY_LABELS: Record<EscalationCategory, string> = {
  BLOCKED_BRIEF: 'Brief unclear / incomplete',
  MISSING_ASSETS: 'Missing assets from CS',
  UNREALISTIC_DEADLINE: 'Deadline vs scope mismatch',
  CLIENT_CHANGE: 'Client changed scope mid-job',
  OTHER: 'Other',
}

const DESIGNER_ROLES = [
  'JUNIOR_ART_DIRECTOR',
  'GRAPHIC_DESIGNER',
  'JUNIOR_DESIGNER',
  'DESIGNER_3D',
  'MULTIMEDIA_DESIGNER',
  'DIGITAL_MARKETING',
]
const SUPERVISOR_ROLES = ['ADMIN', 'CREATIVE_DIRECTOR', 'SENIOR_ART_DIRECTOR', 'CLIENT_SERVICING']
const ALLOWED_ROLES = [...DESIGNER_ROLES, ...SUPERVISOR_ROLES]

const postSchema = z.object({
  category: z.enum(ESCALATION_CATEGORIES),
  description: z.string().min(5, 'Please describe the issue').max(1000),
  blocking: z.boolean().default(false),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { role, id: userId, name: userName } = session.user
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: projectId, itemId } = await params

    const body = await req.json()
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { category, description, blocking } = parsed.data

    const item = await prisma.deliverableItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        projectId: true,
        status: true,
        itemType: true,
        assignedDesignerId: true,
        project: {
          select: {
            id: true,
            code: true,
            assignedCSId: true,
            assignedCS: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Deliverable item not found' }, { status: 404 })
    }

    if (item.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Item does not belong to this project' },
        { status: 400 }
      )
    }

    // Designers can only escalate their own items
    const isDesigner = DESIGNER_ROLES.includes(role)
    if (isDesigner && item.assignedDesignerId && item.assignedDesignerId !== userId) {
      return NextResponse.json(
        { error: 'You are not assigned to this item' },
        { status: 403 }
      )
    }

    await createAuditLog({
      projectId,
      deliverableItemId: itemId,
      action: 'DELIVERABLE_ESCALATED',
      performedById: userId,
      metadata: {
        category,
        categoryLabel: CATEGORY_LABELS[category],
        description,
        blocking,
        itemType: item.itemType,
        currentStatus: item.status,
      },
    })

    const payload = {
      itemId,
      projectId,
      projectCode: item.project.code,
      itemType: item.itemType,
      category,
      categoryLabel: CATEGORY_LABELS[category],
      description,
      blocking,
      raisedById: userId,
      raisedByName: userName,
      assignedCSId: item.project.assignedCSId,
      timestamp: new Date().toISOString(),
    }

    // Real-time fanout: project + CS + creative channels
    await triggerEvent(CHANNELS.project(projectId), EVENTS.ESCALATED, payload)
    await triggerEvent(CHANNELS.cs, EVENTS.ESCALATED, payload)
    await triggerEvent(CHANNELS.management, EVENTS.ESCALATED, payload)

    // Lark nudge — workflow content only, no financial terms
    try {
      const urgencyPrefix = blocking ? 'BLOCKING — ' : ''
      await notify('CS', {
        title: `${urgencyPrefix}Escalation raised on ${item.project.code}`,
        body:
          `**${item.itemType}** escalated by ${userName ?? 'designer'}\n` +
          `Reason: ${CATEGORY_LABELS[category]}\n\n` +
          `${description}`,
        projectCode: item.project.code,
        actionLabel: 'Open Project',
        actionUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/cs/projects/${projectId}`,
      })
      await notify('CREATIVE', {
        title: `${urgencyPrefix}Designer escalation on ${item.project.code}`,
        body:
          `${CATEGORY_LABELS[category]}\n${description}\n\n` +
          `Raised by ${userName ?? 'designer'} on ${item.itemType}.`,
        projectCode: item.project.code,
        actionLabel: 'Open Project',
        actionUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/cs/projects/${projectId}`,
      })
    } catch (err) {
      logger.warn('[Escalate POST] Lark notify failed', { error: getErrorMessage(err) })
    }

    return NextResponse.json({
      data: {
        itemId,
        projectId,
        category,
        description,
        blocking,
        raisedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.error('POST /api/projects/[id]/items/[itemId]/escalate error:', {
      error: getErrorMessage(error),
    })
    return NextResponse.json({ error: 'Failed to raise escalation' }, { status: 500 })
  }
}
