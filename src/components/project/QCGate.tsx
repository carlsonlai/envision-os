'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

interface QCChecklistItem {
  id: string
  label: string
}

const DEFAULT_CHECKLIST: QCChecklistItem[] = [
  { id: 'brief', label: 'Artwork matches brief requirements' },
  { id: 'dimensions', label: 'Correct dimensions / specifications' },
  { id: 'typography', label: 'Typography correct' },
  { id: 'colours', label: 'Colours match brand guide' },
  { id: 'spelling', label: 'No spelling errors' },
  { id: 'logo', label: 'Logo usage correct' },
  { id: 'quality', label: 'File quality acceptable' },
]

interface Props {
  itemId: string
  projectId: string
  fileVersionId: string
  onResult?: (passed: boolean) => void
}

export default function QCGate({ itemId, projectId, fileVersionId, onResult }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(DEFAULT_CHECKLIST.map((i) => [i.id, false]))
  )
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allChecked = DEFAULT_CHECKLIST.every((item) => checked[item.id])
  const hasNotes = notes.trim().length > 0

  function toggleCheck(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  async function submit(passed: boolean) {
    if (passed && !allChecked) return
    if (!passed && !hasNotes) {
      setError('Please provide notes explaining why QC failed.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/projects/${projectId}/items/${itemId}/qc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passed, notes: notes.trim() || 'QC Passed', fileVersionId }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to submit QC check')
      }

      onResult?.(passed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-200">Quality Check</h3>
        <p className="text-xs text-zinc-500 mt-0.5">
          All items must be checked before passing QC.
        </p>
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        {DEFAULT_CHECKLIST.map((item) => (
          <label
            key={item.id}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
              checked[item.id]
                ? 'bg-emerald-500/8 border border-emerald-500/20'
                : 'bg-zinc-800/30 border border-zinc-800/60 hover:border-zinc-700'
            }`}
          >
            <div
              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-all ${
                checked[item.id]
                  ? 'bg-emerald-500 border-emerald-500'
                  : 'border-zinc-600 hover:border-zinc-400'
              }`}
              onClick={() => toggleCheck(item.id)}
            >
              {checked[item.id] && (
                <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span
              className={`text-sm ${checked[item.id] ? 'text-zinc-300' : 'text-zinc-400'}`}
              onClick={() => toggleCheck(item.id)}
            >
              {item.label}
            </span>
          </label>
        ))}
      </div>

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-zinc-500">
            {DEFAULT_CHECKLIST.filter((i) => checked[i.id]).length}/{DEFAULT_CHECKLIST.length} checked
          </span>
          {allChecked && (
            <span className="text-emerald-400 font-medium">All items verified ✓</span>
          )}
        </div>
        <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{
              width: `${(DEFAULT_CHECKLIST.filter((i) => checked[i.id]).length / DEFAULT_CHECKLIST.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">
          Notes {!allChecked && <span className="text-zinc-600">(required if failing)</span>}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes for the designer or for records..."
          className="w-full rounded-lg bg-zinc-800/60 border border-zinc-700/60 text-sm text-zinc-200 placeholder-zinc-600 p-3 resize-none focus:outline-none focus:border-[#6366f1]/60 transition-colors"
          rows={3}
        />
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => submit(false)}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 hover:border-red-500/40 transition-all disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          Fail — Return to Designer
        </button>

        <button
          onClick={() => submit(true)}
          disabled={!allChecked || isSubmitting}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Pass QC
        </button>
      </div>
    </div>
  )
}
