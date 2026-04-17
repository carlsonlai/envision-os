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
]Z[Y[X\Ë\Ú
Â[YNY[X\[YKÜ[YY[X\Ü[ÚYX]ÚYYK\Ù\Y\Ù\YJB\Ý[\ÜÚYÛY[ËÜX]Y
ÊÂHØ]ÚÂËÈ[XYH^\ÝÈ8 %ÛÝ[\È^\Ý[Â]Z[Y[X\Ë\Ú
Â[YNY[X\[YKÜ[YY[X\Ü[ÚYX]ÚYYK\Ù\Y\Ù\YJB\Ý[\ÜÚYÛY[Ë^\Ý[ÊÊÂBB\Ý[]Z[Ë\Ú
]Z[
B\Ý[Þ[ÙY
ÊÂHØ]Ú
\HÂ\Ý[\ÜË\Ú
Z[YÈÞ[ÈÜÚXÝÛÙ_H
Ú]	ØÚ]YJN	Ù\[Ý[Ù[Ù\ÜÈ\Y\ÜØYÙH	Ý[ÛÝÛßX
B\Ý[ÚÚ\Y
ÊÂBB]\^\ÜÛÙKÛÛÈ]N\Ý[JBHØ]Ú
\ÜHÂÙÙÙ\\Ü	ÔÔÕØ\KØYZ[ÜÞ[Ë[\ËYÜÝ\[Y[X\È\ÜËÈ\ÜÙ]\ÜY\ÜØYÙJ\ÜHJB]\^\ÜÛÙKÛÛÈ\Ü\Ü[Ý[Ù[Ù\ÜÈ\ÜY\ÜØYÙH	ÔÞ[ÈZ[Y	ÈKÈÝ]\Î
LB
BBBÊ
ÑUØ\KØYZ[ÜÞ[Ë[\ËYÜÝ\[Y[X\Â
]\ÈÚXÝÈÚ]Z\Ý\[\ÈÚ]Y[X\È
]Y]ËÈÜ]\ÊK
Â^Ü\Þ[È[Ý[ÛÑU
\N^\]Y\Ý
NÛZ\ÙO^\ÜÛÙOÂHÂÛÛÝÙ\ÜÚ[ÛH]ØZ]Ù]Ù\\Ù\ÜÚ[Û]]Ü[ÛÊBY
\Ù\ÜÚ[ÛË\Ù\HÂ]\^\ÜÛÙKÛÛÈ\Ü	Õ[]]Ü^Y	ÈKÈÝ]\Î
HJBBY
Ù\ÜÚ[Û\Ù\ÛHOOH	ÐQRSÈ	Ù\ÜÚ[Û\Ù\ÛHOOH	ÐÓQSÔÑTPÒSÉÊHÂ]\^\ÜÛÙKÛÛÈ\Ü	ÐYZ[ÜÔÈÛIÈKÈÝ]\Î
ÈJBBÛÛÝÈÙX\Ú\[\ÈHH]ÈT
\K\
BÛÛÝÚXÝY[\HÙX\Ú\[\ËÙ]
	ÜÚXÝY	ÊBÛÛÝÚXÝÈH]ØZ]\ÛXKÚXÝ[X[JÂÚ\NÂÚXÝY[\ÈÈYÚXÝY[\HßJKÔÂÈ\ÐÚ]YÈÝ[HKÈ\ÑÛ\YÈÝ[HKKKÙ[XÝÂYYKÛÙNYK\ÐÚ]YYK\ÑÛ\YYKÜÐ\ÜÚYÛY[ÎÂÙ[XÝÂ\Ù\ÈÙ[XÝÈYYK[YNYK\ÓÜ[YYHHKKKKJBÛÛÝ]Y]ÈHÚXÝËX\
O
ÂÚXÝYYÚXÝÛÙNÛÙKÚ]Y\ÐÚ]YÏÈ\ÑÛ\YÝ\[\ÜÚYÛY[ÎÜÐ\ÜÚYÛY[ËX\
HO
Â\Ù\YK\Ù\Y[YNK\Ù\[YK\ÓÜ[YK\Ù\\ÓÜ[YJJKJJB]\^\ÜÛÙKÛÛÈ]N]Y]ÈJBHØ]Ú
\ÜHÂÙÙÙ\\Ü	ÑÑUØ\KØYZ[ÜÞ[Ë[\ËYÜÝ\[Y[X\È\ÜËÈ\ÜÙ]\ÜY\ÜØYÙJ\ÜHJB]\^\ÜÛÙKÛÛÈ\Ü\Ü[Ý[Ù[Ù\ÜÈ\ÜY\ÜØYÙH	Ô]Y]ÈZ[Y	ÈKÈÝ]\Î
LB
BBB
