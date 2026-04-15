import { prisma } from '@/lib/db'
import { sendMessage } from '@/services/whatsapp'

// ── Scheduled messages table ──────────────────────────────────────────────────
// Messages are stored in DB with a scheduled_at timestamp.
// A cron endpoint (POST /api/cron/whatsapp) processes due messages every hour.
// This is serverless-safe — no long-lived timers needed.

async function ensureScheduledMessagesTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS scheduled_whatsapp_messages (
      id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id   TEXT        NOT NULL,
      phone        TEXT        NOT NULL,
      message      TEXT        NOT NULL,
      scheduled_at TIMESTAMPTZ NOT NULL,
      sent_at      TIMESTAMPTZ,
      status       TEXT        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','sent','failed')),
      error        TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_swm_scheduled_at
      ON scheduled_whatsapp_messages (scheduled_at)
      WHERE status = 'pending'
  `)
}

async function scheduleWhatsAppMessage(
  projectId: string,
  phone: string,
  message: string,
  scheduledAt: Date
): Promise<void> {
  await ensureScheduledMessagesTable()
  await prisma.$executeRawUnsafe(
    `INSERT INTO scheduled_whatsapp_messages (project_id, phone, message, scheduled_at)
     VALUES ($1, $2, $3, $4)`,
    projectId, phone, message, scheduledAt.toISOString()
  )
}

export interface ReferralLeader {
  clientId: string
  clientName: string
  referrals: number
  convertedRevenue: number
}

export async function triggerPostDeliverySequence(projectId: string): Promise<void> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { client: true },
  })

  if (!project.client?.phone) return

  const clientName = project.client.contactPerson
  const phone = project.client.phone

  // Day 3: WhatsApp follow-up
  const day3Message = `Hi ${clientName}! Just checking in — how is everything with your project ${project.code}? We hope you're happy with the deliverables. 😊`

  // Day 5: Review request (triggered if client replies positively — simplified: always send)
  const day5Message = `Hi ${clientName}, we'd love to hear your feedback! If you're happy with our work, a quick Google review would mean the world to us: https://g.page/r/envicion`

  // Day 30: Re-engagement
  const day30Message = `Hi ${clientName}! It's been a month since we wrapped up ${project.code}. If you have any upcoming campaigns or design needs, we'd love to help. Let us know! 🙌`

  const now = new Date()
  const addDays = (d: number): Date => new Date(now.getTime() + d * 24 * 60 * 60 * 1000)

  // Store messages in DB — processed by POST /api/cron/whatsapp (runs hourly via cron)
  // This is serverless-safe: no in-process timers that die on function cold-start.
  if (process.env.WHATSAPP_360DIALOG_API_KEY) {
    await scheduleWhatsAppMessage(projectId, phone, day3Message,  addDays(3))
    await scheduleWhatsAppMessage(projectId, phone, day5Message,  addDays(5))
    await scheduleWhatsAppMessage(projectId, phone, day30Message, addDays(30))
  }

  await prisma.auditLog.create({
    data: {
      projectId,
      action: 'POST_DELIVERY_SEQUENCE_STARTED',
      performedById: project.assignedCSId ?? '',
      metadata: {
        phone,
        day3: day3Message.slice(0, 50),
        day5: day5Message.slice(0, 50),
        day30: day30Message.slice(0, 50),
        scheduledAt: now.toISOString(),
        scheduledViaCron: true,
      },
    },
  })
}

export async function generateReferralLink(clientId: string): Promise<string> {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } })
  const code = Buffer.from(client.id).toString('base64url').slice(0, 12)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://os.envicion.com'
  return `${baseUrl}/ref/${code}`
}

export function decodeReferralCode(code: string): string {
  return Buffer.from(code, 'base64url').toString('utf-8')
}

export async function trackReferralConversion(
  referralCode: string,
  newLeadId: string
): Promise<void> {
  const clientId = decodeReferralCode(referralCode)

  await prisma.auditLog.create({
    data: {
      action: 'REFERRAL_CONVERSION',
      performedById: clientId,
      metadata: { referralCode, newLeadId, clientId },
    },
  })
}

export async function getReferralLeaderboard(): Promise<ReferralLeader[]> {
  const logs = await prisma.auditLog.findMany({
    where: { action: 'REFERRAL_CONVERSION' },
    select: { performedById: true, metadata: true },
  })

  const clientReferrals: Record<string, { count: number; leadIds: string[] }> = {}

  for (const log of logs) {
    const meta = log.metadata as { newLeadId?: string } | null
    const clientId = log.performedById
    if (!clientReferrals[clientId]) {
      clientReferrals[clientId] = { count: 0, leadIds: [] }
    }
    clientReferrals[clientId].count++
    if (meta?.newLeadId) {
      clientReferrals[clientId].leadIds.push(meta.newLeadId)
    }
  }

  const clientIds = Object.keys(clientReferrals)
  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds } },
    include: {
      projects: { select: { paidAmount: true } },
    },
  })

  return clients
    .map((client) => ({
      clientId: client.id,
      clientName: client.companyName,
      referrals: clientReferrals[client.id]?.count ?? 0,
      convertedRevenue: client.projects.reduce((s, p) => s + (Number(p.paidAmount) || 0), 0),
    }))
    .sort((a, b) => b.referrals - a.referrals)
}
