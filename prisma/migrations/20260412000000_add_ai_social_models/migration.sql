-- ============================================================
-- Migration: add_ai_social_models
-- Adds 6 missing tables + 4 missing enums + 2 Role values
-- Run AFTER the init migration (20260409025655_init)
-- ============================================================

-- ── 1. Extend Role enum ──────────────────────────────────────
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'AI_SALES_AGENT';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'AI_CS_AGENT';

-- ── 2. New enums ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "AIAgentActionType" AS ENUM (
    'LEAD_SCORED','LEAD_QUALIFIED','PROSPECT_MESSAGE_DRAFTED',
    'AD_STRATEGY_GENERATED','HOOK_PLANNED','PROPOSAL_DRAFTED',
    'CLIENT_UPDATE_DRAFTED','CLIENT_FEEDBACK_HANDLED',
    'REVISION_BRIEF_GENERATED','INVOICE_FOLLOWUP_DRAFTED',
    'SATISFACTION_DETECTED','REPLACEMENT_REPORT_GENERATED',
    'LEAD_CONVERTED','AUTO_RESPONSE_SENT'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AdPlatform" AS ENUM (
    'FACEBOOK','INSTAGRAM','TIKTOK','GOOGLE','LINKEDIN','YOUTUBE','OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AdObjective" AS ENUM (
    'AWARENESS','ENGAGEMENT','LEADS','CONVERSION','RETARGETING'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AdStatus" AS ENUM (
    'DRAFT','READY','ACTIVE','PAUSED','ENDED','ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. ai_agent_logs ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ai_agent_logs" (
  "id"          TEXT NOT NULL,
  "agentRole"   "Role" NOT NULL,
  "actionType"  "AIAgentActionType" NOT NULL,
  "entityId"    TEXT,
  "entityType"  TEXT,
  "input"       JSONB,
  "output"      TEXT,
  "tokensUsed"  INTEGER,
  "durationMs"  INTEGER,
  "success"     BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_agent_logs_pkey" PRIMARY KEY ("id")
);

-- ── 4. ad_campaigns ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ad_campaigns" (
  "id"             TEXT NOT NULL,
  "clientId"       TEXT,
  "leadId"         TEXT,
  "platform"       "AdPlatform" NOT NULL,
  "objective"      "AdObjective" NOT NULL,
  "targetAudience" TEXT,
  "budget"         DOUBLE PRECISION,
  "hookAngle"      TEXT,
  "adCopy"         TEXT,
  "visualConcept"  TEXT,
  "callToAction"   TEXT,
  "status"         "AdStatus" NOT NULL DEFAULT 'DRAFT',
  "aiGenerated"    BOOLEAN NOT NULL DEFAULT true,
  "impressions"    INTEGER NOT NULL DEFAULT 0,
  "clicks"         INTEGER NOT NULL DEFAULT 0,
  "leadsGenerated" INTEGER NOT NULL DEFAULT 0,
  "conversions"    INTEGER NOT NULL DEFAULT 0,
  "spend"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id")
);

-- ── 5. prospect_conversations ────────────────────────────────
CREATE TABLE IF NOT EXISTS "prospect_conversations" (
  "id"            TEXT NOT NULL,
  "leadId"        TEXT NOT NULL,
  "channel"       TEXT NOT NULL,
  "stage"         TEXT NOT NULL,
  "messagesSent"  INTEGER NOT NULL DEFAULT 0,
  "aiDrafted"     BOOLEAN NOT NULL DEFAULT true,
  "lastMessageAt" TIMESTAMP(3),
  "converted"     BOOLEAN NOT NULL DEFAULT false,
  "convertedAt"   TIMESTAMP(3),
  "notes"         TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prospect_conversations_pkey" PRIMARY KEY ("id")
);

-- ── 6. prospect_messages ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS "prospect_messages" (
  "id"             TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "direction"      TEXT NOT NULL,
  "content"        TEXT NOT NULL,
  "aiDrafted"      BOOLEAN NOT NULL DEFAULT true,
  "sentAt"         TIMESTAMP(3),
  "readAt"         TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prospect_messages_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "prospect_messages"
  ADD CONSTRAINT "prospect_messages_conversationId_fkey"
  FOREIGN KEY ("conversationId")
  REFERENCES "prospect_conversations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 7. ai_role_reports ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ai_role_reports" (
  "id"              TEXT NOT NULL,
  "role"            TEXT NOT NULL,
  "period"          TEXT NOT NULL,
  "efficiencyScore" DOUBLE PRECISION NOT NULL,
  "automationScore" DOUBLE PRECISION NOT NULL,
  "tasksAnalyzed"   INTEGER NOT NULL DEFAULT 0,
  "tasksAutomated"  INTEGER NOT NULL DEFAULT 0,
  "humanHoursSaved" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reportData"      JSONB NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_role_reports_pkey" PRIMARY KEY ("id")
);

-- ── 8. social_platform_stats ─────────────────────────────────
CREATE TABLE IF NOT EXISTS "social_platform_stats" (
  "id"             TEXT NOT NULL,
  "platformId"     TEXT NOT NULL,
  "platformName"   TEXT NOT NULL,
  "followers"      INTEGER NOT NULL DEFAULT 0,
  "followerGrowth" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reach"          INTEGER NOT NULL DEFAULT 0,
  "engagement"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "leads"          INTEGER NOT NULL DEFAULT 0,
  "posts"          INTEGER NOT NULL DEFAULT 0,
  "likes"          INTEGER NOT NULL DEFAULT 0,
  "comments"       INTEGER NOT NULL DEFAULT 0,
  "score"          INTEGER NOT NULL DEFAULT 0,
  "bestTime"       TEXT NOT NULL DEFAULT '',
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedBy"      TEXT NOT NULL DEFAULT 'manual',
  CONSTRAINT "social_platform_stats_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "social_platform_stats_platformId_key" UNIQUE ("platformId")
);

-- ── 9. Seed initial social platform rows ─────────────────────
INSERT INTO "social_platform_stats" ("id","platformId","platformName","updatedAt")
VALUES
  (gen_random_uuid()::text, 'instagram',  'Instagram',  NOW()),
  (gen_random_uuid()::text, 'facebook',   'Facebook',   NOW()),
  (gen_random_uuid()::text, 'tiktok',     'TikTok',     NOW()),
  (gen_random_uuid()::text, 'linkedin',   'LinkedIn',   NOW()),
  (gen_random_uuid()::text, 'rednote',    'RedNote',    NOW()),
  (gen_random_uuid()::text, 'youtube',    'YouTube',    NOW())
ON CONFLICT ("platformId") DO NOTHING;
