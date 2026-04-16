/**
 * POST /api/admin/assign-cs-workload
 *
 * Assigns projects to CS staff (Khayrin & Alia) based on Lark group chat membership.
 * For each project with a larkFolderId, fetches group members from Lark API
 * and assigns the project to whichever CS person is in that chat.
 *
 * Query params:
 *   ?revert=true  — clears all assignedCSId (resets to null)
 *
 * Restricted to ADMIN role.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getToken } from '@/services/lark'
import axios from 'axios'

const LARK_BASE = 'https://open.larksuite.com/open-apis'

interface LarkMember {
  member_id: string
  member_id_type: string
  name?: string
}

/** Fetch all members of a Lark group chat */
async function getChatMembers(chatId: string, token: string): Promise<LarkMember[]> {
  const members: LarkMember[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      member_id_type: 'open_id',
      page_size: '100',
    })
    if (pageToken) params.set('page_token', pageToken)

    const res = await axios.get<{
      code: number
      data: {
        items?: LarkMember[]
        page_token?: string
        has_more?: boolean
      }
    }>(`${LARK_BASE}/im/v1/chats/${chatId}/members?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (res.data.code !== 0) break

    for (const item of res.data.data.items ?? []) {
      members.push(item)
    }

    pageToken = res.data.data.has_more ? res.data.data.page_token : undefined
  } while (pageToken)

  return members
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const isRevert = url.searchParams.get('revert') === 'true'

  try {
    // ── REVERT MODE: clear all CS assignments ──
    if (isRevert) {
      const result = await prisma.project.updateMany({
        where: { assignedCSId: { not: null } },
        data: { assignedCSId: null },
      })
      return NextResponse.json({
        success: true,
        action: 'revert',
        cleared: result.count,
      })
    }

    // ── ASSIGN MODE: use Lark chat membership ──

    // 1. Find Khayrin and Alia in the DB (by role + name pattern)
    const csUsers = await prisma.user.findMany({
      where: {
        role: 'CLIENT_SERVICING',
        active: true,
        name: { in: ['Khayrin', 'Alia'] },
      },
      select: { id: true, name: true, larkOpenId: true },
    })

    const khayrin = csUsers.find((u) => u.name === 'Khayrin')
    const alia = csUsers.find((u) => u.name === 'Alia')

    if (!khayrin || !alia) {
      return NextResponse.json({
        error: 'Could not find both Khayrin and Alia as active CLIENT_SERVICING users',
        found: csUsers.map((u) => u.name),
      }, { status: 400 })
    }

    if (!khayrin.larkOpenId || !alia.larkOpenId) {
      return NextResponse.json({
        error: 'Khayrin or Alia missing larkOpenId — run Lark staff sync first',
        khayrinLarkId: khayrin.larkOpenId ?? null,
        aliaLarkId: alia.larkOpenId ?? null,
      }, { status: 400 })
    }

    const csLarkIds = new Map<string, string>([
      [khayrin.larkOpenId, khayrin.id],
      [alia.larkOpenId, alia.id],
    ])

    // 2. Fetch all active projects that have a Lark chat
    const projects = await prisma.project.findMany({
      where: {
        status: { in: ['PROJECTED', 'ONGOING'] },
        larkFolderId: { not: null },
      },
      select: { id: true, code: true, larkFolderId: true, status: true },
      orderBy: { code: 'asc' },
    })

    // 3. Get Lark token once
    const token = await getToken()

    // 4. For each project, check chat members
    const assignments: Array<{
      projectId: string
      code: string
      assignedTo: string | null
      assignedName: string
      memberNames: string[]
    }> = []

    for (const project of projects) {
      if (!project.larkFolderId) continue

      try {
        const members = await getChatMembers(project.larkFolderId, token)
        const memberOpenIds = members.map((m) => m.member_id)
        const memberNames = members.map((m) => m.name ?? m.member_id)

        // Check which CS person is in this chat
        let assignedUserId: string | null = null
        let assignedName = 'unassigned'

        for (const [larkId, userId] of csLarkIds) {
          if (memberOpenIds.includes(larkId)) {
            assignedUserId = userId
            assignedName = userId === khayrin.id ? 'Khayrin' : 'Alia'
            break // Take first match (if both are in chat, first wins)
          }
        }

        // If both are members, assign to first found (Khayrin takes priority per Map order)
        // Check if BOTH are in the chat
        const khayrinInChat = memberOpenIds.includes(khayrin.larkOpenId!)
        const aliaInChat = memberOpenIds.includes(alia.larkOpenId!)

        if (khayrinInChat && aliaInChat) {
          // Both in chat — keep Khayrin (first match) but note it
          assignedName = 'Khayrin (both in chat)'
        }

        if (assignedUserId) {
          await prisma.project.update({
            where: { id: project.id },
            data: { assignedCSId: assignedUserId },
          })
        }

        assignments.push({
          projectId: project.id,
          code: project.code,
          assignedTo: assignedUserId,
          assignedName,
          memberNames,
        })
      } catch {
        assignments.push({
          projectId: project.id,
          code: project.code,
          assignedTo: null,
          assignedName: 'error fetching members',
          memberNames: [],
        })
      }
    }

    // 5. Also handle projects WITHOUT larkFolderId (leave unassigned)
    const noChat = await prisma.project.findMany({
      where: {
        status: { in: ['PROJECTED', 'ONGOING'] },
        larkFolderId: null,
      },
      select: { id: true, code: true },
      orderBy: { code: 'asc' },
    })

    // 6. Build summary
    const khayrinAssigned = assignments.filter((a) => a.assignedTo === khayrin.id)
    const aliaAssigned = assignments.filter((a) => a.assignedTo === alia.id)
    const unassigned = assignments.filter((a) => !a.assignedTo)

    return NextResponse.json({
      success: true,
      action: 'assign-by-lark-chat',
      summary: {
        totalWithChat: projects.length,
        totalWithoutChat: noChat.length,
        khayrin: {
          id: khayrin.id,
          larkOpenId: khayrin.larkOpenId,
          count: khayrinAssigned.length,
          projects: khayrinAssigned.map((a) => a.code),
        },
        alia: {
          id: alia.id,
          larkOpenId: alia.larkOpenId,
          count: aliaAssigned.length,
          projects: aliaAssigned.map((a) => a.code),
        },
        unassigned: {
          noMemberMatch: unassigned.map((a) => a.code),
          noLarkChat: noChat.map((p) => p.code),
        },
      },
      details: assignments,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
