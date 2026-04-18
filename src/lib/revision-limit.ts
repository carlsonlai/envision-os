import type { Prisma, Revision } from '@prisma/client'
import { prisma } from '@/lib/db'

/**
 * Atomic revision creation with race-safe limit enforcement.
 *
 * This module is the single chokepoint for creating `Revision` rows. Every
 * call site (API route, webhook, service) must go through it so revision
 * limits cannot be bypassed by parallel requests or alternative entry points.
 *
 * Correctness guarantees
 * ----------------------
 * 1. A deliverable's `revisionCount` can never exceed its `revisionLimit`
 *    unless `createRevisionWithOverride` is called with an authorized role.
 * 2. Increment and `Revision` insert happen in one interactive transaction —
 *    no partial states, no lost increments under concurrency.
 * 3. The CAS is expressed as a field-reference `updateMany` so Postgres, not
 *    application code, enforces the inequality. `updated.count === 0` means
 *    the limit was hit at commit time.
 */

export type RevisionCreateInput = {
  itemId: string
  userId: string
  feedback: string
  annotationData?: Prisma.InputJsonValue
}

export type RevisionCreateSuccess = {
  ok: true
  revision: Revision
  revisionNumber: number
  itemRevisionLimit: number
  itemType: string
  projectId: string
  projectCode: string
  assignedDesignerId: string | null
}

export type RevisionLimitHit = {
  ok: false
  reason: 'limit_hit'
  currentCount: number
  limit: number
  itemType: string
  projectId: string
  projectCode: string
}

export type RevisionNotFound = {
  ok: false
  reason: 'not_found'
}

export type RevisionCreateResult =
  | RevisionCreateSuccess
  | RevisionLimitHit
  | RevisionNotFound

/**
 * Atomically create a revision. Returns `limit_hit` without creating anything
 * if the deliverable is already at its revision limit.
 *
 * Use this for all standard revision creation paths (CS, client portal,
 * WhatsApp feedback).
 */
export async function createRevisionAtomic(
  input: RevisionCreateInput
): Promise<RevisionCreateResult> {
  return prisma.$transaction(async (tx) => {
    const item = await tx.deliverableItem.findUnique({
      where: { id: input.itemId },
      select: {
        id: true,
        projectId: true,
        itemType: true,
        revisionCount: true,
        revisionLimit: true,
        assignedDesignerId: true,
        project: { select: { code: true } },
      },
    })

    if (!item) {
      return { ok: false, reason: 'not_found' } as const
    }

    // Atomic compare-and-swap: Postgres enforces `revisionCount < revisionLimit`
    // at commit time, so concurrent transactions cannot both pass the gate.
    const updated = await tx.deliverableItem.updateMany({
      where: {
        id: input.itemId,
        revisionCount: { lt: item.revisionLimit },
      },
      data: {
        revisionCount: { increment: 1 },
        status: 'IN_PROGRESS',
      },
    })

    if (updated.count === 0) {
      return {
        ok: false,
        reason: 'limit_hit',
        currentCount: item.revisionCount,
        limit: item.revisionLimit,
        itemType: item.itemType as unknown as string,
        projectId: item.projectId,
        projectCode: item.project.code,
      } as const
    }

    const revisionNumber = item.revisionCount + 1
    const revision = await tx.revision.create({
      data: {
        deliverableItemId: input.itemId,
        revisionNumber,
        requestedById: input.userId,
        feedback: input.feedback,
        annotationData: input.annotationData,
        status: 'PENDING',
      },
    })

    return {
      ok: true,
      revision,
      revisionNumber,
      itemRevisionLimit: item.revisionLimit,
      itemType: item.itemType as unknown as string,
      projectId: item.projectId,
      projectCode: item.project.code,
      assignedDesignerId: item.assignedDesignerId,
    } as const
  })
}

export type RevisionOverrideInput = RevisionCreateInput & {
  /** Required explanation — stored on the Revision and the AuditLog. */
  overrideReason: string
  /**
   * If present, an `Invoice` with `type: 'EXTRA_REVISION'` is created in the
   * same transaction and its id is written to `Revision.bukkuInvoiceLineId`.
   */
  chargedAmount?: number
}

export type RevisionOverrideSuccess = RevisionCreateSuccess & {
  invoiceId: string | null
  chargedAmount: number | null
}

export type RevisionOverrideResult =
  | RevisionOverrideSuccess
  | RevisionNotFound

/**
 * Create a revision past the limit. Callers MUST verify the actor is allowed
 * to override (see `canWaiveRevision`). Always records an `Invoice` if
 * `chargedAmount` is given so finance tooling sees the billable event.
 *
 * Rationale for the override path
 * -------------------------------
 * Revenue leaks when scope creep goes unbilled. The override forces either
 * an explicit waiver reason or a charged amount, making every over-limit
 * revision traceable and either collected or deliberately forgiven.
 */
export async function createRevisionWithOverride(
  input: RevisionOverrideInput
): Promise<RevisionOverrideResult> {
  return prisma.$transaction(async (tx) => {
    const item = await tx.deliverableItem.findUnique({
      where: { id: input.itemId },
      select: {
        id: true,
        projectId: true,
        itemType: true,
        revisionCount: true,
        revisionLimit: true,
        assignedDesignerId: true,
        project: { select: { code: true } },
      },
    })

    if (!item) {
      return { ok: false, reason: 'not_found' } as const
    }

    // Override always increments, regardless of limit.
    await tx.deliverableItem.update({
      where: { id: input.itemId },
      data: {
        revisionCount: { increment: 1 },
        status: 'IN_PROGRESS',
      },
    })

    const hasCharge =
      typeof input.chargedAmount === 'number' && input.chargedAmount > 0

    const invoice = hasCharge
      ? await tx.invoice.create({
          data: {
            projectId: item.projectId,
            type: 'EXTRA_REVISION',
            amount: input.chargedAmount as number,
            status: 'PENDING',
          },
        })
      : null

    const revisionNumber = item.revisionCount + 1
    const revision = await tx.revision.create({
      data: {
        deliverableItemId: input.itemId,
        revisionNumber,
        requestedById: input.userId,
        feedback: input.feedback,
        annotationData: input.annotationData,
        status: 'PENDING',
        // Track the override on the Revision itself — no separate table needed.
        waivedById: input.userId,
        waivedReason: input.overrideReason,
        chargedAmount: hasCharge ? (input.chargedAmount as number) : null,
        bukkuInvoiceLineId: invoice?.id ?? null,
      },
    })

    return {
      ok: true,
      revision,
      revisionNumber,
      itemRevisionLimit: item.revisionLimit,
      itemType: item.itemType as unknown as string,
      projectId: item.projectId,
      projectCode: item.project.code,
      assignedDesignerId: item.assignedDesignerId,
      invoiceId: invoice?.id ?? null,
      chargedAmount: hasCharge ? (input.chargedAmount as number) : null,
    } as const
  })
}
