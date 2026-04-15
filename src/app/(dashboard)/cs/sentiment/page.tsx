'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * /cs/sentiment has been merged into /ai-cs/clients.
 * This page redirects automatically.
 */
export default function SentimentRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/ai-cs/clients')
  }, [router])

  return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
        <p className="text-sm text-zinc-500">Redirecting to Client Health...</p>
      </div>
    </div>
  )
}
