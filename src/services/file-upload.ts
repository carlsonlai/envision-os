import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { prisma, createAuditLog } from '@/lib/db'
import { triggerEvent, CHANNELS, EVENTS } from '@/services/pusher'
import { notify } from '@/services/lark'
import type { LarkFolderMap } from '@/services/lark'
import { uploadFile as uploadToLark } from '@/services/lark'
import { logger, getErrorMessage } from '@/lib/logger'

export interface UploadResult {
  url: string
  larkFileToken: string | null
  filename: string
  fileSize: number
  version: number
}

export async function uploadDeliverableFile(
  file: Buffer,
  filename: string,
  itemId: string,
  uploadedById: string,
  stage: 'WIP' | 'APPROVED' | 'FA' | 'SIGNED' | 'AUDIT'
): Promise<UploadResult> {
  // 1. Fetch the deliverable item to get projectId
  const item = await prisma.deliverableItem.findUnique({
    where: { id: itemId },
    include: {
      project: {
        include: {
          client: { select: { companyName: true } },
        },
      },
    },
  })

  if (!item) {
    throw new Error(`Deliverable item not found: ${itemId}`)
  }

  const projectId = item.projectId

  // 2. Determine next version number
  const latestVersion = await prisma.fileVersion.findFirst({
    where: { deliverableItemId: itemId },
    orderBy: { version: 'desc' },
    select: { version: true },
  })

  const nextVersion = latestVersion ? latestVersion.version + 1 : 1

  // 3. Create versioned filename
  const ext = path.extname(filename)
  const base = path.basename(filename, ext)
  const versionedFilename = `${base}_v${nextVersion}${ext}`

  // 4. Save to local /public/uploads/
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', projectId, itemId)
  await mkdir(uploadsDir, { recursive: true })
  const filePath = path.join(uploadsDir, versionedFilename)
  await writeFile(filePath, file)
  const publicUrl = `/uploads/${projectId}/${itemId}/${versionedFilename}`

  // 5. Attempt Lark upload (non-fatal if Lark not configured)
  let larkFileToken: string | null = null

  if (
    process.env.LARK_APP_ID &&
    process.env.LARK_APP_SECRET &&
    item.project.larkFolderId
  ) {
    try {
      const larkStageMap: Record<string, keyof LarkFolderMap> = {
        WIP: 'wip',
        APPROVED: 'approved',
        FA: 'fa',
        SIGNED: 'faSigned',
        AUDIT: 'audit',
      }

      const folderMap: LarkFolderMap = {
        root: item.project.larkFolderId,
        brief: '',
        references: '',
        wip: item.project.larkFolderId,
        approved: item.project.larkFolderId,
        fa: item.project.larkFolderId,
        faSigned: item.project.larkFolderId,
        audit: item.project.larkFolderId,
      }

      const larkStage = larkStageMap[stage] ?? 'wip'
      void larkStage

      larkFileToken = await uploadToLark(file, versionedFilename, stage as 'WIP' | 'APPROVED' | 'FA' | 'FA_SIGNED' | 'AUDIT', folderMap)
    } catch (err) {
      logger.warn('Lark upload failed (non-fatal):', { error: getErrorMessage(err) })
    }
  }

  // 6. Create LarkFolderStage mapping
  const larkStageEnumMap: Record<string, 'WIP' | 'APPROVED' | 'FA' | 'SIGNED' | 'AUDIT'> = {
    WIP: 'WIP',
    APPROVED: 'APPROVED',
    FA: 'FA',
    SIGNED: 'SIGNED',
    AUDIT: 'AUDIT',
  }

  // 7. Create FileVersion record
  const fileVersion = await prisma.fileVersion.create({
    data: {
      deliverableItemId: itemId,
      projectId,
      version: nextVersion,
      filename: versionedFilename,
      url: publicUrl,
      larkFileToken,
      larkFolderStage: larkStageEnumMap[stage] ?? 'WIP',
      uploadedById,
      fileSize: file.length,
    },
  })

  // 8. Update item status to WIP_UPLOADED if it was IN_PROGRESS
  if (item.status === 'IN_PROGRESS' || item.status === 'PENDING') {
    await prisma.deliverableItem.update({
      where: { id: itemId },
      data: { status: 'WIP_UPLOADED' },
    })
  }

  // 9. Create AuditLog
  await createAuditLog({
    projectId,
    deliverableItemId: itemId,
    action: 'FILE_UPLOADED',
    performedById: uploadedById,
    metadata: {
      filename: versionedFilename,
      version: nextVersion,
      stage,
      fileSize: file.length,
    },
  })

  // 10. Trigger Pusher NEW_FILE event
  await triggerEvent(CHANNELS.project(projectId), EVENTS.NEW_FILE, {
    itemId,
    version: nextVersion,
    filename: versionedFilename,
    url: publicUrl,
    stage,
    uploadedById,
    timestamp: new Date().toISOString(),
  })

  // 11. Notify CS via Lark (non-fatal)
  try {
    await notify('CS', {
      title: 'New File Uploaded',
      body: `A new file has been uploaded for project **${item.project.code}** (v${nextVersion}).\nFile: ${versionedFilename}`,
      projectCode: item.project.code,
      actionLabel: 'Review in Envision OS',
      actionUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/cs/projects/${projectId}`,
    })
  } catch (err) {
    logger.warn('Lark notify failed (non-fatal):', { error: getErrorMessage(err) })
  }

  return {
    url: publicUrl,
    larkFileToken,
    filename: versionedFilename,
    fileSize: file.length,
    version: nextVersion,
  }
}
