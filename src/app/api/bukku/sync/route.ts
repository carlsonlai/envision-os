import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { pollNewInvoices, pollQuotations } from '@/services/bukku'
import { createProjectFromInvoice, createProjectFromQuotation } from '@/services/brief-creator'
import { prisma } from '@/lib/db'
import { Role } from '@prisma/client'

// POST /api/bukku/sync — manually trigger a full Bukku sync
export async function POST(_req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // last 30 days

    const results = {
      invoicesImported: 0,
      quotationsImported: 0,
      errors: [] as string[],
    }

    // Sync invoices
    try {
      const invoices = await pollNewInvoices(since)
      for (const invoice of invoices) {
        const existing = await prisma.project.findFirst({
          where: { bukkuInvoiceId: invoice.id },
        })
        if (!existing) {
          try {
            await createProjectFromInvoice(invoice)
            results.invoicesImported++
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            results.errors.push(`Invoice ${invoice.id}: ${msg}`)
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.errors.push(`Invoice poll failed: ${msg}`)
    }

    // Sync accepted quotations
    try {
      const quotations = await pollQuotations(since)
      const acceptedQuotations = quotations.filter((q) =>
        ['accepted', 'approved', 'won'].includes(q.status.toLowerCase())
      )

      for (const quotation of acceptedQuotations) {
        const existing = await prisma.project.findFirst({
          where: { bukkuQuoteId: quotation.id },
        })
        if (!existing) {
          try {
            await createProjectFromQuotation(quotation)
            results.quotationsImported++
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            results.errors.push(`Quotation ${quotation.id}: ${msg}`)
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.errors.push(`Quotation poll failed: ${msg}`)
    }

    return NextResponse.json({ success: true, ...results })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// GET /api/bukku/sync — return last sync timestamps
export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [lastInvoiceSync, lastQuoteSync, lastPaymentSync] = await Promise.all([
      prisma.bukkuSyncLog.findFirst({
        where: { type: 'INVOICE' },
        orderBy: { lastSyncedAt: 'desc' },
        select: { lastSyncedAt: true },
      }),
      prisma.bukkuSyncLog.findFirst({
        where: { type: 'QUOTE' },
        orderBy: { lastSyncedAt: 'desc' },
        select: { lastSyncedAt: true },
      }),
      prisma.bukkuSyncLog.findFirst({
        where: { type: 'PAYMENT' },
        orderBy: { lastSyncedAt: 'desc' },
        select: { lastSyncedAt: true },
      }),
    ])

    return NextResponse.json({
      success: true,
      lastInvoiceSync: lastInvoiceSync?.lastSyncedAt ?? null,
      lastQuoteSync: lastQuoteSync?.lastSyncedAt ?? null,
      lastPaymentSync: lastPaymentSync?.lastSyncedAt ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
