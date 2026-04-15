/**
 * db-migrations.ts
 *
 * Self-healing schema migrations for columns/tables added after initial deploy.
 * Each function is idempotent — safe to call on every startup or API request.
 * Run ensureSchemaUpToDate() from /api/admin/migrate or on app boot.
 */

import { prisma } from '@/lib/db'

async function run(sql: string): Promise<void> {
  await prisma.$executeRawUnsafe(sql)
}

/**
 * Apply all pending structural migrations.
 * Returns a log of what was attempted.
 */
export async function ensureSchemaUpToDate(): Promise<string[]> {
  const log: string[] = []

  const step = async (label: string, sql: string) => {
    try {
      await run(sql)
      log.push(`✓ ${label}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      log.push(`✗ ${label}: ${msg}`)
    }
  }

  // ── projects ──────────────────────────────────────────────────────────────
  await step(
    'projects.larkOpenId on users',
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "larkOpenId" TEXT UNIQUE`
  )
  await step(
    'projects.pitchDate',
    `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "pitchDate" TIMESTAMPTZ`
  )
  await step(
    'projects.upfrontPercent',
    `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "upfrontPercent" DOUBLE PRECISION`
  )
  await step(
    'projects.larkChatId',
    `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "larkChatId" TEXT`
  )
  await step(
    'projects.assignedCSId',
    `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "assignedCSId" TEXT`
  )

  // ── deliverable_items staff ────────────────────────────────────────────────
  await step(
    'deliverable_items.assignedDesignerId',
    `ALTER TABLE "deliverable_items" ADD COLUMN IF NOT EXISTS "assignedDesignerId" TEXT`
  )

  // ── invoices ──────────────────────────────────────────────────────────────
  await step(
    'invoices.invoiceNumber',
    `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT`
  )

  // ── quotations table ──────────────────────────────────────────────────────
  await step(
    'create QuotationStatus enum',
    `DO $$ BEGIN
       CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT','SENT','ACCEPTED','REJECTED','EXPIRED');
     EXCEPTION WHEN duplicate_object THEN NULL;
     END $$`
  )
  await step(
    'create quotations table',
    `CREATE TABLE IF NOT EXISTS "quotations" (
       "id"           TEXT        NOT NULL PRIMARY KEY,
       "projectId"    TEXT        NOT NULL,
       "quoteNumber"  TEXT,
       "bukkuQuoteId" TEXT,
       "amount"       DOUBLE PRECISION NOT NULL DEFAULT 0,
       "status"       "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
       "issuedAt"     TIMESTAMPTZ,
       "acceptedAt"   TIMESTAMPTZ,
       "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       CONSTRAINT "quotations_projectId_fkey"
         FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE
     )`
  )
  await step(
    'quotations.projectId index',
    `CREATE INDEX IF NOT EXISTS "quotations_projectId_idx" ON "quotations"("projectId")`
  )

  // ── revisions (AI feedback fields) ───────────────────────────────────────
  await step(
    'revisions.clarifiedFeedback',
    `ALTER TABLE "revisions" ADD COLUMN IF NOT EXISTS "clarifiedFeedback" TEXT`
  )
  await step(
    'revisions.requirementChecklist',
    `ALTER TABLE "revisions" ADD COLUMN IF NOT EXISTS "requirementChecklist" JSONB`
  )

  // ── client approvals (WhatsApp approval tokens) ───────────────────────────
  await step(
    'create client_approvals table',
    `CREATE TABLE IF NOT EXISTS "client_approvals" (
       id                TEXT NOT NULL PRIMARY KEY,
       "deliverableItemId" TEXT NOT NULL,
       token             TEXT NOT NULL UNIQUE,
       status            TEXT NOT NULL DEFAULT 'PENDING',
       "respondedAt"     TIMESTAMPTZ,
       "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       CONSTRAINT "client_approvals_item_fkey"
         FOREIGN KEY ("deliverableItemId") REFERENCES "deliverable_items"("id") ON DELETE CASCADE
     )`
  )

  // ── leave management ──────────────────────────────────────────────────────
  await step(
    'create LeaveType enum',
    `DO $$ BEGIN
       CREATE TYPE "LeaveType" AS ENUM ('ANNUAL','MEDICAL','EMERGENCY','UNPAID','MATERNITY','PATERNITY','REPLACEMENT','OTHER');
     EXCEPTION WHEN duplicate_object THEN NULL;
     END $$`
  )
  await step(
    'create LeaveStatus enum',
    `DO $$ BEGIN
       CREATE TYPE "LeaveStatus" AS ENUM ('PENDING','APPROVED','REJECTED','CANCELLED');
     EXCEPTION WHEN duplicate_object THEN NULL;
     END $$`
  )
  await step(
    'create leave_records table',
    `CREATE TABLE IF NOT EXISTS "leave_records" (
       id               TEXT        NOT NULL PRIMARY KEY,
       "userId"         TEXT        NOT NULL,
       "larkLeaveId"    TEXT,
       "leaveType"      "LeaveType" NOT NULL DEFAULT 'ANNUAL',
       "startDate"      DATE        NOT NULL,
       "endDate"        DATE        NOT NULL,
       days             FLOAT       NOT NULL DEFAULT 1,
       reason           TEXT,
       status           "LeaveStatus" NOT NULL DEFAULT 'PENDING',
       "approvedById"   TEXT,
       "larkApprovedAt" TIMESTAMPTZ,
       "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       CONSTRAINT "leave_records_userId_fkey"
         FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
     )`
  )
  await step(
    'leave_records.userId index',
    `CREATE INDEX IF NOT EXISTS "leave_records_userId_idx" ON "leave_records"("userId")`
  )

  // ── payroll records ───────────────────────────────────────────────────────
  await step(
    'create payroll_records table',
    `CREATE TABLE IF NOT EXISTS "payroll_records" (
       id               TEXT    NOT NULL PRIMARY KEY,
       "userId"         TEXT    NOT NULL,
       "larkPayrollId"  TEXT,
       period           TEXT    NOT NULL,          -- e.g. "2026-04"
       "basicSalary"    FLOAT   NOT NULL DEFAULT 0,
       allowances       FLOAT   NOT NULL DEFAULT 0,
       deductions       FLOAT   NOT NULL DEFAULT 0,
       "netPay"         FLOAT   NOT NULL DEFAULT 0,
       status           TEXT    NOT NULL DEFAULT 'DRAFT', -- DRAFT|PROCESSED|PAID
       "paidAt"         TIMESTAMPTZ,
       "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       CONSTRAINT "payroll_records_userId_fkey"
         FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
       CONSTRAINT "payroll_period_unique" UNIQUE ("userId", period)
     )`
  )

  // ── job track fields on deliverable_items ────────────────────────────────
  await step('deliverable_items.quoteNo',          `ALTER TABLE "deliverable_items" ADD COLUMN IF NOT EXISTS "quoteNo" TEXT`)
  await step('deliverable_items.qteAmount',        `ALTER TABLE "deliverable_items" ADD COLUMN IF NOT EXISTS "qteAmount" FLOAT`)
  await step('deliverable_items.invoiceNo',        `ALTER TABLE "deliverable_items" ADD COLUMN IF NOT EXISTS "invoiceNo" TEXT`)
  await step('deliverable_items.paymentStatus',    `ALTER TABLE "deliverable_items" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT`)
  await step('deliverable_items.paymentEta',       `ALTER TABLE "deliverable_items" ADD COLUMN IF NOT EXISTS "paymentEta" DATE`)
  await step('deliverable_items.statusNotes',      `ALTER TABLE "deliverable_items" ADD COLUMN IF NOT EXISTS "statusNotes" TEXT`)
  await step('deliverable_items.invoiceDate',      `ALTER TABLE "deliverable_items" ADD COLUMN IF NOT EXISTS "invoiceDate" DATE`)
  await step('deliverable_items.invoiceSentStatus',`ALTER TABLE "deliverable_items" ADD COLUMN IF NOT EXISTS "invoiceSentStatus" TEXT`)
  await step('deliverable_items.isConfirmed',      `ALTER TABLE "deliverable_items" ADD COLUMN IF NOT EXISTS "isConfirmed" BOOLEAN NOT NULL DEFAULT FALSE`)

  // ── Unique indexes needed for Bukku sync idempotency ─────────────────────
  await step(
    'unique idx deliverable_items(projectId, description)',
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_deliverable_items_project_desc"
     ON "deliverable_items" ("projectId", description)
     WHERE description IS NOT NULL`
  )
  await step(
    'unique idx clients(companyName)',
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_clients_companyName"
     ON "clients" ("companyName")`
  )

  return log
}
