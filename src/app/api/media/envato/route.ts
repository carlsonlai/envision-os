import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const ENVATO_TOKEN = process.env.ENVATO_TOKEN
const BASE = 'https://api.envato.com'

const ALLOWED_ROLES = ['ADMIN', 'DIGITAL_MARKETING', 'CREATIVE_DIRECTOR', 'SENIOR_ART_DIRECTOR']

// GET /api/media/envato?q=query&site=videohive.net&page=1
// site options: videohive.net | audiojungle.net | graphicriver.net | themeforest.net | photodune.net
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!ENVATO_TOKEN) {
    return NextResponse.json({ error: 'ENVATO_TOKEN not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const site = searchParams.get('site') ?? 'videohive.net'
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const from = (page - 1) * 20

  const params = new URLSearchParams({
    term: q,
    site,
    from: String(from),
    page_size: '20',
    sort_by: 'rating',
    sort_direction: 'desc',
  })

  const res = await fetch(`${BASE}/v1/discovery/search/search/item?${params.toString()}`, {
    headers: { Authorization: `Bearer ${ENVATO_TOKEN}` },
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: `Envato error: ${res.status}`, detail: text }, { status: res.status })
  }

  const data: unknown = await res.json()
  return NextResponse.json({ success: true, data })
}
