'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  MousePointer2,
  PenLine,
  Square,
  ArrowUpRight,
  Pin,
  Undo2,
  Trash2,
  Save,
  X,
} from 'lucide-react'
import type { AnnotationData, AnnotationComment } from '@/services/annotation'

type Tool = 'select' | 'pen' | 'rect' | 'arrow' | 'pin'
type Color = '#ef4444' | '#facc15' | '#22c55e'

interface PinPopover {
  x: number
  y: number
  canvasX: number
  canvasY: number
}

interface Props {
  imageUrl: string
  existingAnnotations?: AnnotationData | null
  readOnly?: boolean
  onSave?: (data: AnnotationData) => void
  onCancel?: () => void
}

const COLOR_OPTIONS: { value: Color; label: string; tw: string }[] = [
  { value: '#ef4444', label: 'Red', tw: 'bg-red-500' },
  { value: '#facc15', label: 'Yellow', tw: 'bg-yellow-400' },
  { value: '#22c55e', label: 'Green', tw: 'bg-green-500' },
]

const TOOL_OPTIONS: { tool: Tool; icon: React.ElementType; label: string }[] = [
  { tool: 'select', icon: MousePointer2, label: 'Select' },
  { tool: 'pen', icon: PenLine, label: 'Draw' },
  { tool: 'rect', icon: Square, label: 'Rectangle' },
  { tool: 'arrow', icon: ArrowUpRight, label: 'Arrow' },
  { tool: 'pin', icon: Pin, label: 'Comment Pin' },
]

