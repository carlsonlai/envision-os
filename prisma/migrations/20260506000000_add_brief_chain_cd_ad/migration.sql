-- Migration: add_brief_chain_cd_ad
-- Adds CD/AD assignment to projects and full brief chain stage tracking
-- Run: npx prisma migrate deploy

-- 1. Create BriefStage enum
CREATE TYPE "BriefStage" AS ENUM (
  'CS_DRAFTING',
  'CD_REVIEW',
  'AD_DIRECTING',
  'DESIGNER_ASSIGNED',
  'DONE'
);

-- 2. Add CD and AD assignment columns to projects
ALTER TABLE "projects"
  ADD COLUMN "assignedCDId" TEXT,
  ADD COLUMN "assignedADId" TEXT;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_assignedCDId_fkey"
    FOREIGN KEY ("assignedCDId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "projects_assignedADId_fkey"
    FOREIGN KEY ("assignedADId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "projects_assignedCDId_idx" ON "projects"("assignedCDId");
CREATE INDEX "projects_assignedADId_idx" ON "projects"("assignedADId");

-- 3. Add brief chain tracking columns to project_briefs
ALTER TABLE "project_briefs"
  ADD COLUMN "briefStage"         "BriefStage" NOT NULL DEFAULT 'CS_DRAFTING',
  ADD COLUMN "sentToCDAt"         TIMESTAMP(3),
  ADD COLUMN "cdReceivedAt"       TIMESTAMP(3),
  ADD COLUMN "sentToADAt"         TIMESTAMP(3),
  ADD COLUMN "adReceivedAt"       TIMESTAMP(3),
  ADD COLUMN "designerAssignedAt" TIMESTAMP(3);

-- 4. Backfill: existing briefs that already have completedByCSAt are at CD_REVIEW or beyond
UPDATE "project_briefs"
  SET "briefStage" = 'CD_REVIEW'
  WHERE "completedByCSAt" IS NOT NULL
    AND "briefStage" = 'CS_DRAFTING';
