/**
 * GET /api/bukku/verify-jobs
 *
 * Fetches ALL quotations and invoices from Bukku (all pages) with full line
 * items. Used by Job Track in two ways:
 *
 *  1. "Live Bukku" mode — display data directly from Bukku as the source of
 *     truth (quotation no, invoice no, amount, items list, quantities).
 *
 *  2. Verification badges — cross-check local DB records against live Bukku
 *     data to flag missing or mismatched numbers.
 *
 * Response shape:
 *   {
 *     quotations: BukkuFullDoc[]
 *     invoices:   BukkuFullDoc[]
 *     quoteMap:   Record<quoteNo,   { amount, status, contact }>
 *     invoiceMap: Record<invoiceNo, { amount, status, contact, dueDate }>
 *   }
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import axios from 'axios'

const BUKKU_BASE = 'https://api.bukku.my'
const ALLOWED_ROLES = ['ADMIN', 'CLIENT_SERVICING', 'SALES']

export interface BukkuLineItemFull {
  description: string
  quantity: number
  unit_price: number
  amount: number
  item_code?: string
}

export interface BukkuFullDoc {
  id: string
  number: string
  contact_name: string
  date: string
  status: string
  total_amount: number
  due_date?: string
  expiry_date?: string
  line_items: BukkuLineItemFull[]
}

interface BukkuListResponse {
  data?: BukkuFullDoc[]
  meta?: { last_page?: number }
}

async function getHeaders(): Promise<Record<string, string>> {
  const token = process.env.BUKKU_ACCESS_TOKEN
  const subdomain = process.env.BUKKU_SUBDOMAIN
  if (!token || !subdomain) throw new Error('Bukku credentials not configured')
  return {
    Authorization: `Bearer ${token}`,
    'Company-Subdomain': subdomain,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

async function fetchAllDocs(endpoint: string, headers: Record<string, string>): Promise<BukkuFullDoc[]> {
  const all: BukkuFullDoc[] = []
  let page = 1
  for (;;) {
    const res = await axios.get<BukkuListResponse>(
      `${BUKKU_BASE}/${endpoint}`,
      { headers, params: { per_page: 100, page } }
    )
    const items = res.data.data ?? []
    all.push(...items)
    if (page >= (res.data.meta?.last_page ?? 1)) break
    page++
  }
  return all
}

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const headers = await getHeaders()

    const [quotations, invoices] = await Promise.all([
      fetchAllDocs('quotations', headers),
      fetchAllDocs('invoices', headers),
    ])

    // Build flat lookup maps for fast verification
    const quoteMap: Record<string, { amount: number; status: string; contact: string }> = {}
    for (const q of quotations) {
      quoteMap[q.number] = { amount: q.total_amount, status: q.status, contact: q.contact_name }
    }

    const invoiceMap: Record<string, { amount: number; status: string; contact: string; dueDate: string | null }> = {}
    for (const inv of invoices) {
      invoiceMap[inv.number] = {
        amount: inv.total_amount,
        status: inv.status,
        contact: inv.contact_name,
        dueDate: inv.due_date ?? null,
      }
    }

    return NextResponse.json({
      success: true,
      data: { quotations, invoices, quoteMap, invoiceMap },
      counts: { quotes: quotations.length, invoices: invoices.length },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
