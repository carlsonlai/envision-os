import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { pollPayments } from '@/services/bukku'
import { prisma } from '@/lib/db'
import { Role, InvoiceStatus } from '@prisma/client'
import { logger, getErrorMessage } from '@/lib/logger'

/**
 * POST /api/bukku/sync-payments
 * Syncs Bukku payments to Envision OS:
 * 1. Fetches payments from Bukku (last 90 days)
 * 2. Matches payments to local Invoices via bukkuInvoiceId
 * 3. Updates Invoice status to PAID and sets paidAt
 * 4. Recalculates Project.paidAmount from all PAID invoices
 */
export async function POST(_req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const payments = await pollPayments(since)

    const results = {
      paymentsFound: payments.length,
      invoicesUpdated: 0,
      projectsUpdated: 0,
      alreadyPaid: 0,
      unmatched: 0,
      errors: [] as string[],
    }

    for (const payment of payments) {
      try {
        // Find local invoice that matches this Bukku payment's invoice_id
        const invoice = await prisma.invoice.findFirst({
          where: { bukkuInvoiceId: payment.invoice_id },
          include: { project: true },
        })

        if (!invoice) {
          // Try matching via Project.bukkuInvoiceId
          const project = await prisma.project.findFirst({
            where: { bukkuInvoiceId: payment.invoice_id },
            include: { invoices: true },
          })

          if (!project) {
            results.unmatched++
            continue
          }

          // Update project paidAmount directly
          const newPaid = project.paidAmount + payment.amount
          await prisma.project.update({
            where: { id: project.id },
            data: { paidAmount: Math.min(newPaid, project.billedAmount || project.quotedAmount) },
          })
          results.projectsUpdated++
          continue
        }

        if (invoice.status === InvoiceStatus.PAID) {
          results.alreadyPaid++
          continue
        }

        // Update invoice to PAID
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: InvoiceStatus.PAID,
            paidAt: new Date(payment.payment_date),
          },
        })
        results.invoicesUpdated++

        // Recalculate project paidAmount from all PAID invoices
        const paidInvoices = await prisma.invoice.findMany({
          where: {
            projectId: invoice.projectId,
            status: InvoiceStatus.PAID,
          },
          select: { amount: true },
        })

        const totalPaid = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0)
        await prisma.project.update({
          where: { id: invoice.projectId },
          data: { paidAmount: totalPaid },
        })
        results.projectsUpdated++
      } catch (err) {
        const msg = getErrorMessage(err)
        results.errors.push(`Payment ${payment.id}: ${msg}`)
        logger.error('Payment sync error', { paymentId: payment.id, error: err })
      }
    }

    // Log the sync
    await prisma.bukkuSyncLog.create({
      data: {
        type: 'PAYMENT',
        bukkuId: `sync-${Date.now()}`,
        data: results,
      },
    })

    return NextResponse.json({ success: true, ...results })
  } catch (error) {
    logger.error('Bukku sync-payments error', { error })
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
