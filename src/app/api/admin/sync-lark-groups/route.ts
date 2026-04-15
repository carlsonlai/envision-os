import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, generateProjectCode } from '@/lib/db'
import { getLarkGroupChats, getLarkGroupChatDetail } from '@/services/lark'
import { listContacts } from '@/services/bukku'
import type { BukkuContact } from '@/services/bukku'
import { logger, getErrorMessage } from '@/lib/logger'

export interface GroupSyncResult {
  total: number
  created: number
  skipped: number
  errors: string[]
  projects: Array<{
    name: string
    code: string
    chatId: string
    isNew: boolean
  }>
}

/**
 * POST /api/admin/sync-lark-groups
 *
 * Fetches all Lark group chats the bot belongs to and creates
 * a Project (+ Client) for each group that doesn't already exist.
 *
 * - Uses larkFolderId to store the Lark chat_id
 * - Skips groups already linked (larkFolderId matches)
 * - Creates a Client record using the group name
 *
 * Requires: Admin role
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    // Optional date filter: ?months=6  →  only import groups created in last N months
    const { searchParams } = new URL(req.url)
    const monthsParam = searchParams.get('months')
    const sinceDate = monthsParam
      ? new Date(Date.now() - parseInt(monthsParam, 10) * 30 * 24 * 60 * 60 * 1000)
      : null

    // 1. Fetch all project groups from Lark
    const groups = await getLarkGroupChats()

    // 2. Fetch existing projects + manually-excluded chat IDs so deleted projects
    //    are never re-imported.
    // Ensure exclusions table exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS lark_group_exclusions (
        "chatId"     TEXT        PRIMARY KEY,
        "excludedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    interface ExclusionRow { chatId: string }
    const [existingProjects, exclusions] = await Promise.all([
      prisma.project.findMany({
        where: { larkFolderId: { not: null } },
        select: { id: true, code: true, larkFolderId: true, client: { select: { companyName: true } } },
      }),
      prisma.$queryRawUnsafe<ExclusionRow[]>('SELECT "chatId" FROM lark_group_exclusions'),
    ])
    const existingChatIds = new Set(existingProjects.map((p: { larkFolderId: string | null }) => p.larkFolderId))
    const excludedChatIds = new Set(exclusions.map((e: ExclusionRow) => e.chatId))

    const result: GroupSyncResult = {
      total: groups.length,
      created: 0,
      skipped: 0,
      errors: [],
      projects: [],
    }

    // Add already-linked projects to the result list
    for (const p of existingProjects) {
      result.projects.push({
        name: p.client?.companyName ?? p.code,
        code: p.code,
        chatId: p.larkFolderId!,
        isNew: false,
      })
    }

    // 3. Create new projects for groups not yet in the DB
    for (const group of groups) {
      // Skip if already linked OR manually deleted/excluded
      if (existingChatIds.has(group.chatId) || excludedChatIds.has(group.chatId)) {
        result.skipped++
        continue
      }

      // Date filter: if ?months= was provided, fetch group detail to check create_time
      if (sinceDate) {
        const detail = await getLarkGroupChatDetail(group.chatId)
        if (detail && detail.createTime < sinceDate) {
          result.skipped++
          continue
        }
      }

      try {
        // Generate a unique placeholder email from the group name
        const emailSlug = group.name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .slice(0, 40)
        const placeholderEmail = `${emailSlug}-lark@envicion.sync`

        // Check if a client with this email already exists (idempotent)
        let client = await prisma.client.findUnique({
          where: { email: placeholderEmail },
        })

        if (!client) {
          client = await prisma.client.create({
            data: {
              companyName: group.name,
              contactPerson: 'TBD',
              email: placeholderEmail,
              phone: null,
            },
          })
        }

        const code = await generateProjectCode()

        const project = await prisma.project.create({
          data: {
            code,
            clientId: client.id,
            status: 'ONGOING',
            larkFolderId: group.chatId,
          },
        })

        // Create initial project brief
        await prisma.projectBrief.create({
          data: { projectId: project.id },
        })

        result.created++
        result.projects.push({
          name: group.name,
          code: project.code,
          chatId: group.chatId,
          isNew: true,
        })
      } catch (err) {
        result.errors.push(
          `Failed to create project for "${group.name}": ${err instanceof Error ? err.message : 'unknown error'}`
        )
      }
    }

    // ── Auto-reconcile: link any newly-created clients to Bukku contacts ──────
    // Best-effort — never blocks the sync response
    if (result.created > 0) {
      try {
        const bukkuContacts = await listContacts()
        const normalise = (s: string) =>
          s.toLowerCase().replace(/\bsdn\.?\s*bhd\.?\b/gi, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
        const bMap = new Map<string, BukkuContact>(
          bukkuContacts.map(bc => [normalise(bc.company_name ?? bc.name), bc])
        )
        const newlyCreatedClients = await prisma.client.findMany({
          where: {
            larkFolderId: { not: null },
            bukkuContactId: null,
          },
          select: { id: true, companyName: true },
        })
        for (const cl of newlyCreatedClients) {
          const matched = bMap.get(normalise(cl.companyName))
          if (matched) {
            await prisma.client.update({ where: { id: cl.id }, data: { bukkuContactId: matched.id } })
          }
        }
      } catch {
        // Bukku not configured or unreachable — skip silently
      }
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    logger.error('POST /api/admin/sync-lark-groups error:', { error: getErrorMessage(error) })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/sync-lark-groups
 * Preview — returns what the sync would do without making DB changes.
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

    const [groups, existingProjects] = await Promise.all([
      getLarkGroupChats(),
      prisma.project.findMany({
        where: { larkFolderId: { not: null } },
        select: { larkFolderId: true, code: true },
      }),
    ])

    const existingChatIds = new Set(existingProjects.map(p => p.larkFolderId))

    return NextResponse.json({
      data: {
        totalGroups: groups.length,
        newGroups: groups.filter(g => !existingChatIds.has(g.chatId)).map(g => g.name),
        alreadyLinked: groups.filter(g => existingChatIds.has(g.chatId)).map(g => g.name),
      },
    })
  } catch (error) {
    logger.error('GET /api/admin/sync-lark-groups error:', { error: getErrorMessage(error) })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Preview failed' },
      { status: 500 }
    )
  }
}
