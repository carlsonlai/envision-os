import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        {/* Glowing 404 */}
        <div className="relative mb-8">
          <p className="text-[120px] font-black text-zinc-900 leading-none select-none">
            404
          </p>
          <p className="absolute inset-0 text-[120px] font-black leading-none select-none
             text-transparent bg-clip-text bg-gradient-to-b from-[#6366f1] to-[#6366f1]/10
             blur-[2px]">
            404
          </p>
        </div>

        <h1 className="text-xl font-semibold text-zinc-100 mb-2">
          Page not found
        </h1>
        <p className="text-sm text-zinc-500 mb-8 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or you don&apos;t have
          permission to view it.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link
            href="/command"
            className="inline-flex items-center gap-2 rounded-xl bg-[#6366f1] hover:bg-[#5558e3] px-5 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 px-5 py-2.5 text-sm font-medium text-zinc-300 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
