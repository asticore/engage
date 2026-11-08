import type { BlockStyle } from '@/lib/blockStyle'

export type PaddingSide = 'top' | 'bottom'
export type PaddingDevice = 'desktop' | 'tablet' | 'mobile'

export const MAX_DRAG_PADDING = 400

/** Dragging only edits pixel padding: any other unit (rem, %, ...) stays a Design panel job. */
export function canDragPadding(design: { paddingUnit?: unknown } | undefined | null): boolean {
  const unit = design?.paddingUnit
  return unit === undefined || unit === null || unit === '' || unit === 'px'
}

/** Rounds and clamps a dragged value to whole pixels in [0, MAX_DRAG_PADDING]. */
export function clampPadding(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(MAX_DRAG_PADDING, Math.max(0, Math.round(value)))
}

/**
 * Writes one padding side for a device: desktop is the base style (paddingTop / paddingBottom),
 * tablet and mobile write into design.tablet / design.mobile (mobile also drops the older
 * paddingTopMobile / paddingBottomMobile key so the new value is the one in force).
 */
export function applyPaddingDrag(design: unknown, side: PaddingSide, rawValue: number, device: PaddingDevice): BlockStyle {
  const base: Record<string, unknown> = design && typeof design === 'object' && !Array.isArray(design) ? { ...(design as Record<string, unknown>) } : {}
  const key = side === 'top' ? 'paddingTop' : 'paddingBottom'
  const value = clampPadding(rawValue)
  if (device === 'desktop') {
    base[key] = value
    return base as BlockStyle
  }
  const prev = base[device]
  base[device] = { ...(prev && typeof prev === 'object' ? (prev as Record<string, unknown>) : {}), [key]: value }
  if (device === 'mobile') delete base[side === 'top' ? 'paddingTopMobile' : 'paddingBottomMobile']
  return base as BlockStyle
}
