import { NextRequest, NextResponse } from 'next/server'

// ── In-memory rate limiter ────────────────────────────────────────────────────
// For multi-server deployments swap this for Upstash Redis.
const buckets = new Map<string, { count: number; resetAt: number }>()

const RATE_LIMIT_API   = 120  // requests per window for general API
const RATE_LIMIT_AUTH  = 10   // stricter limit for auth endpoints
const WINDOW_MS        = 60_000 // 1 minute window

function clientKey(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

function isRateLimited(key: string, limit: number): boolean {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }

  bucket.count += 1
  return bucket.count > limit
}

// Periodically prune expired buckets to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, bucket] of buckets) {
      if (now > bucket.resetAt) buckets.delete(key)
    }
  }, WINDOW_MS)
}

// ── Security headers ──────────────────────────────────────────────────────────
function addSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'SAMEORIGIN')
  res.headers.set('X-XSS-Protection', '1; mode=block')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (process.env.NODE_ENV === 'production') {
    res.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    )
  }
  return res
}

// ── Proxy ────────────────────────────────────────────────────────────────
export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/api/')) {
    const key = clientKey(req)
    const isAuth = pathname.startsWith('/api/auth')
    const limit  = isAuth ? RATE_LIMIT_AUTH : RATE_LIMIT_API

    if (isRateLimited(key, limit)) {
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests. Please wait a moment.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
          },
        }
      )
    }
  }

  const res = NextResponse.next()
  return addSecurityHeaders(res)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}
