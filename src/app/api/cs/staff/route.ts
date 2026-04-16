/**
 * GET /api/cs/staff
 *
 * Returns lists of users by role for assignment on Job Track:
 *   csStaff    — CLIENT_SERVICING users
 *   designers  — all design-role users
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const ALLOWED_ROLES = ['ADMIN', 'CLIENT_SERVICING', 'CREATIVE_DIRECTOR', 'SENIOR_ART_DIRECTOR']

const DESIGNER_ROLES = [
  'CREATIVE_DIRECTOR',
  'SENIOR_ART_DIRECTOR',
  'JUNIOR_ART_DIRECTOR',
  'GRAPHIC_DESIGNER',
  'JUNIOR_DESIGNER',
  'DESIGNER_3D',
  'MULTIMEDIA_DESIGNER',
  'DIGITAL_MARKETING',
]

interface StaffRow {
  id: string
  name: string
  email: string
  role: string
}

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const allStaff = await prisma.$queryRawUnsafe<StaffRow[]>(
      `SELECT id, name, email, role FROM "users"
       WHERE role IN ('CLIENT_SERVICING', ${DESIGNER_ROLES.map((_, i) => `$${i + 1}`).join(', ')})
       AND name IS NOT NULL
       ORDER BY name ASC`,
      ...DESIGNER_ROLES
    )

    const csStaff = allStaff.filter(u => u.role === 'CLIENT_SERVICING')
    const designers = allStaff.filter(u => DESIGNER_ROLES.includes(u.role))

    return NextResponse.json({ csStaff, designers })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
