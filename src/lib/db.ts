import '@/lib/env'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { isDesignerRole } from '@/lib/permissions'

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL ?? 'postgresql://laichanchean@localhost:5432/envision_os'
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export type SafeProject = {
  id: string
  code: string
  // clientId omitted for designer roles
  clientId?: string | null
  briefId?: string | null
  status: string
  assignedCSId: string | null
  // Financial fields omitted for designer roles
  quotedAmount?: number
  billedAmount?: number
  paidAmount?: number
  bukkuInvoiceId?: string | null
  bukkuQuoteId?: string | null
  larkFolderId: string | null
  deadline: Date | null
  profitability?: number | null
  createdAt: Date
  updatedAt: Date
}

export async function getProjectForRole(
  projectId: string,
  userRole: string
): Promise<SafeProject | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: true,
      assignedCS: { select: { id: true, name: true, email: true } },
      brief: true,
      deliverableItems: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!project) {
    return null
  }

  if (isDesignerRole(userRole)) {
    // Strip sensitive fields from designer view
    const {
      clientId: _clientId,
      quotedAmount: _quotedAmount,
      billedAmount: _billedAmount,
      paidAmount: _paidAmount,
      bukkuInvoiceId: _bukkuInvoiceId,
      bukkuQuoteId: _bukkuQuoteId,
      profitability: _profitability,
      ...safeProject
    } = project

    return safeProject as SafeProject
  }

  return project as SafeProject
}

export async function getProjectsForRole(userRole: string, userId?: string) {
  const projects = await prisma.project.findMany({
    where: isDesignerRole(userRole)
      ? {
          deliverableItems: {
            some: {
              assignedDesignerId: userId,
            },
          },
        }
      : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      client: isDesignerRole(userRole) ? false : true,
      assignedCS: {
        select: { id: true, name: true, email: true },
      },
      deliverableItems: {
        where: isDesignerRole(userRole) ? { assignedDesignerId: userId } : undefined,
        select: {
          id: true,
          itemType: true,
          description: true,
          quantity: true,
          status: true,
          deadline: true,
          estimatedMinutes: true,
          revisionLimit: true,
          revisionCount: true,
          assignedDesignerId: true,
          assignedDesigner: {
            select: { id: true, name: true, role: true },
          },
          revisions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              feedback: true,
              status: true,
              revisionNumber: true,
              createdAt: true,
            },
          },
        },
      },
      brief: {
        select: {
          id: true,
          packageType: true,
          specialInstructions: true,
          styleNotes: true,
          priority: true,
          qualityGatePassed: true,
          completedByCSAt: true,
        },
      },
      invoices: isDesignerRole(userRole) ? false : {
        select: {
          id: true,
          bukkuInvoiceId: true,
          type: true,
          amount: true,
          status: true,
          dueAt: true,
          paidAt: true,
        },
        orderBy: { createdAt: 'asc' as const },
      },
    },
  })

  // Attach invoiceNumber and quotations via raw SQL (safe against Prisma client version drift)
  let invoiceNumberMap: Record<string, string | null> = {}
  let quotationsMap: Record<string, unknown[]> = {}

  if (!isDesignerRole(userRole)) {
    try {
      const invoiceRows = await prisma.$queryRawUnsafe<{ id: string; invoiceNumber: string | null }[]>(
        `SELECT id, "invoiceNumber" FROM "invoices"`
      )
      for (const row of invoiceRows) {
        invoiceNumberMap[row.id] = row.invoiceNumber ?? null
      }
    } catch {
      // invoiceNumber column may not exist yet — ignore until migration runs
    }

    try {
      const quotationRows = await prisma.$queryRawUnsafe<{
        id: string; projectId: string; quoteNumber: string | null;
        bukkuQuoteId: string | null; amount: number; status: string;
        issuedAt: Date | null; acceptedAt: Date | null;
      }[]>(
        `SELECT id, "projectId", "quoteNumber", "bukkuQuoteId", amount, status, "issuedAt", "acceptedAt"
         FROM "quotations"
         ORDER BY "createdAt" ASC`
      )
      for (const row of quotationRows) {
        if (!quotationsMap[row.projectId]) quotationsMap[row.projectId] = []
        quotationsMap[row.projectId].push(row)
      }
    } catch {
      // quotations table may not exist yet — ignore until migration runs
    }
  }

  if (isDesignerRole(userRole)) {
    return projects.map((project) => {
      const {
        clientId: _clientId,
        quotedAmount: _quotedAmount,
        billedAmount: _billedAmount,
        paidAmount: _paidAmount,
        bukkuInvoiceId: _bukkuInvoiceId,
        bukkuQuoteId: _bukkuQuoteId,
        profitability: _profitability,
        ...safeProject
      } = project

      return safeProject
    })
  }

  // Merge invoiceNumber and quotations into project results
  return projects.map((project) => ({
    ...project,
    invoices: (project.invoices ?? []).map((inv) => ({
      ...inv,
      invoiceNumber: invoiceNumberMap[inv.id] ?? null,
    })),
    quotations: quotationsMap[project.id] ?? [],
  }))
}

export async function generateProjectCode(): Promise<string> {
  const latestProject = await prisma.project.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { code: true },
  })

  if (!latestProject) {
    return 'PRJ-0001'
  }

  const match = latestProject.code.match(/PRJ-(\d+)/)
  if (!match) {
    return 'PRJ-0001'
  }

  const nextNumber = parseInt(match[1], 10) + 1
  return `PRJ-${String(nextNumber).padStart(4, '0')}`
}

export async function createAuditLog(params: {
  projectId?: string
  deliverableItemId?: string
  action: string
  performedById: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      projectId: params.projectId,
      deliverableItemId: params.deliverableItemId,
      action: params.action,
      performedById: params.performedById,
      metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
    },
  })
}
