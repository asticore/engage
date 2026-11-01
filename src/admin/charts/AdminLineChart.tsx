import React from 'react'

import './admin-chart.css'

/**
 * The line chart for admin screens, next to AdminBarChart and built on the same classes. It draws
 * a fixed value axis with labelled grid lines (`ticks`), one point per datum with a native tooltip,
 * and a short x label on every nth point. Plain SVG, server- or client-rendered. The SVG keeps its
 * aspect ratio, so the axis text scales with the chart rather than stretching.
 */

export type AdminLinePoint = {
  /** Stable key for React and for the point. */
  key: string
  /** The value, on the same scale as `axisMin`..`axisMax`. A null value leaves a gap in the line. */
  value: number | null
  /** Short x label, shown on every nth point so the labels stay readable. */
  label: string
  /** Native tooltip text for the point. */
  tip: string
  /** Class for the point's marker, replacing the default; the caller then styles the marker itself. */
  className?: string
}

export type AdminLineChartProps = {
  points: AdminLinePoint[]
  ariaLabel: string
  axisMin: number
  axisMax: number
  /** Grid lines and value-axis labels, each within the axis range. */
  ticks: number[]
  formatTick: (value: number) => string
  emptyText: string
  /** Drawing size in SVG units. The chart scales to its container width; text keeps its size in units. */
  width?: number
  height?: number
}

export function AdminLineChart({ points, ariaLabel, axisMin, axisMax, ticks, formatTick, emptyText, width = 640, height = 200 }: AdminLineChartProps) {
  if (points.length === 0) return <p className="admin-chart__empty">{emptyText}</p>

  const top = 12
  const bottom = 26
  const left = 34
  const right = 8
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const span = axisMax - axisMin || 1
  const x = (i: number) => (points.length === 1 ? left + plotWidth / 2 : left + (i * plotWidth) / (points.length - 1))
  const y = (value: number) => top + plotHeight - ((Math.min(Math.max(value, axisMin), axisMax) - axisMin) / span) * plotHeight
  const labelEvery = Math.max(1, Math.ceil(points.length / 8))

  // One path per run of non-null values, so a null day breaks the line instead of joining across it.
  const segments: string[] = []
  let current = ''
  points.forEach((p, i) => {
    if (p.value === null) {
      if (current) segments.push(current)
      current = ''
      return
    }
    current += `${current ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)} `
  })
  if (current) segments.push(current)

  return (
    <div className="admin-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} preserveAspectRatio="xMidYMid meet" className="admin-chart__svg" style={{ height: 'auto', aspectRatio: `${width} / ${height}` }}>
        {ticks.map((tick) => (
          <g key={`tick-${tick}`}>
            <line className="admin-chart__grid" x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} />
            <text className="admin-chart__axis" x={left - 6} y={y(tick) + 3} textAnchor="end">
              {formatTick(tick)}
            </text>
          </g>
        ))}
        {segments.map((d, i) => (
          <path key={`seg-${i}`} className="admin-chart__line" d={d.trim()} fill="none" />
        ))}
        {points.map((p, i) =>
          p.value === null ? null : (
            <circle key={p.key} className={p.className ?? 'admin-chart__dot'} cx={x(i)} cy={y(p.value)} r={3.5}>
              <title>{p.tip}</title>
            </circle>
          ),
        )}
        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text key={`label-${p.key}`} className="admin-chart__axis" x={x(i)} y={height - 6} textAnchor="middle">
              {p.label}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  )
}
