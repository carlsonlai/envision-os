/**
 * POST /api/admin/setup-cs-claims
 *
 * One-time setup: creates the project_cs_assignments table if it doesn't exist.
 * Restricted to ADMIN role.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Create table if not exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "project_cs_assignments" (
        "id" TEXT NOT NULL,
        "projectId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "project_cs_assignments_pkey" PRIMARY KEY ("id")
      )
    `)

    // Create indexes (ignore if already exist)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "project_cs_assignments_userId_idx"
      ON "project_cs_assignments"("userId")
    `)

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "project_cs_assignments_projectId_userId_key"
      ON "project_cs_assignments"("projectId", "userId")
    `)

    // Add foreign keys (wrapped in try so they don't fail if already exist)
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "project_cs_assignments"
        ADD CONSTRAINT "project_cs_assignments_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
      `)
    } catch {
      // FK already exists
    }

    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "project_cs_assignments"
        ADD CONSTRAINT "project_cs_assignments_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      `)
    } catch {
      // FK already exists
    }

    return NextResponse.json({ success: true, message: 'project_cs_assignments table ready' })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
