/**
 * POST /api/admin/sync-lark-group-members
 *
 * For each project that has a Lark group chat (larkChatId or larkFolderId),
 * fetches the chat members from Lark and upserts ProjectCSAssignment records
 * by matching each member's open_id to users.larkOpenId.
 *
 * Optional query param:
 *   ?projectId=xxx  â sync only a single project
 *
 * GET  â preview which projects would be synced and current member counts.
 * POST â execute the sync.
 *
 * Requires: ADMIN role
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getGroupChatMembers } from '@/services/lark'
import { logger, getErrorMessage } from '@/lib/logger'

interface SyncResult {
  totalProjects: number
  synced: number
  skipped: number
  assignments: {
    created: number
    existing: number
    unmatched: number
  }
  details: Array<{
    projectCode: string
    chatId: string
    members: Array<{ name: string; openId: string; matched: boolean; userId?: string }>
  }>
  errors: string[]
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'ADMIN' && session.user.role !== 'CLIENT_SERVICING') {
      return NextResponse.json({ error: 'Admin or CS only' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const projectIdFilter = searchParams.get('projectId')

    // Find projects with Lark chat IDs
    const projects = await prisma.project.findMany({
      where: {
        ...(projectIdFilter
          ? { id: projectIdFilter }
          : {}),
        OR: [
          { larkChatId: { not: null } },
          { larkFolderId: { not: null } },
        ],
      },
      select: {
        id: true,
        code: true,
        larkChatId: true,
        larkFolderId: true,
      },
    })

    // Build a map of larkOpenId â userId for all users with a larkOpenId
    const usersWithLark = await prisma.user.findMany({
      where: { larkOpenId: { not: null } },
      select: { id: true, name: true, larkOpenId: true },
    })
    const openIdToUser = new Map(
      usersWithLark.map(u => [u.larkOpenId!, { id: u.id, name: u.name }])
    )

    const result: SyncResult = {
      totalProjects: projects.length,
      synced: 0,
      skipped: 0,
      assignments: { created: 0, existing: 0, unmatched: 0 },
      details: [],
      errors: [],
    }

    for (const project of projects) {
      // Prefer larkChatId, fall back to larkFolderId (legacy sync stored chat IDs there)
      const chatId = project.larkChatId ?? project.larkFolderId
      if (!chatId) {
        result.skipped++
        continue
      }

      try {
        const members = await getGroupChatMembers(chatId)
        const detail: SyncResult['details'][number] = {
          projectCode: project.code,
          chatId,
          members: [],
        }

        for (const member of members) {
          const user = openIdToUser.get(member.open_id)

          if (!user) {
            detail.members.push({
              name: member.name,
              openId: member.open_id,
              matched: false,
            })
            result.assignments.unmatched++
            continue
          }

          // Upsert ProjectCSAssignment
          try {
            await prisma.projectCSAssignment.upsert({
              where: {
                projectId_userId: {
                  projectId: project.id,
                  userId: user.id,
                },
              },
              create: {
                projectId: project.id,
                userId: user.id,
              },
              update: {}, // no-op if exists
            })

            detail.members.push({
              name: member.name,
              openId: member.open_id,
              matched: true,
              userId: user.id,
            })
            result.assignments.created++
          } catch {
            // Already exists â count as existing
            detail.members.push({
              name: member.name,
              openId: member.open_id,
              matched: true,
              userId: user.id,
            })
            result.assignments.existing++
          }
        }

        result.details.push(detail)
        result.synced++
      } catch (err) {
        result.errors.push(
          `Failed to sync "${project.code}" (chat ${chatId}): ${err instanceof Error ? err.message : 'unknown'}`
        )
        result.skipped++
      }
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    logger.error('POST /api/admin/sync-lark-group-members error:', { error: getErrorMessage(error) })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/sync-lark-group-members
 * Returns projects with their current Lark chat members (preview, no DB writes).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'ADMIN' && session.user.role !== 'CLIENT_SERVICING') {
      return NextResponse.json({ error: 'Admin or CS only' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const projectIdFilter = searchParams.get('projectId')

    const projects = await prisma.project.findMany({
      where: {
        ...(projectIdFilter ? { id: projectIdFilter } : {}),
        OR: [
          { larkChatId: { not: null } },
          { larkFolderId: { not: null } },
        ],
      },
      select: {
        id: true,
        code: true,
        larkChatId: true,
        larkFolderId: true,
        csAssignments: {
          select: {
            user: { select: { id: true, name: true, larkOpenId: true } },
          },
        },
      },
    })

    const preview = projects.map(p => ({
      projectId: p.id,
      projectCode: p.code,
      chatId: p.larkChatId ?? p.larkFolderId,
      currentAssignments: p.csAssignments.map(a => ({
        userId: a.user.id,
        name: a.user.name,
        larkOpenId: a.user.larkOpenId,
      })),
    }))

    return NextResponse.json({ data: preview })
  } catch (error) {
    logger.error('GET /api/admin/sync-lark-group-members error:', { error: getErrorMessage(error) })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Preview failed' },
      { status: 500 }
    )
  }
}
