/**
 * POST /api/bukku/sync-job-track
 *
 * Syncs Bukku quotations and invoices into the Job Track database.
 * Fully idempotent — safe to run multiple times without creating duplicates.
 *
 * Overlap prevention strategy:
 *   • Clients  — upserted by companyName (unique index)
 *   • Projects — upserted by code = toCode(clientName, docNumber) (unique column)
 *   • Items    — upserted by (projectId, description) unique partial index
 *
 * Invoice matching order:
 *   1. Find existing item by clientName + description → update in place
 *   2. No match: find any project already belonging to this client → insert there
 *   3. Last resort: create a new project for this client keyed on invoice number
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ensureSchemaUpToDate } from '@/lib/db-migrations'
import axios from 'axios'

const BUKKU_BASE = 'https://api.bukku.my'
const ALLOWED_ROLES = ['ADMIN', 'CLIENT_SERVICING']

interface BukkuLineItem {
  description: string
  quantity: number
  unit_price: number
  amount: number
}

interface BukkuDoc {
  id: string
  number: string
  contact_name: string
  date: string
  status: string
  total_amount: number
  line_items: BukkuLineItem[]
  due_date?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getHeaders(): Promise<Record<string, string>> {
  const token     = process.env.BUKKU_ACCESS_TOKEN
  const subdomain = process.env.BUKKU_SUBDOMAIN
  if (!token || !subdomain) throw new Error('Bukku credentials not configured')
  return {
    Authorization: `Bearer ${token}`,
    'Company-Subdomain': subdomain,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

async function fetchAll(endpoint: string, headers: Record<string, string>): Promise<BukkuDoc[]> {
  const results: BukkuDoc[] = []
  let page = 1
  for (;;) {
    const res = await axios.get<{ data?: BukkuDoc[]; meta?: { last_page?: number } }>(
      `${BUKKU_BASE}/${endpoint}`,
      { headers, params: { per_page: 100, page } }
    )
    const items = res.data.data ?? []
    results.push(...items)
    if (page >= (res.data.meta?.last_page ?? 1)) break
    page++
  }
  return results
}

/** Stable project code: "CLIENTNAME-DOCNO" truncated to 30 chars */
function toCode(contactName: string, suffix: string): string {
  const base = contactName
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 20)
  return `${base}-${suffix}`.slice(0, 30)
}

function mapPaymentStatus(status: string): string {
  const s = status.toLowerCase()
  if (s === 'paid')    return 'FULL_PAID'
  if (s === 'partial') return 'HALF_PAID'
  if (s === 'overdue') return 'BILLED'
  if (s === 'sent')    return 'BILLED'
  return 'STARTED'
}

/** Upsert client by companyName — never creates two records for the same company */
async function upsertClient(companyName: string): Promise<string> {
  const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "clients" WHERE "companyName" = $1 LIMIT 1`,
    companyName
  )
  if (existing[0]) return existing[0].id

  const inserted = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "clients" (id, "companyName", "contactPerson", email, tier, ltv, "createdAt")
     VALUES (gen_random_uuid()::text, $1, $1, $2, 'BRONZE'::"ClientTier", 0, NOW())
     ON CONFLICT ("companyName") DO UPDATE SET "companyName" = EXCLUDED."companyName"
     RETURNING id`,
    companyName,
    `bukku-${companyName.toLowerCase().replace(/\s+/g, '-').slice(0, 30)}@import`
  ).catch(async () =>
    prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "clients" WHERE "companyName" = $1 LIMIT 1`,
      companyName
    )
  )
  return inserted[0]?.id ?? ''
}

/** Upsert project by code. Never creates duplicates. */
async function upsertProject(code: string, clientId: string, quotedAmount: number): Promise<string> {
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "projects" (id, code, "clientId", status, "quotedAmount", "billedAmount", "paidAmount", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, 'ONGOING'::"ProjectStatus", $3, 0, 0, NOW(), NOW())
     ON CONFLICT (code) DO UPDATE
       SET "updatedAt" = "projects"."updatedAt"
     RETURNING id`,
    code, clientId, quotedAmount
  )
  return rows[0]?.id ?? ''
}

/** Find any existing project for this client (prefer oldest — that's the quotation project) */
async function findClientProject(clientId: string): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "projects" WHERE "clientId" = $1 ORDER BY "createdAt" ASC LIMIT 1`,
    clientId
  )
  return rows[0]?.id ?? null
}

/** Upsert a deliverable item by (projectId, description) — never duplicates */
async function upsertItem(
  projectId: string, description: string, quantity: number,
  quoteNo: string | null, amount: number
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "deliverable_items"
       (id, "projectId", "itemType", description, quantity, "revisionLimit", "revisionCount",
        status, "quoteNo", "qteAmount", "isConfirmed", "createdAt")
     VALUES
       (gen_random_uuid()::text, $1, 'OTHER'::"ItemType", $2, $3, 2, 0,
        'PENDING'::"DeliverableStatus", $4, $5, ($4 IS NOT NULL), NOW())
     ON CONFLICT ("projectId", description) WHERE description IS NOT NULL
       DO NOTHING`,
    projectId, description.slice(0, 500), quantity, quoteNo, amount
  )
}

