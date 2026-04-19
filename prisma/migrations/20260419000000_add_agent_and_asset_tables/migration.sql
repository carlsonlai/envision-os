-- ═══════════════════════════════════════════════════════════════════════════
-- Backfill migration: 9 tables that were added to schema.prisma but never had
-- a migration generated. Without this the production DB cannot satisfy:
--   • /api/admin/agents       → prisma.agentDecision.groupBy()
--   • /api/admin/quotations   → prisma.quotation.*
--   • /api/social/assets      → prisma.asset.*
--   • Agent 1/4/12            → keyword_signals + content_performance
--   • Failsafe layer          → failsafe_incidents
--   • Lark exclusion list     → lark_group_exclusions
-- All statements use IF NOT EXISTS so this migration is safe to re-apply on a
-- DB that may have been partially patched by hand (e.g. via prisma db push).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Enums ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AssetKind" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AgentKind" AS ENUM (
    'DEMAND_INTEL',
    'CONTENT_GENERATOR',
    'DISTRIBUTION_ENGINE',
    'PERFORMANCE_OPTIMIZER',
    'LEAD_ENGINE',
    'SALES_AGENT',
    'PAYMENT_AGENT',
    'ONBOARDING_AGENT',
    'PM_AI',
    'QA_AGENT',
    'DELIVERY_AGENT',
    'REVENUE_EXPANSION'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AgentDecisionStatus" AS ENUM (
    'AUTO_EXECUTED',
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'OVERRIDDEN',
    'FAILED',
    'SKIPPED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AgentRunStatus" AS ENUM ('STARTED', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "FailsafeSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 1. quotations ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "quotations" (
    "id"           TEXT NOT NULL,
    "projectId"    TEXT NOT NULL,
    "quoteNumber"  TEXT,
    "bukkuQuoteId" TEXT,
    "amount"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status"       "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedAt"     TIMESTAMP(3),
    "acceptedAt"   TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "quotations"
    ADD CONSTRAINT "quotations_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 2. lark_group_exclusions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "lark_group_exclusions" (
    "chatId"     TEXT NOT NULL,
    "excludedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lark_group_exclusions_pkey" PRIMARY KEY ("chatId")
);

