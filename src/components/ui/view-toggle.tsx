'use client'

import { LayoutGrid, List } from 'lucide-react'

export type ViewMode = 'bento' | 'list'

interface ViewToggleProps {
  view: ViewMode
  onChange: (v: ViewMode) => void
}

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-800/60 p-0.5">
      <button
        type="button"
        onClick={() => onChange('bento')}
        title="Card view"
        className={`rounded-md p-1.5 transition-colors ${view === 'bento' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onChange('list')}
        title="List view"
        className={`rounded-md p-1.5 transition-colors ${view === 'list' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
      >
        <List className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
