'use client'

import { use, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { ArrowLeft, Send, CheckCircle2, Loader2, Info } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { AnnotationData } from '@/services/annotation'

// Dynamic import for canvas (requires browser)
const AnnotationCanvas = dynamic(
  () => import('@/components/annotation/AnnotationCanvas'),
  { ssr: false, loading: () => <div className="flex-1 flex items-center justify-center bg-zinc-900"><div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" /></div> }
)

interface FileVersion {
  id: string
  version: number
  filename: string
  url: string
}

interface DeliverableItem {
  id: string
  itemType: string
  description: string | null
  quantity: number
  status: string
  revisionCount: number
  revisionLimit: number
  fileVersions: FileVersion[]
}

type ViewMode = 'annotate' | 'feedback' | 'success'

const ITEM_TYPE_LABELS: Record<string, string> = {
  BANNER: 'Banner',
  BROCHURE: 'Brochure',
  LOGO: 'Logo',
  SOCIAL: 'Social Media',
  PRINT: 'Print',
  THREE_D: '3D',
  VIDEO: 'Video',
  OTHER: 'Other',
}

export default function AnnotatePage({
  params,
}: {
  params: Promise<{ projectId: string; itemId: string }>
}) {
  const { projectId, itemId } = use(params)
  const searchParams = useSearchParams()
  const isApprove = searchParams.get('approve') === '1'
  const { data: session } = useSession()
  const router = useRouter()

  const [item, setItem] = useState<DeliverableItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<ViewMode>(isApprove ? 'feedback' : 'annotate')
  const [annotationData, setAnnotationData] = useState<AnnotationData | null>(null)
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/projects/${projectId}/items`)
        if (!res.ok) throw new Error('Failed to load items')
        const data = await res.json()
        const found = (data.data ?? []).find((i: DeliverableItem) => i.id === itemId)
        if (!found) throw new Error('Item not found')
        setItem(found)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load item')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [projectId, itemId])

  function handleAnnotationSave(data: AnnotationData) {
    setAnnotationData(data)
    setMode('feedback')
  }

  async function handleSubmitFeedback() {
    if (!feedback.trim() && !isApprove) {
      setSubmitError('Please describe the changes you need.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch(`/api/projects/${projectId}/items/${itemId}/revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback: feedback.trim() || 'Client approved this version.',
          annotationData,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.limitReached) {
          setSubmitError(
            `You have used all ${data.revisionLimit} revisions included. Your account manager will be in touch about next steps.`
          )
          return
        }
        throw new Error(data.error ?? 'Failed to submit feedback')
      }

      setMode('success')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleApproveDirectly() {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch(`/api/projects/${projectId}/items/${itemId}/client-confirm`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to approve')
      }

      setMode('success')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0f]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a0f] text-zinc-400">
        <p>{error ?? 'Item not found'}</p>
        <Link href={`/portal/${projectId}`} className="mt-4 text-[#818cf8] hover:underline text-sm">
          Back to project
        </Link>
      </div>
    )
  }

  const latestVersion = item.fileVersions[0]

  // Success screen
  if (mode === 'success') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#fafafa] px-6">
        <div className="max-w-md w-full text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 mx-auto mb-6">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mb-2">
            {isApprove ? 'Artwork Approved!' : 'Feedback Submitted!'}
          </h2>
          <p className="text-sm text-zinc-500 mb-8">
            {isApprove
              ? 'Your approval has been recorded. Your account manager will be notified.'
              : 'Your feedback has been forwarded to your account manager. They will review it and get back to you with an update.'}
          </p>
          <Link
            href={`/portal/${projectId}`}
            className="inline-flex items-center gap-2 rounded-xl bg-[#4f46e5] px-6 py-3 text-sm font-semibold text-white hover:bg-[#4338ca] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Project
          </Link>
        </div>
      </div>
    )
  }

  // Feedback / Approve confirmation screen
  if (mode === 'feedback' || isApprove) {
    return (
      <div className="flex flex-col h-screen bg-[#fafafa]">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-200 bg-white sticky top-0 z-10">
          {mode === 'annotate' || !isApprove ? (
            <button
              onClick={() => setMode('annotate')}
              className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to canvas
            </button>
          ) : (
            <Link
              href={`/portal/${projectId}`}
              className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to project
            </Link>
          )}
          <span className="text-sm font-medium text-zinc-900">
            {ITEM_TYPE_LABELS[item.itemType] ?? item.itemType}
            {item.description && ` — ${item.description}`}
          </span>
        </div>

        <div className="flex-1 overflow-auto px-6 py-8">
          <div className="max-w-lg mx-auto space-y-6">
            {/* Annotation preview summary */}
            {annotationData && (
              <div className="rounded-xl bg-[#eef2ff] border border-[#c7d2fe] p-4">
                <p className="text-sm font-medium text-[#4f46e5]">
                  {annotationData.objects.length > 0 || annotationData.comments.length > 0 ? (
                    <>
                      {annotationData.objects.length} drawing{annotationData.objects.length !== 1 ? 's' : ''} +{' '}
                      {annotationData.comments.length} comment pin{annotationData.comments.length !== 1 ? 's' : ''} saved
                    </>
                  ) : (
                    'No annotations made — text feedback only'
                  )}
                </p>
              </div>
            )}

            {/* Info notice */}
            <div className="flex items-start gap-2 rounded-xl bg-zinc-50 border border-zinc-200 p-4">
              <Info className="h-4 w-4 text-zinc-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-zinc-500">
                Your feedback will be reviewed by your account manager before being passed to the design team. You will not communicate directly with the designer.
              </p>
            </div>

            {/* Approve directly option */}
            {isApprove && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                <h3 className="text-base font-semibold text-emerald-800 mb-2">
                  Approve This Version?
                </h3>
                <p className="text-sm text-emerald-700 mb-4">
                  By approving, you confirm that this artwork version is correct and ready to proceed to Final Artwork.
                </p>
                <button
                  onClick={handleApproveDirectly}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 transition-all disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Confirm Approval
                </button>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-px bg-emerald-200" />
                  <span className="text-xs text-emerald-500">or provide feedback instead</span>
                  <div className="flex-1 h-px bg-emerald-200" />
                </div>
              </div>
            )}

            {/* Feedback text */}
            <div>
              <label className="block text-sm font-semibold text-zinc-800 mb-2">
                {isApprove ? 'Optional feedback or notes' : 'Describe the changes needed'}
                {!isApprove && <span className="text-red-500 ml-1">*</span>}
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={
                  isApprove
                    ? 'Any final comments or notes (optional)...'
                    : 'Be specific about what needs to change. E.g. "Make the headline larger", "Move the logo to the top right", "Change the background colour to navy blue"...'
                }
                className="w-full rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-800 placeholder-zinc-400 resize-none focus:outline-none focus:border-[#6366f1] transition-colors shadow-sm"
                rows={5}
              />
              <p className="text-xs text-zinc-400 mt-1.5">
                Revisions used: {item.revisionCount}/{item.revisionLimit}
              </p>
            </div>

            {submitError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-600">{submitError}</p>
              </div>
            )}

            {!isApprove && (
              <button
                onClick={handleSubmitFeedback}
                disabled={isSubmitting || !feedback.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 py-3 text-sm font-semibold text-white hover:bg-[#4338ca] transition-all disabled:opacity-50 shadow-lg shadow-[#4f46e5]/30"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Submit Feedback
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Annotation canvas mode
  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-[#0d0d14] sticky top-0 z-10">
        <Link
          href={`/portal/${projectId}`}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-200 truncate">
            {ITEM_TYPE_LABELS[item.itemType] ?? item.itemType}
            {item.description && ` — ${item.description}`}
          </p>
          <p className="text-xs text-zinc-600">
            {latestVersion ? `v${latestVersion.version} — ${latestVersion.filename}` : 'No version uploaded'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-zinc-800/60 border border-zinc-700/60 px-2.5 py-1 text-xs text-zinc-400">
          <span>{item.revisionCount}/{item.revisionLimit} revisions</span>
        </div>
      </div>

      {latestVersion ? (
        <div className="flex-1 overflow-hidden">
          <AnnotationCanvas
            imageUrl={latestVersion.url}
            existingAnnotations={null}
            readOnly={false}
            onSave={handleAnnotationSave}
            onCancel={() => router.push(`/portal/${projectId}`)}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-zinc-900">
          <div className="text-center">
            <p className="text-zinc-500 text-sm">No file uploaded yet</p>
            <Link
              href={`/portal/${projectId}`}
              className="mt-3 inline-block text-[#818cf8] hover:underline text-sm"
            >
              Back to project
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