-- ─── 3. assets ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "assets" (
    "id"             TEXT NOT NULL,
    "driveFileId"    TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "mimeType"       TEXT NOT NULL,
    "sizeBytes"      INTEGER NOT NULL DEFAULT 0,
    "kind"           "AssetKind" NOT NULL DEFAULT 'OTHER',
    "webViewLink"    TEXT,
    "webContentLink" TEXT,
    "thumbnailLink"  TEXT,
    "uploaderId"     TEXT,
    "platform"       TEXT,
    "tags"           TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "assets_driveFileId_key" ON "assets"("driveFileId");
CREATE INDEX IF NOT EXISTS "assets_uploaderId_idx" ON "assets"("uploaderId");
CREATE INDEX IF NOT EXISTS "assets_platform_idx"   ON "assets"("platform");
CREATE INDEX IF NOT EXISTS "assets_createdAt_idx"  ON "assets"("createdAt");

-- ─── 4. agent_configs ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "agent_configs" (
    "id"                  TEXT NOT NULL,
    "agent"               "AgentKind" NOT NULL,
    "enabled"             BOOLEAN NOT NULL DEFAULT true,
    "autonomyEnabled"     BOOLEAN NOT NULL DEFAULT true,
    "confidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "valueCapCents"       INTEGER,
    "rateCapPerHour"      INTEGER,
    "pausedReason"        TEXT,
    "pausedAt"            TIMESTAMP(3),
    "pausedByUserId"      TEXT,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "agent_configs_agent_key" ON "agent_configs"("agent");

-- ─── 5. agent_runs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "agent_runs" (
    "id"          TEXT NOT NULL,
    "agent"       "AgentKind" NOT NULL,
    "triggerKind" TEXT NOT NULL,
    "triggerRef"  TEXT,
    "status"      "AgentRunStatus" NOT NULL DEFAULT 'STARTED',
    "startedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt"  TIMESTAMP(3),
    "durationMs"  INTEGER,
    "tokensUsed"  INTEGER,
    "costCents"   INTEGER,
    "error"       TEXT,
    "summary"     TEXT,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "agent_runs_agent_startedAt_idx" ON "agent_runs"("agent", "startedAt");
CREATE INDEX IF NOT EXISTS "agent_runs_status_idx"          ON "agent_runs"("status");

-- ─── 6. agent_decisions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "agent_decisions" (
    "id"               TEXT NOT NULL,
    "runId"            TEXT,
    "agent"            "AgentKind" NOT NULL,
    "status"           "AgentDecisionStatus" NOT NULL DEFAULT 'AUTO_EXECUTED',
    "confidence"       DOUBLE PRECISION NOT NULL,
    "action"           TEXT NOT NULL,
    "rationale"        TEXT NOT NULL,
    "entityType"       TEXT,
    "entityId"         TEXT,
    "inputSnapshot"    JSONB,
    "proposedChange"   JSONB,
    "result"           JSONB,
    "valueCents"       INTEGER,
    "requiresReview"   BOOLEAN NOT NULL DEFAULT false,
    "reviewedByUserId" TEXT,
    "reviewedAt"       TIMESTAMP(3),
    "reviewNote"       TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_decisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "agent_decisions_agent_createdAt_idx"      ON "agent_decisions"("agent", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_decisions_status_idx"               ON "agent_decisions"("status");
CREATE INDEX IF NOT EXISTS "agent_decisions_entityType_entityId_idx"  ON "agent_decisions"("entityType", "entityId");

DO $$ BEGIN
  ALTER TABLE "agent_decisions"
    ADD CONSTRAINT "agent_decisions_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "agent_runs"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 7. content_performance ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "content_performance" (
    "id"             TEXT NOT NULL,
    "adCampaignId"   TEXT,
    "assetId"        TEXT,
    "platform"       TEXT NOT NULL,
    "status"         TEXT NOT NULL DEFAULT 'testing',
    "impressions"    INTEGER NOT NULL DEFAULT 0,
    "clicks"         INTEGER NOT NULL DEFAULT 0,
    "conversions"    INTEGER NOT NULL DEFAULT 0,
    "spendCents"     INTEGER NOT NULL DEFAULT 0,
    "revenueCents"   INTEGER NOT NULL DEFAULT 0,
    "ctr"            DOUBLE PRECISION,
    "cpl"            DOUBLE PRECISION,
    "conversionRate" DOUBLE PRECISION,
    "roas"           DOUBLE PRECISION,
    "firstPublished" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSynced"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta"           JSONB,

    CONSTRAINT "content_performance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "content_performance_adCampaignId_idx"      ON "content_performance"("adCampaignId");
CREATE INDEX IF NOT EXISTS "content_performance_assetId_idx"           ON "content_performance"("assetId");
CREATE INDEX IF NOT EXISTS "content_performance_platform_status_idx"   ON "content_performance"("platform", "status");
CREATE INDEX IF NOT EXISTS "content_performance_lastSynced_idx"        ON "content_performance"("lastSynced");

DO $$ BEGIN
  ALTER TABLE "content_performance"
    ADD CONSTRAINT "content_performance_adCampaignId_fkey"
    FOREIGN KEY ("adCampaignId") REFERENCES "ad_campaigns"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "content_performance"
    ADD CONSTRAINT "content_performance_assetId_fkey"
    FOREIGN KEY ("assetId") REFERENCES "assets"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 8. keyword_signals ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "keyword_signals" (
    "id"                 TEXT NOT NULL,
    "keyword"            TEXT NOT NULL,
    "source"             TEXT NOT NULL,
    "region"             TEXT NOT NULL DEFAULT 'MY',
    "score"              INTEGER NOT NULL,
    "volume"             INTEGER,
    "trend"              TEXT,
    "category"           TEXT,
    "capturedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedByAgentAt" TIMESTAMP(3),
    "meta"               JSONB,

    CONSTRAINT "keyword_signals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "keyword_signals_keyword_source_region_capturedAt_key"
  ON "keyword_signals"("keyword", "source", "region", "capturedAt");
CREATE INDEX IF NOT EXISTS "keyword_signals_score_idx"            ON "keyword_signals"("score");
CREATE INDEX IF NOT EXISTS "keyword_signals_capturedAt_idx"       ON "keyword_signals"("capturedAt");
CREATE INDEX IF NOT EXISTS "keyword_signals_source_region_idx"    ON "keyword_signals"("source", "region");

-- ─── 9. failsafe_incidents ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "failsafe_incidents" (
    "id"             TEXT NOT NULL,
    "agent"          "AgentKind" NOT NULL,
    "severity"       "FailsafeSeverity" NOT NULL DEFAULT 'MEDIUM',
    "rule"           TEXT NOT NULL,
    "description"    TEXT NOT NULL,
    "triggerValue"   TEXT,
    "thresholdValue" TEXT,
    "agentRunId"     TEXT,
    "decisionId"     TEXT,
    "resolvedAt"     TIMESTAMP(3),
    "resolvedBy"     TEXT,
    "resolvedNote"   TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "failsafe_incidents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "failsafe_incidents_agent_createdAt_idx" ON "failsafe_incidents"("agent", "createdAt");
CREATE INDEX IF NOT EXISTS "failsafe_incidents_severity_idx"        ON "failsafe_incidents"("severity");
CREATE INDEX IF NOT EXISTS "failsafe_incidents_resolvedAt_idx"      ON "failsafe_incidents"("resolvedAt");