export default function AnnotationCanvas({
  imageUrl,
  existingAnnotations,
  readOnly = false,
  onSave,
  onCancel,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fabricRef = useRef<import('fabric').Canvas | null>(null)

  const [activeTool, setActiveTool] = useState<Tool>('select')
  const [activeColor, setActiveColor] = useState<Color>('#ef4444')
  const [comments, setComments] = useState<AnnotationComment[]>(
    existingAnnotations?.comments ?? []
  )
  const [pinPopover, setPinPopover] = useState<PinPopover | null>(null)
  const [pinText, setPinText] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [fabricLoaded, setFabricLoaded] = useState(false)

  // Load Fabric.js dynamically
  useEffect(() => {
    let mounted = true
    async function loadFabric() {
      const fabricModule = await import('fabric')
      if (!mounted || !canvasRef.current) return

      const canvas = new fabricModule.Canvas(canvasRef.current, {
        selection: activeTool === 'select',
        isDrawingMode: activeTool === 'pen',
        width: canvasRef.current.parentElement?.clientWidth ?? 800,
        height: canvasRef.current.parentElement?.clientHeight ?? 600,
      })

      if (canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = activeColor
        canvas.freeDrawingBrush.width = 3
      }

      fabricRef.current = canvas

      // Load existing annotations
      if (existingAnnotations?.objects && existingAnnotations.objects.length > 0) {
        try {
          await canvas.loadFromJSON({ objects: existingAnnotations.objects, version: '5.3.0' })
          canvas.renderAll()
        } catch {
          // Non-fatal: existing annotations could not be loaded
        }
      }

      setFabricLoaded(true)
    }

    loadFabric()
    return () => {
      mounted = false
      fabricRef.current?.dispose()
      fabricRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update drawing mode when tool changes
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    canvas.isDrawingMode = activeTool === 'pen'
    canvas.selection = activeTool === 'select'

    if (activeTool === 'pen' && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = activeColor
      canvas.freeDrawingBrush.width = 3
    }
  }, [activeTool, activeColor])

  // Handle canvas clicks for rect, arrow, pin tools
  const handleCanvasClick = useCallback(
    async (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (readOnly || activeTool === 'select' || activeTool === 'pen') return
      if (!canvasRef.current || !fabricRef.current) return

      const rect = canvasRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const fabricModule = await import('fabric')
      const canvas = fabricRef.current

      if (activeTool === 'rect') {
        const rectangle = new fabricModule.Rect({
          left: x - 40,
          top: y - 25,
          width: 80,
          height: 50,
          fill: 'transparent',
          stroke: activeColor,
          strokeWidth: 2,
          rx: 2,
          ry: 2,
        })
        canvas.add(rectangle)
        canvas.renderAll()
      }

      if (activeTool === 'arrow') {
        const startX = x
        const startY = y
        const endX = x + 60
        const endY = y - 30

        const line = new fabricModule.Line([startX, startY, endX, endY], {
          stroke: activeColor,
          strokeWidth: 2,
        })

        const angle = Math.atan2(endY - startY, endX - startX)
        const headLen = 12
        const arrowHead = new fabricModule.Triangle({
          left: endX,
          top: endY,
          originX: 'center',
          originY: 'center',
          angle: (angle * 180) / Math.PI + 90,
          width: headLen,
          height: headLen,
          fill: activeColor,
        })

        const group = new fabricModule.Group([line, arrowHead])
        canvas.add(group)
        canvas.renderAll()
      }

      if (activeTool === 'pin') {
        setPinPopover({
          x: e.clientX,
          y: e.clientY,
          canvasX: x,
          canvasY: y,
        })
        setPinText('')
      }
    },
    [activeTool, activeColor, readOnly]
  )

  async function handleAddPin() {
    if (!pinPopover || !pinText.trim() || !fabricRef.current) return

    const fabricModule = await import('fabric')
    const canvas = fabricRef.current

    const pinNumber = comments.length + 1

    const circle = new fabricModule.Circle({
      left: pinPopover.canvasX - 12,
      top: pinPopover.canvasY - 12,
      radius: 12,
      fill: activeColor,
      selectable: true,
    })

    const text = new fabricModule.Text(String(pinNumber), {
      left: pinPopover.canvasX - 5,
      top: pinPopover.canvasY - 8,
      fontSize: 12,
      fill: '#ffffff',
      fontWeight: 'bold',
      selectable: false,
    })

    const group = new fabricModule.Group([circle, text])
    canvas.add(group)
    canvas.renderAll()

    const newComment: AnnotationComment = {
      id: `pin-${Date.now()}`,
      x: pinPopover.canvasX,
      y: pinPopover.canvasY,
      width: 24,
      height: 24,
      text: pinText.trim(),
      authorId: 'current-user',
      authorName: 'You',
      createdAt: new Date().toISOString(),
      resolved: false,
    }

    setComments((prev) => [...prev, newComment])
    setPinPopover(null)
    setPinText('')
  }

  async function handleUndo() {
    const canvas = fabricRef.current
    if (!canvas) return
    const objects = canvas.getObjects()
    if (objects.length > 0) {
      canvas.remove(objects[objects.length - 1])
      canvas.renderAll()
    }
  }

  async function handleClear() {
    const canvas = fabricRef.current
    if (!canvas) return
    canvas.clear()
    canvas.renderAll()
    setComments([])
  }

  async function handleSave() {
    const canvas = fabricRef.current
    if (!canvas || !onSave) return

    setIsSaving(true)
    try {
      const json = canvas.toJSON()
      const annotationData: AnnotationData = {
        objects: (json.objects ?? []) as object[],
        comments,
      }
      onSave(annotationData)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f]">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 bg-[#0d0d14] flex-shrink-0 flex-wrap">
          {/* Tools */}
          <div className="flex items-center gap-1">
            {TOOL_OPTIONS.map(({ tool, icon: Icon, label }) => (
              <button
                key={tool}
                onClick={() => setActiveTool(tool)}
                title={label}
                className={`flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium transition-all ${
                  activeTool === tool
                    ? 'bg-[#6366f1]/20 text-[#818cf8] border border-[#6366f1]/40'
                    : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 border border-transparent'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-zinc-700 mx-1" />

          {/* Colors */}
          <div className="flex items-center gap-1.5">
            {COLOR_OPTIONS.map(({ value, tw }) => (
              <button
                key={value}
                onClick={() => setActiveColor(value)}
                className={`h-5 w-5 rounded-full ${tw} transition-transform ${
                  activeColor === value ? 'scale-125 ring-2 ring-white/40 ring-offset-1 ring-offset-[#0d0d14]' : 'opacity-60 hover:opacity-100'
                }`}
              />
            ))}
          </div>

          <div className="w-px h-5 bg-zinc-700 mx-1" />

          {/* Actions */}
          <button
            onClick={handleUndo}
            className="flex items-center gap-1 rounded px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-all"
            title="Undo last"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-1 rounded px-2 py-1.5 text-xs text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
            title="Clear all"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>

          <div className="flex-1" />

          {onCancel && (
            <button
              onClick={onCancel}
              className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all border border-zinc-700"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          )}
          {onSave && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium bg-[#6366f1] text-white hover:bg-[#5558e3] transition-all disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? 'Saving...' : 'Save Annotations'}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area */}
        <div ref={containerRef} className="relative flex-1 overflow-auto bg-zinc-900">
          <div
            className="relative inline-block"
            style={{ minWidth: '100%', minHeight: '100%' }}
          >
            {/* Background image */}
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Artwork to annotate"
                className="max-w-full h-auto block"
                draggable={false}
              />
            )}

            {/* Fabric canvas overlay */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0"
              style={{ cursor: activeTool === 'pen' ? 'crosshair' : activeTool === 'pin' ? 'cell' : 'default' }}
              onClick={handleCanvasClick}
            />

            {/* Comment pin numbers overlay (read-only view) */}
            {readOnly &&
              comments.map((comment, idx) => (
                <div
                  key={comment.id}
                  className="absolute group"
                  style={{ left: comment.x - 12, top: comment.y - 12 }}
                >
                  <div
                    className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-white cursor-pointer"
                    style={{ backgroundColor: '#ef4444' }}
                  >
                    {idx + 1}
                  </div>
                  {/* Tooltip */}
                  <div className="absolute left-8 top-0 z-10 hidden group-hover:block min-w-max max-w-xs rounded-lg bg-zinc-900 border border-zinc-700 p-2 shadow-xl text-xs text-zinc-200">
                    <p className="font-medium text-zinc-400 mb-1">{comment.authorName}</p>
                    <p>{comment.text}</p>
                  </div>
                </div>
              ))}

            {!fabricLoaded && !readOnly && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
              </div>
            )}
          </div>
        </div>

        {/* Comments sidebar */}
        {comments.length > 0 && (
          <div className="w-72 flex-shrink-0 border-l border-zinc-800 bg-[#0d0d14] overflow-y-auto">
            <div className="px-4 py-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-200">
                Comments ({comments.length})
              </h3>
            </div>
            <div className="divide-y divide-zinc-800/60">
              {comments.map((comment, idx) => (
                <div key={comment.id} className="p-3 space-y-1">
                  <div className="flex items-start gap-2">
                    <div
                      className="h-5 w-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white mt-0.5"
                      style={{ backgroundColor: '#ef4444' }}
                    >
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-zinc-400">{comment.authorName}</p>
                      <p className="text-xs text-zinc-200 mt-0.5">{comment.text}</p>
                      <p className="text-[10px] text-zinc-600 mt-1">
                        {new Date(comment.createdAt).toLocaleString('en-MY', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    {!readOnly && (
                      <button
                        onClick={() =>
                          setComments((prev) => prev.filter((c) => c.id !== comment.id))
                        }
                        className="text-zinc-700 hover:text-red-400 transition-colors flex-shrink-0"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pin comment popover */}
      {pinPopover && (
        <div
          className="fixed z-50 rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl p-4 w-72"
          style={{ left: Math.min(pinPopover.x, window.innerWidth - 300), top: pinPopover.y + 10 }}
        >
          <h4 className="text-sm font-semibold text-zinc-200 mb-2">Add Comment</h4>
          <textarea
            autoFocus
            value={pinText}
            onChange={(e) => setPinText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.metaKey) handleAddPin()
              if (e.key === 'Escape') setPinPopover(null)
            }}
            placeholder="Describe the issue or feedback..."
            className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 placeholder-zinc-600 p-2 resize-none focus:outline-none focus:border-[#6366f1] transition-colors"
            rows={3}
          />
          <p className="text-[10px] text-zinc-600 mt-1 mb-3">Cmd+Enter to submit, Esc to cancel</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPinPopover(null)}
              className="flex-1 rounded-md px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-zinc-700 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleAddPin}
              disabled={!pinText.trim()}
              className="flex-1 rounded-md px-3 py-1.5 text-xs font-medium bg-[#6366f1] text-white hover:bg-[#5558e3] disabled:opacity-40 transition-all"
            >
              Add Pin
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
