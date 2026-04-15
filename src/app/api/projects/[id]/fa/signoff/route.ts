import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, createAuditLog } from '@/lib/db'
import { triggerEvent, CHANNELS, EVENTS } from '@/services/pusher'
import { notify } from '@/services/lark'
import { z } from 'zod'
import { logger, getErrorMessage } from '@/lib/logger'

const signOffSchema = z.object({
  clientName: z.string().min(1, 'Client name is required'),
  disclaimerAccepted: z.literal(true).refine((v) => v === true, {
    message: 'You must accept the disclaimer',
  }),
  bothPartiesChecked: z.literal(true).refine((v) => v === true, {
    message: 'Both parties must confirm they have checked the artwork',
  }),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only CLIENT or CS can sign off
    const { id: projectId } = await params
    const { id: userId } = session.user

    const body = await req.json()
    const parsed = signOffSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { clientName, disclaimerAccepted, bothPartiesChecked } = parsed.data

    // Validate all items are DELIVERED
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        deliverableItems: { select: { id: true, status: true, itemType: true } },
        client: { select: { companyName: true, email: true, contactPerson: true } },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const nonDelivered = project.deliverableItems.filter(
      (i) => i.status !== 'DELIVERED' && i.status !== 'FA_SIGNED'
    )

    if (nonDelivered.length > 0) {
      return NextResponse.json(
        {
          error: 'All items must be in DELIVERED status before signing off',
          nonDeliveredItems: nonDelivered.map((i) => ({ id: i.id, type: i.itemType, status: i.status })),
        },
        { status: 422 }
      )
    }

    // Get client IP
    const forwarded = req.headers.get('x-forwarded-for')
    const clientIP = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') ?? 'unknown'

    // Find existing FA PDF URL from file versions
    const faFile = await prisma.fileVersion.findFirst({
      where: { projectId, larkFolderStage: 'FA' },
      orderBy: { createdAt: 'desc' },
      select: { url: true, larkFileToken: true },
    })

    const signedAt = new Date()

    // Create FASignOff record
    const signOff = await prisma.fASignOff.create({
      data: {
        projectId,
        pdfUrl: faFile?.url ?? '',
        larkFileToken: faFile?.larkFileToken,
        clientName,
        clientIP,
        disclaimerAccepted,
        bothPartiesChecked,
        signedAt,
      },
    })

    // Update all DELIVERED items to FA_SIGNED
    await prisma.deliverableItem.updateMany({
      where: { projectId, status: 'DELIVERED' },
      data: { status: 'FA_SIGNED' },
    })

    // Update project status to COMPLETED
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'COMPLETED' },
    })

    await createAuditLog({
      projectId,
      action: 'FA_SIGNED',
      performedById: userId,
      metadata: {
        clientName,
        clientIP,
        signedAt: signedAt.toISOString(),
        signOffId: signOff.id,
      },
    })

    // Trigger Pusher
    await triggerEvent(CHANNELS.project(projectId), EVENTS.FA_SIGNED, {
      projectId,
      clientName,
      signedAt: signedAt.toISOString(),
      timestamp: new Date().toISOString(),
    })
    await triggerEvent(CHANNELS.management, EVENTS.FA_SIGNED, {
      projectId,
      projectCode: project.code,
      clientName,
      signedAt: signedAt.toISOString(),
    })

    // Send confirmation email
    if (process.env.RESEND_API_KEY && project.client?.email) {
      try {
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: `Envision Software <noreply@${process.env.NEXT_PUBLIC_APP_URL?.replace('https://', '') ?? 'envision.com'}>`,
          to: [project.client.email],
          subject: `Final Artwork Sign-Off Confirmation — ${project.code}`,
          html: `
            <h2>Final Artwork Sign-Off Confirmed</h2>
            <p>Dear ${clientName},</p>
            <p>Thank you for signing off the Final Artwork package for project <strong>${project.code}</strong>.</p>
            <p><strong>Details:</strong></p>
            <ul>
              <li>Signed by: ${clientName}</li>
              <li>Date & Time: ${signedAt.toLocaleString('en-MY')}</li>
              <li>IP Address: ${clientIP}</li>
            </ul>
            <p>By completing this sign-off, you have confirmed that all artwork has been reviewed and approved by your organisation. Any amendments required after this sign-off will constitute additional work subject to additional charges.</p>
            <p>Your invoice will be issued shortly.</p>
            <p>Best regards,<br/>Envision Software</p>
          `,
        })
        await prisma.fASignOff.update({
          where: { id: signOff.id },
          data: { emailSentAt: new Date() },
        })
      } catch (err) {
        logger.warn('Resend email failed (non-fatal)', { error: getErrorMessage(err) })
      }
    } else {
      logger.info('[FA Sign-Off] Email would be sent to', { email: project.client?.email, note: 'RESEND_API_KEY not configured' })
    }

    // Notify team via Lark
    try {
      await notify('MANAGEMENT', {
        title: 'FA Signed — Project Completed',
        body: `Client **${clientName}** has signed off the FA for project **${project.code}**. Project is now COMPLETED.`,
        projectCode: project.code,
        actionLabel: 'View Project',
        actionUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/cs/projects/${projectId}`,
      })
      await notify('CS', {
        title: 'FA Signed',
        body: `FA for **${project.code}** has been signed by **${clientName}**. Project is now closed.`,
        projectCode: project.code,
      })
    } catch (err) {
      logger.warn('Lark notify failed (non-fatal):', { error: getErrorMessage(err) })
    }

    return NextResponse.json({
      data: {
        signOffId: signOff.id,
        signedAt: signedAt.toISOString(),
        projectStatus: 'COMPLETED',
        message: 'Thank you. A confirmation email has been sent to you.',
      },
    })
  } catch (error) {
    logger.error('POST /api/projects/[id]/fa/signoff error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to process sign-off' }, { status: 500 })
  }
}
