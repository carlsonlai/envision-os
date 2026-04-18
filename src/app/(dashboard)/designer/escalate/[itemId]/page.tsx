/**
 * /designer/escalate/[itemId]?projectId=...
 *
 * Replaces the old alert() "Flag Issue" dialog on the designer queue. Designer
 * submits a structured escalation (category + description + optional blocking
 * flag). The API writes an AuditLog, fires Pusher events to CS / Creative /
 * project channels, and sends a Lark nudge to CS + CREATIVE groups.
 */

'use client'

import { use, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, Flag, Loader2 } from 'lucide-react'

const CATEGORIES = [
  { id: 'BLOCKED_BRIEF', label: 'Brief unclear / incomplete', hint: 'Missing requirements, unclear scope, or contradicting instructions.' },
  { id: 'MISSING_ASSETS', label: 'Missing assets', hint: 'Logos, copy, reference artwork, or source files not supplied.' },
  { id: 'UNREALISTIC_DEADLINE', label: 'Deadline vs scope mismatch', hint: 'Scope cannot be delivered within the stated deadline.' },
  { id: 'CLIENT_CHANGE', label: 'Client changed scope mid-job', hint: 'New direction / revisions beyond the original brief.' },
  { id: 'OTHER', label: 'Other', hint: 'Anything else blocking progress.' },
] as const

type CategoryId = (typeof CATEGORIES)[number]['id']

export default function DesignerEscalatePage({
  params,
}: {
  params: Promise<{ itemId: string }>
}) {
  const { itemId } = use(params)
  const searchParams = useSearchParams()
  const router = useRouter()
  const projectId = searchParams.get('projectId') ?? ''

  const [category, setCategory] = useState<CategoryId>('BLOCKED_BRIEF')
  const [description, setDescription] = useState('')
  const [blocking, setBlocking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)

    if (!projectId) {
      setError('Missing project ID — please open this page from the designer queue.')
      return
    }
    if (description.trim().length < 5) {
      setError('Please describe the issue (at least 5 characters).')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(
        `/api/projects/${projectId}/items/${itemId}/escalate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, description, blocking }),
        }
      )
      if (!res.ok) {
        const data: { error?: string } = await res.json().catch(() => ({}))
        setError(data.error ?? 'Failed to raise escalation — please retry.')
        return
      }
      setSuccess(true)
      setTimeout(() => router.push('/designer'), 1200)
    } catch {
      setError('Network error — please check your connection and retry.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
          <Flag className="h-5 w-5" />
        </div>
        <h1 className="text-lg font-semibold text-zinc-100">Escalation raised</h1>
        <p className="mt-1 text-sm text-zinc-500">
          CS and Creative have been notified. Returning to your queue...
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 py-6">
      <Link
        href="/designer"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-[#818cf8] transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to queue
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Raise escalation</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Flag a blocker to CS and Creative Director. This is logged for audit —
          use it when something is actually stopping work, not for general
          questions.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        {/* Category */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">
            What&apos;s blocking you?
          </label>
          <div className="space-y-1.5">
            {CATEGORIES.map((c) => (
              <label
                key={c.id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  category === c.id
                    ? 'border-[#6366f1]/50 bg-[#6366f1]/5'
                    : 'border-zinc-800/60 bg-zinc-900/30 hover:border-zinc-700'
                }`}
              >
                <input
                  type="radio"
                  name="category"
                  value={c.id}
                  checked={category === c.id}
                  onChange={() => setCategory(c.id)}
                  className="mt-1 h-3.5 w-3.5 accent-[#6366f1]"
                />
                <div className="space-y-0.5">
                  <div className="text-sm font-medium text-zinc-200">{c.label}</div>
                  <div className="text-[11px] text-zinc-500">{c.hint}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label
            htmlFor="description"
            className="text-xs font-semibold text-zinc-300 uppercase tracking-wide"
          >
            Describe the issue
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={5}
            placeholder="What do you need from CS / Creative to unblock this? Be specific — this goes straight into the audit log."
            className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[#6366f1]/50 focus:outline-none focus:ring-1 focus:ring-[#6366f1]/30"
            required
          />
          <div className="text-right text-[10px] text-zinc-600">
            {description.length}/1000
          </div>
        </div>

        {/* Blocking toggle */}
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-3 transition-colors hover:border-red-800/40">
          <input
            type="checkbox"
            checked={blocking}
            onChange={(e) => setBlocking(e.target.checked)}
            className="mt-1 h-3.5 w-3.5 accent-red-500"
          />
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-200">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
              This is fully blocking — I cannot proceed
            </div>
            <div className="text-[11px] text-zinc-500">
              Marks the Lark notification as urgent. Use sparingly.
            </div>
          </div>
        </label>

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Link
            href="/designer"
            className="rounded-md px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Raising...
              </>
            ) : (
              <>
                <Flag className="h-3.5 w-3.5" />
                Raise escalation
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
