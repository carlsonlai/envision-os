-- Migration: Add SystemSettings singleton table
-- Apply with: npx prisma migrate deploy

CREATE TABLE IF NOT EXISTS "system_settings" (
  "id"                  TEXT        NOT NULL DEFAULT 'singleton',
  "autopilotMode"       BOOLEAN     NOT NULL DEFAULT FALSE,
  "autoAssignEnabled"   BOOLEAN     NOT NULL DEFAULT TRUE,
  "larkGanttEnabled"    BOOLEAN     NOT NULL DEFAULT TRUE,
  "larkBriefEnabled"    BOOLEAN     NOT NULL DEFAULT TRUE,
  "autoImportQuotes"    BOOLEAN     NOT NULL DEFAULT FALSE,
  "autoImportInvoices"  BOOLEAN     NOT NULL DEFAULT FALSE,
  "overloadThreshold"   INTEGER     NOT NULL DEFAULT 90,
  "weeklyDigestDay"     INTEGER     NOT NULL DEFAULT 1,
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedById"         TEXT,

  CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton row so it always exists
INSERT INTO "system_settings" ("id", "updatedAt")
VALUES ('singleton', NOW())
ON CONFLICT ("id") DO NOTHING;
