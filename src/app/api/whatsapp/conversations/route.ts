import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Self-migrating: create tables if they don't exist yet
async function ensureTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "WhatsappConversation" (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      phone       TEXT NOT NULL UNIQUE,
      name        TEXT,
      "lastMessage" TEXT,
      "lastAt"    TIMESTAMPTZ DEFAULT NOW(),
      unread      INTEGER DEFAULT 0,
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "WhatsappMessage" (
      id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "conversationId" TEXT NOT NULL REFERENCES "WhatsappConversation"(id) ON DELETE CASCADE,
      direction       TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
      content         TEXT NOT NULL,
      "sentAt"        TIMESTAMPTZ DEFAULT NOW(),
      status          TEXT DEFAULT 'delivered'
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "WhatsappMessage_conversationId_idx"
    ON "WhatsappMessage"("conversationId")
  `)
}

export interface WaConversation {
  id: string
  phone: string
  name: string | null
  lastMessage: string | null
  lastAt: string
  unread: number
}

export interface WaMessage {
  id: string
  conversationId: string
  direction: 'inbound' | 'outbound'
  content: string
  sentAt: string
  status: string
}

// GET /api/whatsapp/conversations
// GET /api/whatsapp/conversations?id=<conversationId>  → messages for that conversation
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureTables()

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (id) {
    // Return messages for a specific conversation
    const rows = await prisma.$queryRawUnsafe<WaMessage[]>(
      `SELECT id, "conversationId", direction, content, "sentAt", status
       FROM "WhatsappMessage"
       WHERE "conversationId" = $1
       ORDER BY "sentAt" ASC`,
      id
    )
    return NextResponse.json({ data: rows })
  }

  // Return all conversations
  const rows = await prisma.$queryRawUnsafe<WaConversation[]>(
    `SELECT id, phone, name, "lastMessage", "lastAt", unread
     FROM "WhatsappConversation"
     ORDER BY "lastAt" DESC`
  )
  return NextResponse.json({ data: rows })
}

// POST /api/whatsapp/conversations
// Body: { phone, name?, message } — upsert conversation + outbound message
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureTables()

  const body = (await req.json()) as { phone?: string; name?: string; message?: string; direction?: string }
  const { phone, name, message, direction = 'outbound' } = body

  if (!phone || !message) {
    return NextResponse.json({ error: 'phone and message are required' }, { status: 400 })
  }

  // Upsert conversation
  await prisma.$executeRawUnsafe(
    `INSERT INTO "WhatsappConversation" (phone, name, "lastMessage", "lastAt", unread)
     VALUES ($1, $2, $3, NOW(), 0)
     ON CONFLICT (phone) DO UPDATE
       SET name = COALESCE($2, "WhatsappConversation".name),
           "lastMessage" = $3,
           "lastAt" = NOW(),
           unread = CASE WHEN $4 = 'inbound' THEN "WhatsappConversation".unread + 1 ELSE 0 END`,
    phone, name ?? null, message, direction
  )

  const [conv] = await prisma.$queryRawUnsafe<WaConversation[]>(
    `SELECT id FROM "WhatsappConversation" WHERE phone = $1`, phone
  )

  if (!conv) return NextResponse.json({ error: 'Failed to upsert conversation' }, { status: 500 })

  // Insert message
  await prisma.$executeRawUnsafe(
    `INSERT INTO "WhatsappMessage" ("conversationId", direction, content, status)
     VALUES ($1, $2, $3, $4)`,
    conv.id, direction, message, direction === 'outbound' ? 'sent' : 'delivered'
  )

  return NextResponse.json({ data: { conversationId: conv.id } })
}

// PATCH /api/whatsapp/conversations?id=<id>  — mark as read
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await ensureTables()
  await prisma.$executeRawUnsafe(
    `UPDATE "WhatsappConversation" SET unread = 0 WHERE id = $1`, id
  )
  return NextResponse.json({ ok: true })
}
