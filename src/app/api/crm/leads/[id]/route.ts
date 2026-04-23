import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { updateLeadStatus } from '@/services/crm'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { LeadStatus } from '@prisma/client'
import { logger, getErrorMessage } from '@/lib/logger'

const UpdateLeadSchema = z.object({
  status: z.nativeEnum(LeadStatus).optional(),
  score: z.enum(['HOT', 'WARM', 'COLD']).optional(),
  notes: z.string().optional(),
  assignedSalesId: z.string().optional(),
  reason: z.string().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        assignedSales: { select: { id: true, name: true } },
        proposals: true,
      },
    })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    return NextResponse.json({ data: lead })
  } catch (error) {
    logger.error('GET /api/crm/leads/[id] error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to fetch lead' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    const body: unknown = await req.json()
    const data = UpdateLeadSchema.parse(body)

    if (data.status) {
      const lead = await updateLeadStatus(id, data.status, data.reason)
      return NextResponse.json({ data: lead })
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        score: data.score,
        notes: data.notes,
        assignedSalesId: data.assignedSalesId,
      },
    })
    return NextResponse.json({ data: lead })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    logger.error('PATCH /api/crm/leads/[id] error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowedRoles = ['ADMIN', 'SALES', 'CLIENT_SERVICING']
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  try {
    await prisma.lead.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('DELETE /api/crm/leads/[id] error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 })
  }
}
