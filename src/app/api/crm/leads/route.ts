import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createLead } from '@/services/crm'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { logger, getErrorMessage } from '@/lib/logger'
import { inngest, AGENT_EVENTS } from '@/lib/inngest'

const CreateLeadSchema = z.object({
  name: z.string().min(1),
  company: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  assignedSalesId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const salesId = searchParams.get('salesId') ?? undefined

  try {
    const leads = await prisma.lead.findMany({
      where: salesId ? { assignedSalesId: salesId } : {},
      include: { assignedSales: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ data: leads })
  } catch (error) {
    logger.error('GET /api/crm/leads error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowedRoles = ['ADMIN', 'SALES', 'CLIENT_SERVICING']
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body: unknown = await req.json()
    const data = CreateLeadSchema.parse(body)
    const lead = await createLead(data)
    // Notify agent layer: new lead created → Demand Intel + Lead Engine
    inngest.send({ name: AGENT_EVENTS.leadCreated, data: { leadId: lead.id } }).catch(() => {})
    return NextResponse.json({ data: lead }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    logger.error('POST /api/crm/leads error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
  }
}
