/**
 * GET /api/cs/job-track
 *
 * Returns all projects with their deliverable items, quotations, and invoices
 * for the Job Track dashboard used by Client Servicing.
 *
 * Query params:
 *   paymentStatus  — filter: PAID | PENDING | PROGRESS | UNPAID
 *   search         — search by account/project name
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ensureSchemaUpToDate } from '@/lib/db-migrations'

const ALLOWED_ROLES = ['ADMIN', 'CLIENT_SERVICING', 'CREATIVE_DIRECTOR', 'SENIOR_ART_DIRECTOR']

interface ItemRow {
  id: string
  projectId: string
  itemType: string
  description: string | null
  quantity: number | null
  status: string
  quoteNo: string | null
  qteAmount: number | null
  invoiceNo: string | null
  paymentStatus: string | null
  paymentEta: string | null
  statusNotes: string | null
  invoiceDate: string | null
  invoiceSentStatus: string | null
  designerName: string | null
  designerId: string | null
  isConfirmed: boolean
}

interface ProjectRow {
  id: string
  code: string
  status: string
  quotedAmount: number
  billedAmount: number
  paidAmount: number
  clientId: string | null
  clientName: string | null
  assignedCSId: string | null
  csName: string | null
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Ensure new columns exist (assignedCSId, assignedDesignerId, etc.)
  await ensureSchemaUpToDate()

  const { searchParams } = new URL(req.url)
  const paymentFilter = searchParams.get('paymentStatus')
  const search = searchParams.get('search')?.toLowerCase()
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))

  try {
    // Count total projects for pagination
    const [{ count: totalProjects }] = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) AS count FROM "projects"`
    )

    const offset = (page - 1) * limit

    // Fetch paginated projects with their client name and assigned CS person
    const projects = await prisma.$queryRawUnsafe<ProjectRow[]>(
      `SELECT p.id, p.code, p.status, p."quotedAmount", p."billedAmount", p."paidAmount",
              p."clientId", p."assignedCSId",
              c."companyName" AS "clientName",
              cs.name AS "csName"
       FROM "projects" p
       LEFT JOIN "clients" c ON c.id = p."clientId"
       LEFT JOIN "users" cs ON cs.id = p."assignedCSId"
       ORDER BY p.code ASC
       LIMIT ${limit} OFFSET ${offset}`
    )

    // Fetch deliverable items only for paginated projects (scoped, not full-table scan)
    const projectIds = projects.map((p) => p.id)
    const items: ItemRow[] = projectIds.length > 0
      ? await prisma.$queryRawUnsafe<ItemRow[]>(
          `SELECT di.id, di."projectId", di."itemType", di.description, di.quantity, di.status,
                  di."quoteNo", di."qteAmount", di."invoiceNo", di."paymentStatus",
                  di."paymentEta", di."statusNotes", di."invoiceDate", di."invoiceSentStatus",
                  COALESCE(di."isConfirmed", FALSE) AS "isConfirmed",
                  di."assignedDesignerId" AS "designerId",
                  u.name AS "designerName"
           FROM "deliverable_items" di
           LEFT JOIN "users" u ON u.id = di."assignedDesignerId"
           WHERE di."projectId" IN (${projectIds.map((_, i) => `$${i + 1}`).join(', ')})
             AND (di."quoteNo" IS NOT NULL OR di."invoiceNo" IS NOT NULL OR di.description IS NOT NULL)
           ORDER BY di."projectId", di."createdAt" ASC`,
          ...projectIds
        ).catch(() => [] as ItemRow[])
      : []

    // Group items by projectId
    const itemsByProject = new Map<string, ItemRow[]>()
    for (const item of items) {
      if (!itemsByProject.has(item.projectId)) itemsByProject.set(item.projectId, [])
      itemsByProject.get(item.projectId)!.push(item)
    }

    // Build project groups
    // totalQuoted = project.quotedAmount (contract value — same as CS Hub)
    // totalPaid / totalPending = summed from deliverable items with payment data
    const groups = projects
      .map(proj => {
        const projItems = itemsByProject.get(proj.id) ?? []

        // Apply payment filter (filters items, not the project itself)
        let filteredItems = projItems
        if (paymentFilter) {
          filteredItems = projItems.filter(i =>
            paymentFilter === 'UNPAID'
              ? !i.paymentStatus
              : i.paymentStatus === paymentFilter
          )
          // If filtering by payment and no items match, hide the project
          if (filteredItems.length === 0) return null
        }

        // Apply search
        if (search) {
          const matchesAccount = proj.code.toLowerCase().includes(search) ||
            (proj.clientName ?? '').toLowerCase().includes(search)
          const matchesItem = filteredItems.some(i =>
            (i.description ?? '').toLowerCase().includes(search) ||
            (i.quoteNo ?? '').toLowerCase().includes(search) ||
            (i.invoiceNo ?? '').toLowerCase().includes(search)
          )
          if (!matchesAccount && !matchesItem) return null
        }

        // Use project.quotedAmount as the contract total (aligns with CS Hub)
        const contractQuoted = Number(proj.quotedAmount) || 0
        const totalPaid = filteredItems.filter(i => i.paymentStatus === 'PAID')
          .reduce((s, i) => s + (i.qteAmount ?? 0), 0)
        const totalPending = filteredItems.filter(i => i.paymentStatus === 'PENDING')
          .reduce((s, i) => s + (i.qteAmount ?? 0), 0)

        return {
          projectId: proj.id,
          clientId: proj.clientId ?? null,
          assignedCSId: proj.assignedCSId ?? null,
          csName: proj.csName ?? null,
          account: proj.code,
          client: proj.clientName ?? proj.code,
          projectStatus: proj.status,
          totalQuoted: contractQuoted,          // contract value from CS Hub
          totalPaid,
          totalPending,
          items: filteredItems,
        }
      })
      .filter(Boolean)

    // Grand totals
    const grandTotalQuoted = groups.reduce((s, g) => s + (g?.totalQuoted ?? 0), 0)
    const grandTotalPaid = groups.reduce((s, g) => s + (g?.totalPaid ?? 0), 0)
    const grandTotalPending = groups.reduce((s, g) => s + (g?.totalPending ?? 0), 0)

    const totalPages = Math.ceil(Number(totalProjects) / limit)

    const res = NextResponse.json({
      data: {
        groups,
        summary: {
          totalAccounts: groups.length,
          totalItems: groups.reduce((s, g) => s + (g?.items.length ?? 0), 0),
          grandTotalQuoted,
          grandTotalPaid,
          grandTotalPending,
          grandTotalOutstanding: grandTotalQuoted - grandTotalPaid,
        },
        pagination: {
          page,
          limit,
          totalProjects: Number(totalProjects),
          totalPages,
        },
      },
    })
    res.headers.set('Cache-Control', 'private, max-age=15')
    return res
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
