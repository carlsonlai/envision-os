import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { logger, getErrorMessage } from '@/lib/logger'

const ALLOWED_ROLES = ['ADMIN', 'SALES', 'CLIENT_SERVICING', 'AI_SALES_AGENT', 'AI_CS_AGENT']

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const tier = searchParams.get('tier') ?? undefined
    const csId = searchParams.get('csId') ?? undefined
    const salesId = searchParams.get('salesId') ?? undefined

    const clients = await prisma.client.findMany({
      where: {
        ...(tier ? { tier: tier as never } : {}),
        ...(csId ? { assignedCSId: csId } : {}),
        ...(salesId ? { assignedSalesId: salesId } : {}),
      },
      include: {
        assignedCS: { select: { id: true, name: true } },
        assignedSales: { select: { id: true, name: true } },
        _count: { select: { projects: true } },
      },
      orderBy: [{ tier: 'asc' }, { ltv: 'desc' }],
    })
    return NextResponse.json({ data: clients })
  } catch (error) {
    logger.error('GET /api/crm/clients error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
  }
}

const CreateClientSchema = z.object({
  companyName: z.string().min(1),
  contactPerson: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  tier: z.enum(['PLATINUM', 'GOLD', 'SILVER', 'BRONZE']).optional(),
  assignedCSId: z.string().optional(),
  assignedSalesId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const manageRoles = ['ADMIN', 'CLIENT_SERVICING', 'AI_CS_AGENT']
  if (!manageRoles.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body: unknown = await req.json()
    const data = CreateClientSchema.parse(body)
    const client = await prisma.client.create({ data })
    return NextResponse.json({ data: client }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    logger.error('POST /api/crm/clients error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
  }
}
