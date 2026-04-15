import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum([
    'ADMIN', 'CREATIVE_DIRECTOR', 'SENIOR_ART_DIRECTOR', 'SALES',
    'CLIENT_SERVICING', 'JUNIOR_ART_DIRECTOR', 'GRAPHIC_DESIGNER',
    'JUNIOR_DESIGNER', 'DESIGNER_3D', 'DIGITAL_MARKETING', 'CLIENT'
  ]).optional(),
  active: z.boolean().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const body = await req.json()
  const parsed = updateUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }
  const user = await prisma.user.update({
    where: { id },
    data: parsed.data,
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })
  return NextResponse.json({ data: user })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  // Prevent deleting yourself
  if (id === session.user.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }
  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
