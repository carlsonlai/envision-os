/**
 * GET /api/bukku/redirect?type=quotation|invoice&no=QT-0001
 *
 * Looks up a Bukku document by its document number, then redirects the browser
 * to the Bukku web-app page for that document so the user can view the PDF.
 *
 * Bukku web-app URL: https://app.bukku.my/{BUKKU_SUBDOMAIN}/sales/{type}s/{id}
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import axios from 'axios'

const BUKKU_BASE = 'https://api.bukku.my'
const BUKKU_WEB  = 'https://app.bukku.my'

const ALLOWED_ROLES = ['ADMIN', 'CLIENT_SERVICING', 'CREATIVE_DIRECTOR', 'SENIOR_ART_DIRECTOR']

async function getHeaders(): Promise<Record<string, string>> {
  const token     = process.env.BUKKU_ACCESS_TOKEN
  const subdomain = process.env.BUKKU_SUBDOMAIN
  if (!token || !subdomain) throw new Error('Bukku credentials not configured')
  return {
    Authorization: `Bearer ${token}`,
    'Company-Subdomain': subdomain,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')   // 'quotation' | 'invoice'
  const no   = searchParams.get('no')     // e.g. 'QT-0001'

  if (!type || !no || !['quotation', 'invoice'].includes(type)) {
    return NextResponse.json({ error: 'Missing or invalid type/no' }, { status: 400 })
  }

  const subdomain = process.env.BUKKU_SUBDOMAIN
  if (!subdomain) {
    return NextResponse.json({ error: 'BUKKU_SUBDOMAIN not configured' }, { status: 500 })
  }

  try {
    const headers = await getHeaders()
    const endpoint = type === 'quotation' ? 'quotations' : 'invoices'

    // Search Bukku for a document matching the document number
    const res = await axios.get<{ data: Array<{ id: string; number: string }> }>(
      `${BUKKU_BASE}/${endpoint}`,
      {
        headers,
        params: { search: no, per_page: 10 },
      }
    )

    const docs = res.data.data ?? []
    const match = docs.find(d => d.number === no) ?? docs[0]

    if (!match) {
      // Fallback: go to the list page filtered by the document number
      const fallback = `${BUKKU_WEB}/${subdomain}/sales/${endpoint}?search=${encodeURIComponent(no)}`
      return NextResponse.redirect(fallback)
    }

    const url = `${BUKKU_WEB}/${subdomain}/sales/${endpoint}/${match.id}`
    return NextResponse.redirect(url)
  } catch {
    // If API call fails, fall back to the list page
    const fallback = `${BUKKU_WEB}/${subdomain}/sales/${type === 'quotation' ? 'quotations' : 'invoices'}?search=${encodeURIComponent(no)}`
    return NextResponse.redirect(fallback)
  }
}
