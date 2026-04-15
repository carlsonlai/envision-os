import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

async function ensureTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS reputation_reviews (
      id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      platform     TEXT        NOT NULL,
      author       TEXT        NOT NULL,
      rating       INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
      text         TEXT        NOT NULL,
      replied      BOOLEAN     NOT NULL DEFAULT false,
      ai_draft     TEXT,
      reviewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

interface ReviewRow {
  id: string
  platform: string
  author: string
  rating: number
  text: string
  replied: boolean
  ai_draft: string | null
  reviewed_at: string
  created_at: string
}

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensureTable()

  const rows = await prisma.$queryRawUnsafe<ReviewRow[]>(
    `SELECT id, platform, author, rating, text, replied, ai_draft, reviewed_at, created_at
     FROM reputation_reviews
     ORDER BY reviewed_at DESC
     LIMIT 100`
  )

  const data = rows.map(r => ({
    id: r.id,
    platform: r.platform,
    author: r.author,
    rating: r.rating,
    text: r.text,
    replied: r.replied,
    aiDraft: r.ai_draft,
    reviewedAt: r.reviewed_at,
    createdAt: r.created_at,
  }))

  return NextResponse.json({ success: true, data })
}

const createSchema = z.object({
  platform: z.string().min(1),
  author: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(1),
  reviewedAt: z.string().optional(),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await ensureTable()

  const body = await req.json() as unknown
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { platform, author, rating, text, reviewedAt } = parsed.data

  await prisma.$executeRawUnsafe(
    `INSERT INTO reputation_reviews (platform, author, rating, text, reviewed_at)
     VALUES ($1, $2, $3, $4, $5)`,
    platform, author, rating, text,
    reviewedAt ? new Date(reviewedAt) : new Date()
  )

  return NextResponse.json({ success: true })
}

const patchSchema = z.object({
  replied:  z.boolean().optional(),
  aiDraft:  z.string().nullable().optional(),
})

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await ensureTable()

  const body = await req.json() as unknown
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const sets: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (parsed.data.replied !== undefined) { sets.push(`replied = $${idx}`); values.push(parsed.data.replied); idx++ }
  if (parsed.data.aiDraft  !== undefined) { sets.push(`ai_draft = $${idx}`); values.push(parsed.data.aiDraft);  idx++ }

  if (sets.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  values.push(id)
  await prisma.$executeRawUnsafe(
    `UPDATE reputation_reviews SET ${sets.join(', ')} WHERE id = $${idx}`,
    ...values
  )

  return NextResponse.json({ success: true })
}
