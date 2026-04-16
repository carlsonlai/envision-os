/**
 * POST /api/admin/assign-cs-workload
 *
 * One-time endpoint: creates Khayrin & Alia as CS users,
 * then splits all active projects (PROJECTED + ONGOING) 50/50 between them.
 * Restricted to ADMIN role.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const hash = (pw: string) => bcrypt.hashSync(pw, 12)

    // 1. Upsert Khayrin
    const khayrin = await prisma.user.upsert({
      where: { email: 'khayrin@envicionstudio.com.my' },
      update: { role: 'CLIENT_SERVICING', active: true },
      create: {
        name: 'Khayrin',
        email: 'khayrin@envicionstudio.com.my',
        password: hash('Envicion@2026!'),
        role: 'CLIENT_SERVICING',
        active: true,
      },
    })

    // 2. Upsert Alia
    const alia = await prisma.user.upsert({
      where: { email: 'alia@envicionstudio.com.my' },
      update: { role: 'CLIENT_SERVICING', active: true },
      create: {
        name: 'Alia',
        email: 'alia@envicionstudio.com.my',
        password: hash('Envicion@2026!'),
        role: 'CLIENT_SERVICING',
        active: true,
      },
    })

    // 3. Fetch all active projects ordered by code
    const projects = await prisma.project.findMany({
      where: { status: { in: ['PROJECTED', 'ONGOING'] } },
      select: { id: true, code: true, status: true },
      orderBy: { code: 'asc' },
    })

    // 4. Split 50/50 — alternating
    const khayrinIds: string[] = []
    const aliaIds: string[] = []
    for (let i = 0; i < projects.length; i++) {
      if (i % 2 === 0) {
        khayrinIds.push(projects[i].id)
      } else {
        aliaIds.push(projects[i].id)
      }
    }

    // 5. Batch update
    const kResult = await prisma.project.updateMany({
      where: { id: { in: khayrinIds } },
      data: { assignedCSId: khayrin.id },
    })

    const aResult = await prisma.project.updateMany({
      where: { id: { in: aliaIds } },
      data: { assignedCSId: alia.id },
    })

    // 6. Build summary
    const khayrinProjects = projects.filter((p) => khayrinIds.includes(p.id))
    const aliaProjects = projects.filter((p) => aliaIds.includes(p.id))

    return NextResponse.json({
      success: true,
      summary: {
        totalProjects: projects.length,
        khayrin: {
          id: khayrin.id,
          assigned: kResult.count,
          projects: khayrinProjects.map((p) => p.code),
        },
        alia: {
          id: alia.id,
          assigned: aResult.count,
          projects: aliaProjects.map((p) => p.code),
        },
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
