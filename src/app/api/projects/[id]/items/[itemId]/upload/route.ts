import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { uploadDeliverableFile } from '@/services/file-upload'
import { logger, getErrorMessage } from '@/lib/logger'

const ALLOWED_ROLES = [
  'ADMIN',
  'CREATIVE_DIRECTOR',
  'SENIOR_ART_DIRECTOR',
  'CLIENT_SERVICING',
  'JUNIOR_ART_DIRECTOR',
  'GRAPHIC_DESIGNER',
  'JUNIOR_DESIGNER',
  'DESIGNER_3D',
  'DIGITAL_MARKETING',
]

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { itemId } = await params

    const formData = await req.formData()
    const fileEntry = formData.get('file')

    if (!fileEntry || typeof fileEntry === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const file = fileEntry as File
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const filename = file.name

    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 })
    }

    const stageParam = formData.get('stage')
    const stage = (
      stageParam && ['WIP', 'APPROVED', 'FA', 'SIGNED', 'AUDIT'].includes(String(stageParam))
        ? String(stageParam)
        : 'WIP'
    ) as 'WIP' | 'APPROVED' | 'FA' | 'SIGNED' | 'AUDIT'

    const result = await uploadDeliverableFile(
      fileBuffer,
      filename,
      itemId,
      session.user.id,
      stage
    )

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    logger.error('POST /api/projects/[id]/items/[itemId]/upload error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }
}
