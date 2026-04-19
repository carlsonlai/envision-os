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

  // ── Drive-backed media assets (Social Hub media library) ─────────────────
  await step(
    'enum AssetKind',
    `DO $$ BEGIN
       CREATE TYPE "AssetKind" AS ENUM ('IMAGE','VIDEO','DOCUMENT','AUDIO','OTHER');
     EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  )
  await step(
    'table assets',
    `CREATE TABLE IF NOT EXISTS "assets" (
       "id"              TEXT PRIMARY KEY,
       "driveFileId"     TEXT NOT NULL UNIQUE,
       "name"            TEXT NOT NULL,
       "mimeType"        TEXT NOT NULL,
       "sizeBytes"       BIGINT,
       "kind"            "AssetKind" NOT NULL DEFAULT 'OTHER',
       "webViewLink"     TEXT,
       "webContentLink"  TEXT,
       "thumbnailLink"   TEXT,
       "uploaderId"      TEXT,
       "platform"        TEXT,
       "tags"            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
       "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`
  )
  await step(
    'idx assets(uploaderId)',
    `CREATE INDEX IF NOT EXISTS "assets_uploaderId_idx" ON "assets" ("uploaderId")`
  )
  await step(
    'idx assets(platform)',
    `CREATE INDEX IF NOT EXISTS "assets_platform_idx" ON "assets" ("platform")`
  )
  await step(
    'idx assets(createdAt)',
    `CREATE INDEX IF NOT EXISTS "assets_createdAt_idx" ON "assets" ("createdAt")`
  )

  // ── Agent control plane (enums + 4 tables) ───────────────────────────────
  await step(
    'enum AgentKind',
    `DO $$ BEGIN
       CREATE TYPE "AgentKind" AS ENUM (
         'DEMAND_INTEL','CONTENT_GENERATOR','DISTRIBUTION_ENGINE','PERFORMANCE_OPTIMIZER',
         'LEAD_ENGINE','SALES_AGENT','PAYMENT_AGENT','ONBOARDING_AGENT',
         'PM_AI','QA_AGENT','DELIVERY_AGENT','REVENUE_EXPANSION'
       );
     EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  )
  await step(
    'enum AgentDecisionStatus',
    `DO $$ BEGIN
       CREATE TYPE "AgentDecisionStatus" AS ENUM (
         'AUTO_EXECUTED','PENDING_APPROVAL','APPROVED','REJECTED',
         'OVERRIDDEN','FAILED','SKIPPED'
       );
     EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  )
  await step(
    'enum AgentRunStatus',
    `DO $$ BEGIN
       CREATE TYPE "AgentRunStatus" AS ENUM ('STARTED','COMPLETED','FAILED');
     EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  )
  await step(
    'enum FailsafeSeverity',
    `DO $$ BEGIN
       CREATE TYPE "FailsafeSeverity" AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
     EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  )

  await step(
    'table agent_configs',
    `CREATE TABLE IF NOT EXISTS "agent_configs" (
       "id"                  TEXT        NOT NULL PRIMARY KEY,
       "agent"               "AgentKind" NOT NULL UNIQUE,
       "enabled"             BOOLEAN     NOT NULL DEFAULT TRUE,
       "autonomyEnabled"     BOOLEAN     NOT NULL DEFAULT TRUE,
       "confidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
       "valueCapCents"       INTEGER,
       "rateCapPerHour"      INTEGER,
       "pausedReason"        TEXT,
       "pausedAt"            TIMESTAMPTZ,
       "pausedByUserId"      TEXT,
       "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`
  )

  await step(
    'table agent_runs',
    `CREATE TABLE IF NOT EXISTS "agent_runs" (
       "id"          TEXT              NOT NULL PRIMARY KEY,
       "agent"       "AgentKind"       NOT NULL,
       "triggerKind" TEXT              NOT NULL,
       "triggerRef"  TEXT,
       "status"      "AgentRunStatus"  NOT NULL DEFAULT 'STARTED',
       "startedAt"   TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
       "finishedAt"  TIMESTAMPTZ,
       "durationMs"  INTEGER,
       "tokensUsed"  INTEGER,
       "costCents"   INTEGER,
       "error"       TEXT,
       "summary"     TEXT
     )`
  )
  await step(
    'idx agent_runs(agent, startedAt)',
    `CREATE INDEX IF NOT EXISTS "agent_runs_agent_startedAt_idx" ON "agent_runs" ("agent","startedAt")`
  )
  await step(
    'idx agent_runs(status)',
    `CREATE INDEX IF NOT EXISTS "agent_runs_status_idx" ON "agent_runs" ("status")`
  )

  await step(
    'table agent_decisions',
    `CREATE TABLE IF NOT EXISTS "agent_decisions" (
       "id"               TEXT                   NOT NULL PRIMARY KEY,
       "runId"            TEXT,
       "agent"            "AgentKind"            NOT NULL,
       "status"           "AgentDecisionStatus"  NOT NULL DEFAULT 'AUTO_EXECUTED',
       "confidence"       DOUBLE PRECISION       NOT NULL,
       "action"           TEXT                   NOT NULL,
       "rationale"        TEXT                   NOT NULL,
       "entityType"       TEXT,
       "entityId"         TEXT,
       "inputSnapshot"    JSONB,
       "proposedChange"   JSONB,
       "result"           JSONB,
       "valueCents"       INTEGER,
       "requiresReview"   BOOLEAN                NOT NULL DEFAULT FALSE,
       "reviewedByUserId" TEXT,
       "reviewedAt"       TIMESTAMPTZ,
       "reviewNote"       TEXT,
       "createdAt"        TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
       CONSTRAINT "agent_decisions_runId_fkey"
         FOREIGN KEY ("runId") REFERENCES "agent_runs"("id") ON DELETE SET NULL
     )`
  )
  await step(
    'idx agent_decisions(agent, createdAt)',
    `CREATE INDEX IF NOT EXISTS "agent_decisions_agent_createdAt_idx" ON "agent_decisions" ("agent","createdAt")`
  )
  await step(
    'idx agent_decisions(status)',
    `CREATE INDEX IF NOT EXISTS "agent_decisions_status_idx" ON "agent_decisions" ("status")`
  )
  await step(
    'idx agent_decisions(entityType, entityId)',
    `CREATE INDEX IF NOT EXISTS "agent_decisions_entityType_entityId_idx" ON "agent_decisions" ("entityType","entityId")`
  )

  await step(
    'table failsafe_incidents',
    `CREATE TABLE IF NOT EXISTS "failsafe_incidents" (
       "id"             TEXT               NOT NULL PRIMARY KEY,
       "agent"          "AgentKind"        NOT NULL,
       "severity"       "FailsafeSeverity" NOT NULL DEFAULT 'MEDIUM',
       "rule"           TEXT               NOT NULL,
       "description"    TEXT               NOT NULL,
       "triggerValue"   TEXT,
       "thresholdValue" TEXT,
       "agentRunId"     TEXT,
       "decisionId"     TEXT,
       "resolvedAt"     TIMESTAMPTZ,
       "resolvedBy"     TEXT,
       "resolvedNote"   TEXT,
       "createdAt"      TIMESTAMPTZ        NOT NULL DEFAULT NOW()
     )`
  )
  await step(
    'idx failsafe_incidents(agent, createdAt)',
    `CREATE INDEX IF NOT EXISTS "failsafe_incidents_agent_createdAt_idx" ON "failsafe_incidents" ("agent","createdAt")`
  )
  await step(
    'idx failsafe_incidents(severity)',
    `CREATE INDEX IF NOT EXISTS "failsafe_incidents_severity_idx" ON "failsafe_incidents" ("severity")`
  )
  await step(
    'idx failsafe_incidents(resolvedAt)',
    `CREATE INDEX IF NOT EXISTS "failsafe_incidents_resolvedAt_idx" ON "failsafe_incidents" ("resolvedAt")`
  )

  return log
}
