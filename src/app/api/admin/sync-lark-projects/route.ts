import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getLarkProjectFolders } from '@/services/lark'
import { logger, getErrorMessage } from '@/lib/logger'

export interface SyncResult {
  total: number
  linked: number
  alreadyLinked: number
  unmatched: LarkOnlyFolder[]
  dbOnly: DbOnlyProject[]
  errors: string[]
}

interface LarkOnlyFolder {
  name: string
  token: string
}

interface DbOnlyProject {
  code: string
  id: string
  status: string
}

/**
 * POST /api/admin/sync-lark-projects
 *
 * Fetches all project folders from Lark Drive root and reconciles them
 * with Envision OS database projects.
 *
 * Actions taken:
 *  - If a Lark folder name matches a DB project code → sets larkFolderId on the project
 *  - Reports folders in Lark with no DB match (unmatched)
 *  - Reports DB projects with no Lark folder (dbOnly)
 *
 * Requires: Admin role
 */
export async function POST(): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    // 1. Fetch all project folders from Lark Drive
    const larkFolders = await getLarkProjectFolders()

    // 2. Fetch all projects from DB
    const dbProjects = await prisma.project.findMany({
      select: { id: true, code: true, status: true, larkFolderId: true },
      orderBy: { createdAt: 'desc' },
    })

    // Build lookup maps
    const larkByCode = new Map(larkFolders.map(f => [f.name.trim().toUpperCase(), f]))
    const dbByCode = new Map(dbProjects.map(p => [p.code.toUpperCase(), p]))

    const result: SyncResult = {
      total: larkFolders.length,
      linked: 0,
      alreadyLinked: 0,
      unmatched: [],
      dbOnly: [],
      errors: [],
    }

    // 3. Link Lark folders to DB projects
    for (const folder of larkFolders) {
      const code = folder.name.trim().toUpperCase()
      const dbProject = dbByCode.get(code)

      if (!dbProject) {
        result.unmatched.push({ name: folder.name, token: folder.token })
        continue
      }

      if (dbProject.larkFolderId === folder.token) {
        result.alreadyLinked++
        continue
      }

      try {
        await prisma.project.update({
          where: { id: dbProject.id },
          data: { larkFolderId: folder.token },
        })
        result.linked++
      } catch (err) {
        result.errors.push(
          `Failed to update ${dbProject.code}: ${err instanceof Error ? err.message : 'unknown error'}`
        )
      }
    }

    // 4. Find DB projects with no Lark folder
    for (const proj of dbProjects) {
      const code = proj.code.toUpperCase()
      if (!larkByCode.has(code)) {
        result.dbOnly.push({ code: proj.code, id: proj.id, status: proj.status })
      }
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    logger.error('POST /api/admin/sync-lark-projects error:', { error: getErrorMessage(error) })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/sync-lark-projects
 *
 * Preview — returns what the sync would do without making any DB changes.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const [larkFolders, dbProjects] = await Promise.all([
      getLarkProjectFolders(),
      prisma.project.findMany({
        select: { id: true, code: true, status: true, larkFolderId: true },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const larkByCode = new Map(larkFolders.map(f => [f.name.trim().toUpperCase(), f]))
    const dbByCode = new Map(dbProjects.map(p => [p.code.toUpperCase(), p]))

    const preview = {
      larkFolderCount: larkFolders.length,
      dbProjectCount: dbProjects.length,
      larkFolders: larkFolders.map(f => ({
        name: f.name,
        token: f.token,
        matchedInDb: dbByCode.has(f.name.trim().toUpperCase()),
        alreadyLinked: (() => {
          const p = dbByCode.get(f.name.trim().toUpperCase())
          return p?.larkFolderId === f.token
        })(),
      })),
      dbProjectsWithNoLarkFolder: dbProjects
        .filter(p => !larkByCode.has(p.code.toUpperCase()))
        .map(p => ({ code: p.code, status: p.status, hasLarkFolderId: !!p.larkFolderId })),
    }

    return NextResponse.json({ data: preview })
  } catch (error) {
    logger.error('GET /api/admin/sync-lark-projects error:', { error: getErrorMessage(error) })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Preview failed' },
      { status: 500 }
    )
  }
}
