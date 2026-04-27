/**
 * GET /api/cs/dashboard
 *
 * Returns ALL active projects for CS Dashboard.
 * CS staff can see every project and self-select which ones they handle.
 * Includes claim info (which CS staff have claimed each project).
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const ALLOWED_ROLES = ['ADMIN', 'CLIENT_SERVICING', 'CREATIVE_DIRECTOR', 'SENIOR_ART_DIRECTOR']

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    // Show all active projects — exclude COMPLETED (handed-over, no longer needs CS action)
    const projects = await prisma.project.findMany({
      where: {
        status: { in: ['PROJECTED', 'ONGOING', 'BILLED', 'PAID'] },
      },
      select: {
        id: true,
        code: true,
        status: true,
        quotedAmount: true,
        billedAmount: true,
        paidAmount: true,
        deadline: true,
        updatedAt: true,
        client: {
          select: { companyName: true },
        },
        csAssignments: {
          select: {
            userId: true,
            claimedAt: true,
            user: {
              select: { name: true },
            },
          },
        },
        invoices: {
          select: { amount: true, status: true },
        },
        deliverableItems: {
          select: {
            id: true,
            itemType: true,
            description: true,
            status: true,
            revisionCount: true,
            deadline: true,
            assignedDesigner: {
              select: { name: true },
            },
            fileVersions: {
              select: { version: true, filename: true, url: true },
              orderBy: { version: 'desc' },
              take: 1,
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    // ── Aggregate item-level billing/payment data (columns not in Prisma schema) ──
    // Uses same HALF_PAID=50% logic as the Job Track page
    const projectIds = projects.map((p) => p.id)
    interface ItemAgg { projectId: string; itemBilled: number; itemPaid: number }
    const itemAggs: ItemAgg[] = projectIds.length > 0
      ? await prisma.$queryRawUnsafe<ItemAgg[]>(
          `SELECT
             "projectId",
             COALESCE(SUM(CASE WHEN "qteAmount" > 0 THEN "qteAmount" ELSE 0 END), 0)::float AS "itemBilled",
             COALESCE(SUM(CASE
               WHEN "paymentStatus" IN ('FULL_PAID','PAID') THEN "qteAmount"
               WHEN "paymentStatus" = 'HALF_PAID'           THEN "qteAmount" * 0.5
               ELSE 0
             END), 0)::float AS "itemPaid"
           FROM "deliverable_items"
           WHERE "projectId" IN (${projectIds.map((_, i) => `$${i + 1}`).join(', ')})
           GROUP BY "projectId"`,
          ...projectIds
        ).catch(() => [] as ItemAgg[])
      : []

    const itemAggMap = new Map<string, ItemAgg>()
    for (const agg of itemAggs) itemAggMap.set(agg.projectId, agg)

    const data = projects.map((p) => {
      const agg = itemAggMap.get(p.id)

      // ── Secondary: live Invoice records ──
      const invoiceBilled = p.invoices.reduce((s, i) => s + i.amount, 0)
      const invoicePaid = p.invoices
        .filter((i) => i.status === 'PAID')
        .reduce((s, i) => s + i.amount, 0)

      // Priority: item-level > invoice-level > project cached fields
      const itemBilled = agg?.itemBilled ?? 0
      const itemPaid   = agg?.itemPaid   ?? 0
      const billedAmount = itemBilled > 0 ? itemBilled : invoiceBilled > 0 ? invoiceBilled : p.billedAmount
      const paidAmount   = itemBilled > 0 ? itemPaid   : invoicePaid   > 0 ? invoicePaid   : p.paidAmount

      return ({
      id: p.id,
      code: p.code,
      status: p.status,
      clientName: p.client?.companyName ?? 'Unknown',
      quotedAmount: p.quotedAmount,
      billedAmount,
      paidAmount,
      deadline: p.deadline?.toISOString() ?? null,
      updatedAt: p.updatedAt.toISOString(),
      claimedBy: p.csAssignments.map((a) => ({
        userId: a.userId,
        name: a.user.name,
        claimedAt: a.claimedAt.toISOString(),
      })),
      isMyClaim: p.csAssignments.some((a) => a.userId === userId),
      items: p.deliverableItems.map((di) => ({
        id: di.id,
        itemType: di.itemType,
        description: di.description,
        status: di.status,
        revisionCount: di.revisionCount,
        deadline: di.deadline?.toISOString() ?? null,
        designerName: di.assignedDesigner?.name ?? null,
        latestFileVersion: di.fileVersions[0]?.filename ?? null,
        latestFileUrl: di.fileVersions[0]?.url ?? null,
      })),
    })})

    return NextResponse.json({ data, currentUserId: userId })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