/** Update an existing item's invoice/billing fields without touching quote data */
async function applyInvoice(
  itemId: string, invoiceNo: string, payStatus: string,
  eta: string | null, invoiceDate: string, amount: number, quantity: number
): Promise<void> {
  // Insert-only philosophy: never overwrite existing invoice data.
  // Only fill in invoice fields when the row has no invoiceNo yet.
  await prisma.$executeRawUnsafe(
    `UPDATE "deliverable_items"
     SET "invoiceNo"     = $1,
         "paymentStatus" = $2,
         "paymentEta"    = $3::date,
         "invoiceDate"   = $4::date,
         "isConfirmed"   = TRUE
     WHERE id = $5 AND ("invoiceNo" IS NULL OR "invoiceNo" = '')`,
    invoiceNo, payStatus, eta, invoiceDate, itemId
  )
  // suppress unused-param warnings — amount/quantity retained for future use
  void amount; void quantity
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensureSchemaUpToDate()

  const log: string[] = []
  let quotationsProcessed = 0
  let invoicesProcessed = 0
  let itemsUpserted = 0

  try {
    const headers = await getHeaders()

    // ── 1. Quotations ───────────────────────────────────────────────────────
    log.push('Fetching quotations…')
    const quotations = await fetchAll('quotations', headers)
    log.push(`  ${quotations.length} quotation(s) found`)

    for (const qte of quotations) {
      if (!qte.line_items?.length) continue

      const clientName = qte.contact_name || 'Unknown'
      const clientId   = await upsertClient(clientName)
      if (!clientId) continue

      const projectId = await upsertProject(toCode(clientName, qte.number), clientId, qte.total_amount)
      if (!projectId) continue

      for (const li of qte.line_items) {
        if (!li.description?.trim()) continue
        const amount = li.amount ?? (li.unit_price * (li.quantity ?? 1))
        await upsertItem(projectId, li.description, li.quantity ?? 1, qte.number, amount)
          .then(() => { itemsUpserted++ })
          .catch(() => {})
      }
      quotationsProcessed++
    }

    log.push(`✓ Quotations done — ${quotationsProcessed} processed, ${itemsUpserted} items`)
    const afterQuotes = itemsUpserted

    // ── 2. Invoices ─────────────────────────────────────────────────────────
    log.push('Fetching invoices…')
    const invoices = await fetchAll('invoices', headers)
    log.push(`  ${invoices.length} invoice(s) found`)

    for (const inv of invoices) {
      if (!inv.line_items?.length) continue

      const clientName = inv.contact_name || 'Unknown'
      const payStatus  = mapPaymentStatus(inv.status)
      const eta        = inv.due_date ?? null

      for (const li of inv.line_items) {
        if (!li.description?.trim()) continue
        const amount = li.amount ?? (li.unit_price * (li.quantity ?? 1))
        const desc   = li.description.slice(0, 500)

        // Strategy 1 — update existing item matched by client + description
        const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
          `SELECT di.id
           FROM "deliverable_items" di
           JOIN "projects" p ON p.id = di."projectId"
           JOIN "clients"  c ON c.id = p."clientId"
           WHERE c."companyName" = $1 AND di.description = $2
           LIMIT 1`,
          clientName, desc
        ).catch(() => [] as { id: string }[])

        if (existing[0]) {
          await applyInvoice(existing[0].id, inv.number, payStatus, eta, inv.date, amount, li.quantity ?? 1)
            .then(() => { itemsUpserted++ }).catch(() => {})
          invoicesProcessed++
          continue
        }

        // Strategy 2 — insert under existing client project
        const clientId  = await upsertClient(clientName)
        let projectId   = clientId ? await findClientProject(clientId) : null

        // Strategy 3 — create new project only if client has none at all
        if (!projectId && clientId) {
          projectId = await upsertProject(toCode(clientName, inv.number), clientId, inv.total_amount)
        }
        if (!projectId) continue

        await prisma.$executeRawUnsafe(
          `INSERT INTO "deliverable_items"
             (id, "projectId", "itemType", description, quantity, "revisionLimit", "revisionCount",
              status, "invoiceNo", "qteAmount", "paymentStatus", "paymentEta", "invoiceDate",
              "isConfirmed", "createdAt")
           VALUES
             (gen_random_uuid()::text, $1, 'OTHER'::"ItemType", $2, $3, 2, 0,
              'PENDING'::"DeliverableStatus", $4, $5, $6, $7::date, $8::date, TRUE, NOW())
           ON CONFLICT ("projectId", description) WHERE description IS NOT NULL
             DO NOTHING`,
          projectId, desc, li.quantity ?? 1,
          inv.number, amount, payStatus, eta, inv.date
        ).then(() => { itemsUpserted++ }).catch(() => {})

        invoicesProcessed++
      }
    }

    log.push(`✓ Invoices done — ${invoicesProcessed} lines, ${itemsUpserted - afterQuotes} items updated`)
    log.push(`✓ Total items touched: ${itemsUpserted}`)

    return NextResponse.json({
      success: true,
      log,
      summary: { quotationsProcessed, invoicesProcessed, itemsUpserted },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.push(`✗ Error: ${message}`)
    return NextResponse.json({ success: false, log, error: message }, { status: 500 })
  }
}
