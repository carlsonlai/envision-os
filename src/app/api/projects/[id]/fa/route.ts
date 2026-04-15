import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, createAuditLog } from '@/lib/db'
import { generateFAPdf } from '@/services/fa-generator'
import { triggerEvent, CHANNELS, EVENTS } from '@/services/pusher'
import { notify } from '@/services/lark'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { logger, getErrorMessage } from '@/lib/logger'

const ALLOWED_ROLES = ['ADMIN', 'CLIENT_SERVICING', 'CREATIVE_DIRECTOR']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: projectId } = await params
    const { id: userId } = session.user

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, code: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Generate FA PDF
    const pdfBuffer = await generateFAPdf(projectId)

    // Save PDF to local storage
    const faDir = path.join(process.cwd(), 'public', 'uploads', projectId, 'fa')
    await mkdir(faDir, { recursive: true })
    const pdfFilename = `FA-${project.code}-${Date.now()}.pdf`
    const pdfPath = path.join(faDir, pdfFilename)
    await writeFile(pdfPath, pdfBuffer)
    const pdfUrl = `/uploads/${projectId}/fa/${pdfFilename}`

    // Find a deliverable item to attach the FA to
    const deliverableItem = await prisma.deliverableItem.findFirst({
      where: { projectId },
      select: { id: true },
    })

    if (!deliverableItem) {
      return NextResponse.json(
        { error: 'No deliverable item found for this project. Please create a deliverable before generating an FA.' },
        { status: 400 }
      )
    }

    // Create FileVersion record for the FA
    const fileVersion = await prisma.fileVersion.create({
      data: {
        deliverableItemId: deliverableItem.id,
        projectId,
        version: 1,
        filename: pdfFilename,
        url: pdfUrl,
        larkFolderStage: 'FA',
        uploadedById: userId,
        fileSize: pdfBuffer.length,
      },
    })

    await createAuditLog({
      projectId,
      action: 'FA_PDF_GENERATED',
      performedById: userId,
      metadata: { pdfFilename, pdfUrl, fileVersionId: fileVersion.id },
    })

    // Trigger Pusher
    await triggerEvent(CHANNELS.project(projectId), EVENTS.FA_READY, {
      projectId,
      pdfUrl,
      pdfFilename,
      timestamp: new Date().toISOString(),
    })

    // Notify CS + management
    try {
      await notify('CS', {
        title: 'FA PDF Generated',
        body: `Final Artwork PDF has been generated for project **${project.code}**. Ready for client sign-off.`,
        projectCode: project.code,
        actionLabel: 'View FA',
        actionUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/portal/${projectId}/fa`,
      })
      await notify('MANAGEMENT', {
        title: 'FA Generated',
        body: `FA package for **${project.code}** is ready for sign-off.`,
        projectCode: project.code,
      })
    } catch (err) {
      logger.warn('Lark notify failed (non-fatal):', { error: getErrorMessage(err) })
    }

    return NextResponse.json({
      data: { pdfUrl, pdfFilename, fileVersionId: fileVersion.id },
    })
  } catch (error) {
    logger.error('POST /api/projects/[id]/fa error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to generate FA PDF' }, { status: 500 })
  }
}
