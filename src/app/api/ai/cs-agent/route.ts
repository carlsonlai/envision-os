import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  draftClientUpdate,
  handleClientFeedback,
  analyseClientSatisfaction,
  draftInvoiceFollowUp,
} from '@/services/ai'
import { prisma } from '@/lib/prisma-extended'
import { logger, getErrorMessage } from '@/lib/logger'

const ALLOWED_ROLES = ['ADMIN', 'CLIENT_SERVICING', 'AI_CS_AGENT']

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = (await req.json()) as Record<string, unknown>
    const action = body.action as string

    async function logAction(actionType: string, entityId?: string, output?: string) {
      try {
        await prisma.aIAgentLog.create({
          data: {
            agentRole: session!.user.role as never,
            actionType: actionType as never,
            entityId,
            entityType: 'Project',
            output: output?.slice(0, 500),
            success: true,
          },
        })
      } catch {
        // Non-critical
      }
    }

    switch (action) {
      case 'DRAFT_CLIENT_UPDATE': {
        const result = await draftClientUpdate({
          clientName: (body.clientName as string) ?? 'Client',
          projectCode: (body.projectCode as string) ?? 'PRJ',
          currentStatus: (body.currentStatus as string) ?? 'ONGOING',
          completedItems: (body.completedItems as string[]) ?? [],
          pendingItems: (body.pendingItems as string[]) ?? [],
          deadline: (body.deadline as string) ?? 'TBD',
          issues: (body.extraContext as string) ?? '',
        })
        await logAction('CLIENT_UPDATE_DRAFTED', body.projectId as string, result.progressSummary)
        return NextResponse.json({ data: { subject: result.subject, message: `${result.greeting}\n\n${result.progressSummary}\n\nNext step: ${result.nextMilestone}\n\n${result.actionRequired !== 'NONE' ? `Action needed: ${result.actionRequired}\n\n` : ''}${result.closing}` } })
      }

      case 'DRAFT_FEEDBACK_RESPONSE': {
        const result = await handleClientFeedback({
          clientName: (body.clientName as string) ?? 'Client',
          feedback: (body.feedback as string) ?? '',
          projectCode: (body.projectCode as string) ?? 'PRJ',
          revisionCount: (body.revisionCount as number) ?? 0,
          revisionLimit: (body.revisionLimit as number) ?? 2,
        })
        await logAction('CLIENT_FEEDBACK_HANDLED', body.projectId as string, result.response)
        return NextResponse.json({ data: { subject: `Re: ${body.projectCode} Feedback`, message: result.response, internalNote: result.internalNote, designerBrief: result.designerBrief, escalate: result.escalate } })
      }

      case 'ANALYSE_SATISFACTION': {
        const result = await analyseClientSatisfaction({
          clientName: (body.clientName as string) ?? 'Client',
          recentMessages: (body.recentMessages as string[]) ?? [],
          revisionCount: (body.revisionCount as number) ?? 0,
          projectDaysOverdue: (body.projectDaysOverdue as number) ?? 0,
          lastContactDays: (body.lastContactDays as number) ?? 7,
        })
        await logAction('SATISFACTION_DETECTED', body.clientId as string, JSON.stringify(result))
        return NextResponse.json({ data: result })
      }

      case 'DRAFT_INVOICE_FOLLOWUP': {
        const result = await draftInvoiceFollowUp({
          clientName: (body.clientName as string) ?? 'Client',
          invoiceAmount: (body.invoiceAmount as string) ?? 'RM 5,000',
          daysOverdue: (body.daysOverdue as number) ?? 7,
          invoiceNumber: (body.invoiceNumber as string) ?? 'INV-001',
          previousFollowUps: (body.previousFollowUps as number) ?? 0,
        })
        await logAction('INVOICE_FOLLOWUP_DRAFTED', body.invoiceId as string, result.message)
        return NextResponse.json({ data: { subject: result.subject, message: result.message, tone: result.tone, escalate: result.escalate } })
      }

      case 'DRAFT_CHECK_IN': {
        const result = await draftClientUpdate({
          clientName: (body.clientName as string) ?? 'Client',
          projectCode: (body.projectCode as string) ?? 'PRJ',
          currentStatus: 'ONGOING',
          completedItems: [],
          pendingItems: [],
          deadline: (body.deadline as string) ?? 'TBD',
          issues: (body.extraContext as string) ?? 'Regular check-in',
        })
        return NextResponse.json({ data: { subject: `Checking in on ${body.projectCode}`, message: `${result.greeting}\n\nJust wanted to check in and see how things are going from your side. ${result.progressSummary}\n\n${result.closing}` } })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    logger.error('AI CS Agent error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'AI processing failed' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const logs = await prisma.aIAgentLog.findMany({
      where: { agentRole: { in: ['AI_CS_AGENT', 'CLIENT_SERVICING'] as never[] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json({ data: logs })
  } catch (error) {
    logger.error('AI CS Agent logs error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }
}
