import { NextResponse } from 'next/server'
import { getStaff } from '@/services/lark'

/**
 * GET /api/staff
 *
 * Returns the list of active staff members pulled from Lark.
 * Requires LARK_APP_ID + LARK_APP_SECRET in .env and the
 * `contact:user.base:readonly` scope enabled in the Lark app.
 *
 * On any error (e.g. credentials not configured, permission missing) returns
 * an empty array so callers can gracefully fall back to local data.
 */
export async function GET() {
  try {
    const staff = await getStaff()
    return NextResponse.json({ staff, source: 'lark' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    // Return empty list rather than 5xx — let the client fall back gracefully
    return NextResponse.json(
      { staff: [], source: 'fallback', error: message },
      { status: 200 }
    )
  }
}
