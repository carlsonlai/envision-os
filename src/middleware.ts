import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

// Server-side auth gate. Unauthenticated requests to dashboard routes are
// redirected to /login at the edge BEFORE any HTML/JS is sent. This eliminates
// the client-side `useSession()` blank-screen wait that was causing ~17s FCP.
export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role as string | undefined
    const { pathname } = req.nextUrl

    // Clients belong in /portal, not the internal dashboard.
    if (role === 'CLIENT' && !pathname.startsWith('/portal')) {
      return NextResponse.redirect(new URL('/portal', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => Boolean(token),
    },
    pages: {
      signIn: '/login',
    },
  },
)

// Match dashboard + portal routes only. Public routes (/login, /api/auth/*,
// static assets) are excluded so middleware never blocks them.
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - /login
     * - /api/auth/*  (NextAuth)
     * - /api/health
     * - /_next/static, /_next/image, /favicon.ico, /robots.txt, /sitemap.xml
     * - file extensions (images, fonts, etc.)
     */
    '/((?!login|api/auth|api/health|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)',
  ],
}
