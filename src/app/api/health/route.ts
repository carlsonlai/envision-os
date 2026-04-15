import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const start = Date.now()

  try {
    // Verify DB connectivity with a lightweight query
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.0.0',
      db: 'connected',
      latencyMs: Date.now() - start,
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        db: 'unreachable',
        error: error instanceof Error ? error.message : 'Unknown error',
        latencyMs: Date.now() - start,
      },
      { status: 503 }
    )
  }
}
