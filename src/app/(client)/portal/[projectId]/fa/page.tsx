'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, FileSignature, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react'

interface Project {
  id: string
  code: string
  status: string
  faSignOffs?: Array<{ pdfUrl: string; signedAt: string | null }>
}

const DISCLAIMER_TEXT = `By signing off this Final Artwork (FA) package, you confirm that:

1. You have reviewed ALL artwork included in this FA package in full detail.
2. All artwork dimensions, typography, colour values, and specifications have been verified.
3. All brand guidelines have been correctly applied.
4. All copy, text, and messaging have been reviewed and approved by the appropriate stakeholders in your organisation.
5. All imagery, logos, and graphical elements are approved for use.
6. You accept that any amendments required after this FA sign-off will constitute additional work subject to additional charges.
7. Envicion Software shall bear no responsibility for errors discovered after this sign-off has been completed.
8. This signed FA constitutes a legally binding acceptance of the artwork as presented.`

export default function FASignOffPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = use(params)
  const router = useRouter()

  const [project, setProject] = useState<Project | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [checked1, setChecked1] = useState(false)
  const [checked2, setChecked2] = useState(false)
  const [clientName, setClientName] = useState('')

  const canSign = checked1 && checked2 && clientName.trim().length > 0

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        if (!res.ok) throw new Error('Project not found')
        const data = await res.json()
        const proj = data.data as Project
        setProject(proj)

        // Check if FA PDF already exists
        if (proj.faSignOffs && proj.faSignOffs.length > 0 && proj.faSignOffs[0].pdfUrl) {
          setPdfUrl(proj.faSignOffs[0].pdfUrl)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load project')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [projectId])

  async function handleGenerateFA() {
    setIsGenerating(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/fa`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to generate FA')
      }
      const data = await res.json()
      setPdfUrl(data.data.pdfUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate FA PDF')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleSignOff() {
    if (!canSign) return

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/projects/${projectId}/fa/signoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: clientName.trim(),
          disclaimerAccepted: true,
          bothPartiesChecked: true,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to sign off')
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
      </div>
    )
  }

  // Success screen
  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#fafafa] px-6">
        <div className="max-w-md w-full text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-3">Sign-Off Complete</h1>
          <p className="text-sm text-zinc-500 mb-2">
            Thank you, <strong>{clientName}</strong>. Your Final Artwork sign-off has been recorded.
          </p>
          <p className="text-sm text-zinc-500 mb-8">
            A confirmation email has been sent to you. Your account manager will be in touch shortly regarding the final invoice.
          </p>
          <Link
            href={`/portal/${projectId}`}
            className="inline-flex items-center gap-2 rounded-xl bg-[#4f46e5] px-6 py-3 text-sm font-semibold text-white hover:bg-[#4338ca] transition-colors"
          >
            Return to Project
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Back */}
      <Link
        href={`/portal/${projectId}`}
        className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to project
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Final Artwork Sign-Off</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Project {project?.code} — Please review all artwork before signing.
        </p>
      </div>

      {/* Step 1: View PDF */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 mb-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 mb-1">Step 1: Review the FA Package</h2>
            <p className="text-sm text-zinc-500">
              View and download the complete Final Artwork PDF before signing.
            </p>
          </div>
          {pdfUrl && (
            <a
              href={pdfUrl}
              download
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 transition-all flex-shrink-0"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </a>
          )}
        </div>

        {pdfUrl ? (
          <iframe
            src={pdfUrl}
            className="w-full rounded-xl border border-zinc-200"
            style={{ height: '60vh' }}
            title="Final Artwork PDF"
          />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-12 text-center">
            <FileSignature className="h-10 w-10 text-zinc-300 mb-3" />
            <p className="text-sm text-zinc-500 mb-4">FA PDF not generated yet</p>
            <button
              onClick={handleGenerateFA}
              disabled={isGenerating}
              className="flex items-center gap-2 rounded-lg bg-[#4f46e5] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4338ca] transition-all disabled:opacity-60"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSignature className="h-4 w-4" />
              )}
              {isGenerating ? 'Generating...' : 'Generate FA PDF'}
            </button>
          </div>
        )}
      </div>

      {/* Step 2: Disclaimer */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 mb-6">
        <h2 className="text-base font-semibold text-amber-900 mb-3">Step 2: Read the Disclaimer</h2>
        <div className="rounded-xl bg-white border border-amber-100 p-4">
          <pre className="text-xs text-zinc-600 leading-relaxed whitespace-pre-wrap font-sans">
            {DISCLAIMER_TEXT}
          </pre>
        </div>
      </div>

      {/* Step 3: Sign */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-5">
        <h2 className="text-base font-semibold text-zinc-900">Step 3: Confirm &amp; Sign Off</h2>

        {/* Checkboxes */}
        <div className="space-y-3">
          <label
            className={`flex items-start gap-3 rounded-xl p-4 cursor-pointer transition-colors ${
              checked1 ? 'bg-emerald-50 border border-emerald-200' : 'bg-zinc-50 border border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <div
              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 mt-0.5 transition-all ${
                checked1 ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-300'
              }`}
              onClick={() => setChecked1((v) => !v)}
            >
              {checked1 && (
                <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className="text-sm text-zinc-700" onClick={() => setChecked1((v) => !v)}>
              I have reviewed <strong>ALL artwork</strong> in this Final Artwork package in full
            </span>
          </label>

          <label
            className={`flex items-start gap-3 rounded-xl p-4 cursor-pointer transition-colors ${
              checked2 ? 'bg-emerald-50 border border-emerald-200' : 'bg-zinc-50 border border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <div
              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 mt-0.5 transition-all ${
                checked2 ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-300'
              }`}
              onClick={() => setChecked2((v) => !v)}
            >
              {checked2 && (
                <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className="text-sm text-zinc-700" onClick={() => setChecked2((v) => !v)}>
              I confirm that all artwork has been <strong>checked by my organisation</strong> and we are satisfied with the final output
            </span>
          </label>
        </div>

        {/* Name input */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">
            Your full name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Enter your full name to sign"
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#6366f1] focus:bg-white transition-all"
          />
        </div>

        {/* Readiness indicator */}
        {!canSign && (
          <div className="flex items-center gap-2 rounded-lg bg-zinc-50 border border-zinc-200 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-zinc-400 flex-shrink-0" />
            <p className="text-xs text-zinc-500">
              {!checked1 || !checked2
                ? 'Please check both confirmation boxes above'
                : 'Please enter your full name to sign'}
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Sign button */}
        <button
          onClick={handleSignOff}
          disabled={!canSign || isSubmitting || !pdfUrl}
          className="w-full flex items-center justify-center gap-2 rounded-xl px-6 py-4 text-sm font-bold transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          style={{
            background: canSign && pdfUrl ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : undefined,
            color: 'white',
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Processing sign-off...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5" />
              Sign Off Final Artwork
            </>
          )}
        </button>

        {!pdfUrl && (
          <p className="text-xs text-center text-zinc-400">
            Generate the FA PDF above before signing
          </p>
        )}
      </div>
    </div>
  )
}
