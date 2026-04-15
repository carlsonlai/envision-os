import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

async function ensureTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS reputation_mentions (
      id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      platform     TEXT        NOT NULL,
      author       TEXT        NOT NULL,
      text         TEXT        NOT NULL,
      sentiment    TEXT        NOT NULL DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'neutral', 'negative')),
      url          TEXT,
      ai_draft     TEXT,
      mentioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

interface MentionRow {
  id: string
  platform: string
  author: string
  text: string
  sentiment: string
  url: string | null
  ai_draft: string | null
  mentioned_at: string
  created_at: string
}

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensureTable()

  const rows = await prisma.$queryRawUnsafe<MentionRow[]>(
    `SELECT id, platform, author, text, sentiment, url, ai_draft, mentioned_at, created_at
     FROM reputation_mentions
     ORDER BY mentioned_at DESC
     LIMIT 100`
  )

  const data = rows.map(r => ({
    id: r.id,
    platform: r.platform,
    author: r.author,
    text: r.text,
    sentiment: r.sentiment,
    url: r.url,
    aiDraft: r.ai_draft,
    mentionedAt: r.mentioned_at,
    createdAt: r.created_at,
  }))

  return NextResponse.json({ success: true, data })
}

const createSchema = z.object({
  platform:    z.string().min(1),
  author:      z.string().min(1),
  text:        z.string().min(1),
  sentiment:   z.enum(['positive', 'neutral', 'negative']).default('neutral'),
  url:         z.string().url().optional(),
  mentionedAt: z.string().optional(),
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

  const { platform, author, text, sentiment, url, mentionedAt } = parsed.data

  await prisma.$executeRawUnsafe(
    `INSERT INTO reputation_mentions (platform, author, text, sentiment, url, mentioned_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    platform, author, text, sentiment, url ?? null,
    mentionedAt ? new Date(mentionedAt) : new Date()
  )

  return NextResponse.json({ success: true })
}

const patchSchema = z.object({
  sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
  aiDraft:   z.string().nullable().optional(),
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

  if (parsed.data.sentiment !== undefined) { sets.push(`sentiment = $${idx}`); values.push(parsed.data.sentiment); idx++ }
  if (parsed.data.aiDraft   !== undefined) { sets.push(`ai_draft = $${idx}`);  values.push(parsed.data.aiDraft);   idx++ }

  if (sets.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  values.push(id)
  await prisma.$executeRawUnsafe(
    `UPDATE reputation_mentions SET ${sets.join(', ')} WHERE id = $${idx}`,
    ...values
  )

  return NextResponse.json({ success: true })
}
