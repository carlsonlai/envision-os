'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { Zap, LogOut, ExternalLink } from 'lucide-react'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fafafa]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Minimal top nav */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-zinc-200/80 bg-white/90 backdrop-blur-sm px-6 shadow-sm">
        <Link href="/portal" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#6366f1] to-[#8b5cf6]">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-zinc-900">Envision</span>
          <span className="text-xs text-zinc-400 hidden sm:block">Client Portal</span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 hidden sm:block">
            {session.user.name}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 border border-zinc-200 transition-all"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </header>

      {/* Page content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="mt-16 border-t border-zinc-200 py-6 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-zinc-400">
          <span>Powered by Envision OS</span>
          <a
            href="mailto:hello@envision.com"
            className="flex items-center gap-1 hover:text-zinc-600 transition-colors"
          >
            Contact us <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </footer>
    </div>
  )
}
