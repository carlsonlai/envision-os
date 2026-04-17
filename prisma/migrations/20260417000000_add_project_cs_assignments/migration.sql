-- CreateTable
CREATE TABLE "project_cs_assignments" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_cs_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_cs_assignments_userId_idx" ON "project_cs_assignments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "project_cs_assignments_projectId_userId_key" ON "project_cs_assignments"("projectId", "userId");

-- AddForeignKey
ALTER TABLE "project_cs_assignments" ADD CONSTRAINT "project_cs_assignments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_cs_assignments" ADD CONSTRAINT "project_cs_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
