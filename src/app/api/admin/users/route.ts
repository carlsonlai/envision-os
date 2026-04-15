import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum([
    'ADMIN', 'CREATIVE_DIRECTOR', 'SENIOR_ART_DIRECTOR', 'SALES',
    'CLIENT_SERVICING', 'JUNIOR_ART_DIRECTOR', 'GRAPHIC_DESIGNER',
    'JUNIOR_DESIGNER', 'DESIGNER_3D', 'DIGITAL_MARKETING', 'CLIENT'
  ]),
})

// Ensure the larkOpenId column exists (it may not be present if db push
// hasn't been run yet after the schema update)
async function ensureLarkOpenIdColumn(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "larkOpenId" TEXT UNIQUE`
  )
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // Ensure column exists before querying it
  await ensureLarkOpenIdColumn()
  // Use raw SQL to include larkOpenId (column added by sync-lark migration,
  // not yet in the generated Prisma client until next db push)
  const users = await prisma.$queryRawUnsafe<Array<{
    id: string
    name: string
    email: string
    role: string
    avatar: string | null
    active: boolean
    larkOpenId: string | null
    createdAt: Date
  }>>(
    `SELECT id, name, email, role, avatar, active, "larkOpenId", "createdAt"
     FROM "users"
     ORDER BY active DESC, name ASC`
  )
  return NextResponse.json({ data: users })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json()
  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }
  const { name, email, password, role } = parsed.data
  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
  const hashed = bcrypt.hashSync(password, 12)
  const user = await prisma.user.create({
    data: { name, email, password: hashed, role },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })
  return NextResponse.json({ data: user }, { status: 201 })
}
