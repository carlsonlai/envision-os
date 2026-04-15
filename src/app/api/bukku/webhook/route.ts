import { NextRequest, NextResponse } from 'next/server'
import { createProjectFromInvoice } from '@/services/brief-creator'
import { type BukkuInvoice } from '@/services/bukku'
import { logger, getErrorMessage } from '@/lib/logger'

// Bukku webhook receiver for future real-time integration
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json() as { event: string; data: BukkuInvoice }

    // Verify webhook authenticity (Bukku sends a shared secret header)
    const providedSecret = req.headers.get('x-bukku-secret')
    const expectedSecret = process.env.BUKKU_WEBHOOK_SECRET

    if (expectedSecret && providedSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { event, data } = body

    if (event === 'invoice.created' || event === 'invoice.approved') {
      const invoice = data as BukkuInvoice
      await createProjectFromInvoice(invoice)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error('Bukku webhook error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
