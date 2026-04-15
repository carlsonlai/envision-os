/**
 * POST /api/admin/import-job-track
 *
 * Seeds the database from the pre-processed job-track-seed.json.
 * Creates clients, projects, and deliverable items from the MASTER
 * sheet of the JOB TRACK.xlsx exported by Client Servicing.
 *
 * Safe to run multiple times — uses ON CONFLICT DO UPDATE for idempotency.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ensureSchemaUpToDate } from '@/lib/db-migrations'
import seedData from '@/data/job-track-seed.json'

const ALLOWED_ROLES = ['ADMIN', 'CLIENT_SERVICING']

interface SeedRow {
  account: string
  project: string
  client: string
  statusNotes: string | null
  qteNo: string | null
  qteAmount: number | null
  qteDate: string | null
  invoiceNo: string | null
  invoiceDate: string | null
  invoiceSentStatus: string | null
  paymentEta: string | null
  paymentStatus: string | null
  itemType: string
}

function toProjectCode(account: string): string {
  return account
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9-]/g, '')
    .toUpperCase()
    .slice(0, 30)
}

function toProjectStatus(rows: SeedRow[]): string {
  const statuses = rows.map(r => r.paymentStatus).filter(Boolean)
  if (statuses.every(s => s === 'PAID')) return 'PAID'
  if (statuses.some(s => s === 'PAID' || s === 'PROGRESS')) return 'ONGOING'
  return 'PROJECTED'
}

export async function POST(): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensureSchemaUpToDate()

  const rows = seedData as SeedRow[]
  const log: string[] = []

  // Group rows by account
  const byAccount = new Map<string, SeedRow[]>()
  for (const row of rows) {
    if (!row.account) continue
    if (!byAccount.has(row.account)) byAccount.set(row.account, [])
    byAccount.get(row.account)!.push(row)
  }

  let clientsUpserted = 0
  let projectsUpserted = 0
  let itemsUpserted = 0

  for (const [account, accountRows] of byAccount) {
    // 1. Upsert client
    const clientName = accountRows[0].client || account
    const code = toProjectCode(account)

    let clientId: string
    const existingClient = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "clients" WHERE "companyName" = $1 LIMIT 1`,
      clientName
    ).then(r => r[0]).catch(() => null)

    if (existingClient) {
      clientId = existingClient.id
    } else {
      const newClient = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `INSERT INTO "clients" (id, "companyName", "contactPerson", email, tier, ltv, "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, 'BRONZE'::"ClientTier", 0, NOW())
         ON CONFLICT (email) DO UPDATE SET "companyName" = EXCLUDED."companyName"
         RETURNING id`,
        clientName,
        clientName,
        `${code.toLowerCase()}@import.local`
      ).catch(async () => {
        // email conflict — fetch by company name
        return prisma.$queryRawUnsafe<{ id: string }[]>(
          `SELECT id FROM "clients" WHERE "companyName" = $1 LIMIT 1`,
          clientName
        )
      })
      clientId = newClient[0]?.id ?? ''
      if (clientId) clientsUpserted++
    }

    // 2. Upsert project
    const projectStatus = toProjectStatus(accountRows)
    const totalQuoted = accountRows.reduce((s, r) => s + (r.qteAmount ?? 0), 0)

    const existingProject = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "projects" WHERE code = $1 LIMIT 1`,
      code
    ).then(r => r[0]).catch(() => null)

    let projectId: string
    if (existingProject) {
      projectId = existingProject.id
      await prisma.$executeRawUnsafe(
        `UPDATE "projects" SET "quotedAmount" = $1, "updatedAt" = NOW() WHERE id = $2`,
        totalQuoted, projectId
      ).catch(() => {})
    } else {
      const [proj] = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `INSERT INTO "projects" (id, code, "clientId", status, "quotedAmount", "billedAmount", "paidAmount", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3::"ProjectStatus", $4, 0, 0, NOW(), NOW())
         ON CONFLICT (code) DO UPDATE
           SET "quotedAmount" = EXCLUDED."quotedAmount", "updatedAt" = NOW()
         RETURNING id`,
        code, clientId || null, projectStatus, totalQuoted
      )
      projectId = proj.id
      projectsUpserted++
    }

    // 3. Upsert deliverable items
    for (const row of accountRows) {
      const desc = row.project.slice(0, 200)
      await prisma.$executeRawUnsafe(
        `INSERT INTO "deliverable_items"
           (id, "projectId", "itemType", description, quantity, "revisionLimit", "revisionCount",
            status, "quoteNo", "qteAmount", "invoiceNo", "paymentStatus", "paymentEta",
            "statusNotes", "invoiceDate", "invoiceSentStatus", "createdAt")
         VALUES
           (gen_random_uuid()::text, $1, $2::"ItemType", $3, 1, 2, 0,
            'PENDING'::"DeliverableStatus", $4, $5, $6, $7, $8::date, $9, $10::date, $11, NOW())
         ON CONFLICT DO NOTHING`,
        projectId,
        row.itemType as string,
        desc,
        row.qteNo,
        row.qteAmount,
        row.invoiceNo,
        row.paymentStatus,
        row.paymentEta,
        row.statusNotes,
        row.invoiceDate,
        row.invoiceSentStatus
      ).then(() => { itemsUpserted++ }).catch(() => {})

      // Also create Quotation record if has QTE NO
      if (row.qteNo) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "quotations" (id, "projectId", "quoteNumber", amount, status, "createdAt", "updatedAt")
           VALUES (gen_random_uuid()::text, $1, $2, $3, 'ACCEPTED'::"QuotationStatus", NOW(), NOW())
           ON CONFLICT DO NOTHING`,
          projectId, row.qteNo, row.qteAmount ?? 0
        ).catch(() => {})
      }

      // Also create Invoice record if has INV NO
      if (row.invoiceNo) {
        const invStatus = row.paymentStatus === 'PAID' ? 'PAID'
          : row.invoiceSentStatus === 'SENT' ? 'SENT'
          : 'PENDING'
        await prisma.$executeRawUnsafe(
          `INSERT INTO "invoices" (id, "projectId", "invoiceNumber", type, amount, status, "dueAt", "paidAt", "createdAt")
           VALUES (gen_random_uuid()::text, $1, $2, 'FULL'::"InvoiceType", $3, $4::"InvoiceStatus", $5::date, $6::date, NOW())
           ON CONFLICT DO NOTHING`,
          projectId, row.invoiceNo, row.qteAmount ?? 0, invStatus,
          row.paymentEta ?? null,
          row.paymentStatus === 'PAID' ? (row.invoiceDate ?? new Date().toISOString().slice(0, 10)) : null
        ).catch(() => {})
      }
    }

    log.push(`✓ ${account}: ${accountRows.length} items`)
  }

  return NextResponse.json({
    success: true,
    summary: { clientsUpserted, projectsUpserted, itemsUpserted },
    log,
  })
}
