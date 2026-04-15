import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getInvoice } from '@/services/bukku'
import { createProjectFromInvoice } from '@/services/brief-creator'
import { prisma } from '@/lib/db'
import { Role } from '@prisma/client'

const ADMIN_ROLES: Role[] = [Role.ADMIN, Role.CLIENT_SERVICING]

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !ADMIN_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Check if already imported
    const existing = await prisma.project.findFirst({
      where: { bukkuInvoiceId: id },
      select: { id: true, code: true },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Already imported as project ${existing.code}`, projectId: existing.id },
        { status: 409 }
      )
    }

    const invoice = await getInvoice(id)
    const project = await createProjectFromInvoice(invoice)

    return NextResponse.json({ success: true, projectId: project.id, projectCode: project.code })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
