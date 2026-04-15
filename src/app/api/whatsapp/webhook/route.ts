import { NextRequest, NextResponse } from 'next/server'
import { parseInboundWebhook, sendMessage } from '@/services/whatsapp'
import { prisma, createAuditLog } from '@/lib/db'
import {
  handleClientApprovalResponse,
  processFeedback,
  storeFeedbackOnRevision,
} from '@/services/feedback-processor'
import { notify } from '@/services/lark'
import { logger, getErrorMessage } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    const message = parseInboundWebhook(body)

    if (!message) {
      return NextResponse.json({ received: true })
    }

    // Find a project with a matching client phone number to attach the message
    const client = await prisma.client.findFirst({
      where: { phone: message.from },
      include: { projects: { orderBy: { updatedAt: 'desc' }, take: 1 } },
    })

    // Always log inbound message into standalone sales inbox (non-critical)
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "WhatsappConversation" (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          phone TEXT NOT NULL UNIQUE,
          name TEXT,
          "lastMessage" TEXT,
          "lastAt" TIMESTAMPTZ DEFAULT NOW(),
          unread INTEGER DEFAULT 0,
          "createdAt" TIMESTAMPTZ DEFAULT NOW()
        )
      `)
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "WhatsappMessage" (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          "conversationId" TEXT NOT NULL REFERENCES "WhatsappConversation"(id) ON DELETE CASCADE,
          direction TEXT NOT NULL,
          content TEXT NOT NULL,
          "sentAt" TIMESTAMPTZ DEFAULT NOW(),
          status TEXT DEFAULT 'delivered'
        )
      `)
      await prisma.$executeRawUnsafe(
        `INSERT INTO "WhatsappConversation" (phone, name, "lastMessage", "lastAt", unread)
         VALUES ($1, $2, $3, NOW(), 1)
         ON CONFLICT (phone) DO UPDATE
           SET "lastMessage" = $3, "lastAt" = NOW(),
               unread = "WhatsappConversation".unread + 1`,
        message.from, client?.companyName ?? null, message.text
      )
      const [conv] = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM "WhatsappConversation" WHERE phone = $1`, message.from
      )
      if (conv) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "WhatsappMessage" ("conversationId", direction, content) VALUES ($1, 'inbound', $2)`,
          conv.id, message.text
        )
      }
    } catch { /* non-critical — don't block the webhook response */ }

    if (client && client.projects.length > 0) {
      const project = client.projects[0]

      // Find a CS user to attribute the system message to
      const csUser = await prisma.user.findFirst({
        where: { role: 'CLIENT_SERVICING', active: true },
      })

      if (csUser) {
        await prisma.chatMessage.create({
          data: {
            projectId: project.id,
            senderId: csUser.id,
            content: message.text,
            senderType: 'CLIENT',
            whatsappMessageId: message.messageId,
          },
        })
      }

      // ── AI: detect approval vs. revision request ────────────────────────
      const deliveredItem = await prisma.deliverableItem.findFirst({
        where: { projectId: project.id, status: 'DELIVERED' },
        orderBy: { createdAt: 'desc' },
      })

      if (deliveredItem) {
        const decision = await handleClientApprovalResponse({
          clientPhone: message.from,
          message: message.text,
          projectCode: project.code,
          deliverableItemId: deliveredItem.id,
        }).catch(() => 'UNKNOWN' as const)

        if (decision === 'APPROVED') {
          await prisma.deliverableItem.update({
            where: { id: deliveredItem.id },
            data: { status: 'FA_SIGNED' },
          })
          await createAuditLog({
            projectId: project.id,
            deliverableItemId: deliveredItem.id,
            action: 'CLIENT_APPROVED_VIA_WHATSAPP',
            performedById: csUser?.id ?? '',
            metadata: { phone: message.from, messageId: message.messageId },
          })
          await sendMessage(message.from, `Thank you ${client.contactPerson}! 🎉 Your approval has been recorded. We'll proceed with the final delivery!`).catch(() => {})
          await notify('CS', {
            title: '✅ Client Approved via WhatsApp',
            body: `**${client.contactPerson}** approved **${deliveredItem.itemType}** for project **${project.code}**.`,
            projectCode: project.code,
            actionLabel: 'View Project',
            actionUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/cs/projects/${project.id}`,
          }).catch(() => {})
        } else if (decision === 'REVISION_REQUESTED' && csUser) {
          // AI rewrite + create new revision
          let clarifiedFeedback = message.text
          try {
            const processed = await processFeedback({
              clientName: client.contactPerson,
              projectCode: project.code,
              feedback: message.text,
              revisionCount: deliveredItem.revisionCount,
              revisionLimit: deliveredItem.revisionLimit,
            })
            clarifiedFeedback = processed.clarifiedFeedback

            const revision = await prisma.revision.create({
              data: {
                deliverableItemId: deliveredItem.id,
                revisionNumber: deliveredItem.revisionCount + 1,
                requestedById: csUser.id,
                feedback: message.text,
                status: 'PENDING',
              },
            })
            await prisma.deliverableItem.update({
              where: { id: deliveredItem.id },
              data: { revisionCount: { increment: 1 }, status: 'IN_PROGRESS' },
            })
            if (clarifiedFeedback !== message.text) {
              await storeFeedbackOnRevision(revision.id, {
                clarifiedFeedback,
                designerBrief: clarifiedFeedback,
                requirementChecklist: processed.requirementChecklist as never,
                clientResponseDraft: processed.clientResponseDraft,
                sentiment: processed.sentiment,
                escalate: processed.escalate,
              })
            }
            await sendMessage(message.from, `Thanks ${client.contactPerson}! 📝 We've noted your revision request and will get right on it. We'll notify you once it's ready.`).catch(() => {})
            await notify('CREATIVE', {
              title: '🔄 Revision via WhatsApp',
              body: `**${client.contactPerson}** requested changes for **${project.code}** — ${deliveredItem.itemType}.\n**Brief:** ${clarifiedFeedback.slice(0, 150)}`,
              projectCode: project.code,
            }).catch(() => {})
          } catch (err) {
            logger.warn('[WhatsApp] Revision creation failed:', { error: getErrorMessage(err) })
          }
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error('WhatsApp webhook error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

// 360dialog requires GET for webhook verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const challenge = searchParams.get('hub.challenge')
  if (challenge) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ status: 'ok' })
}
