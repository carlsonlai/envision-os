'use client'

import { useState, FormEvent } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Eye, EyeOff, Zap } from 'lucide-react'

const ROLE_ROUTES: Record<string, string> = {
  ADMIN: '/command',
  CREATIVE_DIRECTOR: '/admin/workload',
  SENIOR_ART_DIRECTOR: '/admin/workload',
  SALES: '/sales',
  CLIENT_SERVICING: '/cs',
  JUNIOR_ART_DIRECTOR: '/designer',
  GRAPHIC_DESIGNER: '/designer',
  JUNIOR_DESIGNER: '/designer',
  DESIGNER_3D: '/designer',
  DIGITAL_MARKETING: '/designer',
}

export default function LoginPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role) {
      router.replace(ROLE_ROUTES[session.user.role] ?? '/')
    }
  }, [status, session, router])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid email or password. Please try again.')
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0f]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] px-4">
      {/* Background gradient */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-[#6366f1]/8 blur-3xl" />
        <div className="absolute -bottom-20 right-1/4 h-[400px] w-[400px] rounded-full bg-[#8b5cf6]/6 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] shadow-lg shadow-[#6366f1]/25">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Envicion OS</h1>
            <p className="text-sm text-zinc-500 mt-1">Agency management platform</p>
          </div>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/60 p-6 shadow-xl shadow-black/40 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@envicion.com"
                required
                autoComplete="email"
                className="w-full rounded-lg border border-zinc-700/60 bg-zinc-800/50 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-[#6366f1]/60 focus:outline-none focus:ring-1 focus:ring-[#6366f1]/30 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-zinc-700/60 bg-zinc-800/50 px-3 py-2.5 pr-10 text-sm text-zinc-100 placeholder-zinc-600 focus:border-[#6366f1]/60 focus:outline-none focus:ring-1 focus:ring-[#6366f1]/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gradient-to-r from-[#6366f1] to-[#7c3aed] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#6366f1]/25 hover:shadow-[#6366f1]/40 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-zinc-700">
          Envicion Software · Internal Platform
        </p>
      </div>
    </div>
  )
}
