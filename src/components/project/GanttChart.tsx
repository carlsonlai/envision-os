'use client'

import { useMemo } from 'react'

export interface GanttDeliverable {
  id: string
  description: string
  itemType: string
  status: string
  startDate: Date
  deadline: Date
  assignedDesigner?: string | null
}

interface GanttChartProps {
  deliverables: GanttDeliverable[]
  projectStart: Date
  projectDeadline: Date
}

const STATUS_COLOURS: Record<string, string> = {
  PENDING: '#6B7280',
  IN_PROGRESS: '#3B82F6',
  WIP_UPLOADED: '#8B5CF6',
  QC_REVIEW: '#F59E0B',
  APPROVED: '#10B981',
  DELIVERED: '#10B981',
  FA_SIGNED: '#059669',
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  BANNER: 'Banner',
  BROCHURE: 'Brochure',
  LOGO: 'Logo',
  SOCIAL: 'Social',
  PRINT: 'Print',
  THREE_D: '3D',
  VIDEO: 'Video',
  OTHER: 'Other',
}

const ROW_HEIGHT = 40
const LABEL_WIDTH = 200
const CHART_PADDING = 16
const BAR_HEIGHT = 22
const BAR_OFFSET = (ROW_HEIGHT - BAR_HEIGHT) / 2

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })
}

function getDaysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

export default function GanttChart({ deliverables, projectStart, projectDeadline }: GanttChartProps) {
  const totalDays = useMemo(() => Math.max(getDaysBetween(projectStart, projectDeadline), 1), [projectStart, projectDeadline])

  const chartWidth = Math.max(totalDays * 24, 400)
  const svgWidth = chartWidth + LABEL_WIDTH + CHART_PADDING * 2
  const svgHeight = deliverables.length * ROW_HEIGHT + 48

  // Generate day tick marks
  const ticks = useMemo(() => {
    const result: { day: number; label: string }[] = []
    for (let d = 0; d <= totalDays; d += Math.max(1, Math.floor(totalDays / 10))) {
      const date = new Date(projectStart)
      date.setDate(date.getDate() + d)
      result.push({ day: d, label: formatDate(date) })
    }
    return result
  }, [projectStart, totalDays])

  function dayToX(date: Date): number {
    const days = getDaysBetween(projectStart, date)
    return LABEL_WIDTH + CHART_PADDING + (days / totalDays) * chartWidth
  }

  if (deliverables.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
        No deliverables to display.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <svg
        width={svgWidth}
        height={svgHeight}
        aria-label="Project Gantt chart"
        role="img"
        className="block"
      >
        {/* Background stripes */}
        {deliverables.map((_, i) => (
          <rect
            key={`stripe-${i}`}
            x={0}
            y={i * ROW_HEIGHT + 40}
            width={svgWidth}
            height={ROW_HEIGHT}
            fill={i % 2 === 0 ? '#F9FAFB' : '#FFFFFF'}
          />
        ))}

        {/* Header background */}
        <rect x={0} y={0} width={svgWidth} height={40} fill="#111827" />

        {/* Tick marks and header labels */}
        {ticks.map(({ day, label }) => {
          const x = LABEL_WIDTH + CHART_PADDING + (day / totalDays) * chartWidth
          return (
            <g key={`tick-${day}`}>
              <line x1={x} y1={40} x2={x} y2={svgHeight} stroke="#E5E7EB" strokeWidth={1} />
              <text
                x={x + 4}
                y={26}
                fontSize={10}
                fill="#9CA3AF"
                fontFamily="ui-monospace, monospace"
              >
                {label}
              </text>
            </g>
          )
        })}

        {/* Header: label column */}
        <text x={12} y={26} fontSize={11} fontWeight="600" fill="#F3F4F6" fontFamily="system-ui">
          Deliverable
        </text>
        <line x1={LABEL_WIDTH} y1={0} x2={LABEL_WIDTH} y2={svgHeight} stroke="#374151" strokeWidth={1} />

        {/* Today line */}
        {(() => {
          const todayX = dayToX(new Date())
          if (todayX >= LABEL_WIDTH && todayX <= svgWidth) {
            return (
              <g>
                <line x1={todayX} y1={40} x2={todayX} y2={svgHeight} stroke="#EF4444" strokeWidth={2} strokeDasharray="4 3" />
                <text x={todayX + 4} y={54} fontSize={9} fill="#EF4444" fontFamily="system-ui">Today</text>
              </g>
            )
          }
          return null
        })()}

        {/* Deliverable rows */}
        {deliverables.map((item, i) => {
          const rowY = i * ROW_HEIGHT + 40
          const barColour = STATUS_COLOURS[item.status] ?? '#6B7280'
          const startX = dayToX(item.startDate)
          const endX = dayToX(item.deadline)
          const barW = Math.max(endX - startX, 8)

          return (
            <g key={item.id}>
              {/* Row label */}
              <text
                x={8}
                y={rowY + BAR_OFFSET + BAR_HEIGHT / 2 + 4}
                fontSize={11}
                fill="#374151"
                fontFamily="system-ui"
              >
                {`${ITEM_TYPE_LABELS[item.itemType] ?? item.itemType}: ${item.description.slice(0, 22)}${item.description.length > 22 ? '…' : ''}`}
              </text>

              {/* Gantt bar */}
              <rect
                x={startX}
                y={rowY + BAR_OFFSET}
                width={barW}
                height={BAR_HEIGHT}
                rx={4}
                fill={barColour}
                opacity={0.85}
              />

              {/* Status label inside bar (if wide enough) */}
              {barW > 60 && (
                <text
                  x={startX + 6}
                  y={rowY + BAR_OFFSET + BAR_HEIGHT / 2 + 4}
                  fontSize={9}
                  fill="#FFFFFF"
                  fontFamily="system-ui"
                  fontWeight="600"
                >
                  {item.status.replace('_', ' ')}
                </text>
              )}

              {/* Deadline date */}
              <text
                x={Math.min(endX + 4, svgWidth - 4)}
                y={rowY + BAR_OFFSET + BAR_HEIGHT / 2 + 4}
                fontSize={9}
                fill="#6B7280"
                fontFamily="ui-monospace, monospace"
              >
                {formatDate(item.deadline)}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-600">
        {Object.entries(STATUS_COLOURS).map(([status, colour]) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: colour }} />
            {status.replace('_', ' ')}
          </span>
        ))}
      </div>
    </div>
  )
}
