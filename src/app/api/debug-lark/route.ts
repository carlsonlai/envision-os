import { NextResponse } from 'next/server'

// Temporary debug endpoint — no longer needed. Safe to delete this file.
export async function GET() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
