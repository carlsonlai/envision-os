import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ensureSchemaUpToDate } from '@/lib/db-migrations'
import { uploadToDrive, kindFromMime } from '@/services/gdrive'
import type { AssetKind } from '@prisma/client'

// Edge runtime can't use googleapis (Node APIs). Force Node.
export const runtime = 'nodejs'
// Uploads can be large — disable body-size optimisations.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Session = Awaited<ReturnType<typeof getServerSession>> & {
  user?: { id?: string } | null
}

export async function POST(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as Session | null
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })

  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const platform = (form.get('platform') as string | null) || null
  const tagsRaw = (form.get('tags') as string | null) || ''
  const tags = tagsRaw
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)

  // 50 MB guard — protects Vercel function memory.
  const MAX_BYTES = 50 * 1024 * 1024
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (${Math.round(file.size / 1_048_576)} MB). Limit is 50 MB.` },
      { status: 413 },
    )
  }

  try {
    // Ensure the assets table exists — self-healing migration on first upload.
    await ensureSchemaUpToDate()

    const buf = Buffer.from(await file.arrayBuffer())
    const mimeType = file.type || 'application/octet-stream'

    const uploaded = await uploadToDrive({
      name: file.name,
      mimeType,
      data: buf,
    })

    const asset = await prisma.asset.create({
      data: {
        driveFileId: uploaded.id,
        name: uploaded.name,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.size || buf.byteLength,
        kind: kindFromMime(uploaded.mimeType) as AssetKind,
        webViewLink: uploaded.webViewLink,
        webContentLink: uploaded.webContentLink,
        thumbnailLink: uploaded.thumbnailLink,
        uploaderId: session.user.id ?? null,
        platform,
        tags,
      },
    })

    return NextResponse.json({ ok: true, asset })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Upload failed'
    console.error('[assets/upload] error:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
