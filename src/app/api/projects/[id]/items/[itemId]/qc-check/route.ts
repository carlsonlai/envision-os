/**
 * POST /api/projects/[id]/items/[itemId]/qc-check
 *
 * AI-powered QC check: verifies the designer's submission satisfies every
 * requirement from the original client feedback checklist.
 *
 * Returns pass/fail per requirement and a readiness score.
 * If all MUST requirements pass → item is cleared to advance to DELIVERED.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, createAuditLog } from '@/lib/db'
import { runQCCheck, type RequirementItem } from '@/services/feedback-processor'
import { notify } from '@/services/lark'
import { z } from 'zod'
import { logger, getErrorMessage } from '@/lib/logger'

const qcCheckSchema = z.object({
  submissionDescription: z.string().min(1),
  revisionId: z.string().optional(),
})

const ALLOWED_ROLES = ['ADMIN', 'CLIENT_SERVICING', 'CREATIVE_DIRECTOR', 'SENIOR_ART_DIRECTOR']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: projectId, itemId } = await params
    const body = await req.json()
    const parsed = qcCheckSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }

    // Use raw SQL to avoid Prisma client version issues (requirementChecklist not in old client)
    const [itemRow] = await prisma.$queryRawUnsafe<{
      id: string; itemType: string; status: string; projectId: string;
    }[]>(
      `SELECT id, "itemType", status, "projectId" FROM "deliverable_items" WHERE id = $1`,
      itemId
    )
    if (!itemRow) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const [projectRow] = await prisma.$queryRawUnsafe<{ code: string }[]>(
      `SELECT code FROM "projects" WHERE id = $1`,
      itemRow.projectId
    )
    const item = { ...itemRow, project: projectRow ?? { code: 'UNKNOWN' } }

    // Load checklist from the latest or specified revision via raw SQL
    const revisionRows = await prisma.$queryRawUnsafe<{
      id: string; requirementChecklist: unknown;
    }[]>(
      parsed.data.revisionId
        ? `SELECT id, "requirementChecklist" FROM "revisions" WHERE id = $1`
        : `SELECT id, "requirementChecklist" FROM "revisions" WHERE "deliverableItemId" = $1 ORDER BY "revisionNumber" DESC LIMIT 1`,
      parsed.data.revisionId ?? itemId
    ).catch(() => [] as { id: string; requirementChecklist: unknown }[])

    const latestRevision = revisionRows[0] ?? null

    const checklist: RequirementItem[] = (() => {
      try {
        const raw = latestRevision?.requirementChecklist
        if (!raw) return []
        if (typeof raw === 'string') return JSON.parse(raw) as RequirementItem[]
        return raw as RequirementItem[]
      } catch {
        return []
      }
    })()

    // Run AI QC
    const qcResult = await runQCCheck({
      deliverableItemId: itemId,
      submissionDescription: parsed.data.submissionDescription,
      checklist,
    })

    // Record QC result
    await createAuditLog({
      projectId,
      deliverableItemId: itemId,
      action: 'QC_CHECK_RUN',
      performedById: session.user.id,
      metadata: {
        score: qcResult.score,
        passed: qcResult.passed,
        readyForClient: qcResult.readyForClient,
        failedCount: qcResult.failedRequirements.length,
      },
    })

    // If ready for client — notify CS to proceed with delivery
    if (qcResult.readyForClient) {
      await prisma.deliverableItem.update({
        where: { id: itemId },
        data: { status: 'APPROVED' },
      })

      try {
        await notify('CS', {
          title: '✅ QC Passed — Ready for Client',
          body: `Project **${item.project.code}** — ${item.itemType} passed QC (score: ${qcResult.score}/100). Ready to send to client for approval.`,
          projectCode: item.project.code,
          actionLabel: 'Send to Client',
          actionUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/cs/projects/${projectId}`,
        })
      } catch (err) {
        logger.warn('[QCCheck] Lark notify failed:', { error: getErrorMessage(err) })
      }
    } else {
      // QC failed — notify designer of specific issues
      const failedList = qcResult.failedRequirements.slice(0, 3).join('; ')
      try {
        await notify('CREATIVE', {
          title: '⚠️ QC Issues Found',
          body: `Project **${item.project.code}** — ${item.itemType} QC score: ${qcResult.score}/100. Issues: ${failedList}. Please address before sending to client.`,
          projectCode: item.project.code,
          actionLabel: 'View Task',
          actionUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/designer/task/${itemId}`,
        })
      } catch (err) {
        logger.warn('[QCCheck] Lark notify failed:', { error: getErrorMessage(err) })
      }
    }

    return NextResponse.json({ data: qcResult })
  } catch (error) {
    logger.error('POST /api/projects/[id]/items/[itemId]/qc-check error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'QC check failed' }, { status: 500 })
  }
}
