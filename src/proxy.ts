import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// ── Protected dashboard route prefixes ────────────────────────────────────────
// Only page routes listed here trigger the server-side auth redirect. API
// routes, webhooks, crons, and /login are intentionally excluded — each
// enforces its own auth, and redirecting them to /login would break them.
const PROTECTED_PREFIXES: readonly string[] = [
  '/command',
  '/admin',
  '/cd',
  '/cs',
  '/crm',
  '/sales',
  '/designer',
  '/kpi',
  '/hr',
  '/social-hub',
  '/media',
  '/calendar',
  '/my',
  '/ai-sales',
  '/ai-cs',
  '/portal',
]

function isProtectedPage(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

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
export async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl

  // 1. Rate limiting for /api/* (unchanged)
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

  // 2. Server-side auth gate for dashboard page routes. This replaces the
  //    client-side `useSession()` spinner in (dashboard)/layout.tsx which was
  //    causing ~17s FCP. Unauthenticated users are redirected to /login at
  //    the edge before any HTML is rendered.
  if (isProtectedPage(pathname)) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (!token) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return addSecurityHeaders(NextResponse.redirect(loginUrl))
    }

    // Clients belong in /portal, not in the internal dashboard.
    const role = typeof token.role === 'string' ? token.role : undefined
    if (role === 'CLIENT' && !pathname.startsWith('/portal')) {
      return addSecurityHeaders(
        NextResponse.redirect(new URL('/portal', req.url)),
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
