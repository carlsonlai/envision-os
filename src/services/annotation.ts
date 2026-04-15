import { prisma } from '@/lib/db'

export interface AnnotationComment {
  id: string
  x: number
  y: number
  width: number
  height: number
  text: string
  authorId: string
  authorName: string
  createdAt: string
  resolved: boolean
}

export interface AnnotationData {
  objects: object[] // Fabric.js serialized objects (drawings, arrows)
  comments: AnnotationComment[]
}

export async function saveAnnotations(
  revisionId: string,
  data: AnnotationData
): Promise<void> {
  const serialized = JSON.parse(JSON.stringify(data))

  await prisma.revision.update({
    where: { id: revisionId },
    data: {
      annotationData: serialized,
    },
  })
}

export async function getAnnotations(
  revisionId: string
): Promise<AnnotationData | null> {
  const revision = await prisma.revision.findUnique({
    where: { id: revisionId },
    select: { annotationData: true },
  })

  if (!revision?.annotationData) {
    return null
  }

  const raw = revision.annotationData as Record<string, unknown>

  const parsed: AnnotationData = {
    objects: Array.isArray(raw.objects) ? (raw.objects as object[]) : [],
    comments: Array.isArray(raw.comments)
      ? (raw.comments as AnnotationComment[])
      : [],
  }

  return parsed
}
