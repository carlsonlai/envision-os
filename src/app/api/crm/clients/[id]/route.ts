import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logger, getErrorMessage } from '@/lib/logger'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const client = await prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        companyName: true,
        contactPerson: true,
        email: true,
        phone: true,
        tier: true,
        ltv: true,
        createdAt: true,
      },
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    return NextResponse.json({ data: client })
  } catch (error) {
    logger.error('GET /api/crm/clients/[id] error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()

    const allowed = ['companyName', 'contactPerson', 'phone']
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body && body[key] !== undefined) {
        data[key] = body[key] === '' ? null : body[key]
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const client = await prisma.client.update({
      where: { id },
      data,
      select: {
        id: true,
        companyName: true,
        contactPerson: true,
        email: true,
        phone: true,
      },
    })

    return NextResponse.json({ data: client })
  } catch (error) {
    logger.error('PATCH /api/crm/clients/[id] error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 })
  }
}
