import { describe, expect, it } from 'vitest'

import { isPaddingMessage } from '@/views/visualEditor/canvasBridge'
import { applyPaddingDrag, canDragPadding, clampPadding } from '@/views/visualEditor/paddingDrag'

describe('padding drag helpers', () => {
  it('only allows px or unset padding units', () => {
    expect(canDragPadding(undefined)).toBe(true)
    expect(canDragPadding({})).toBe(true)
    expect(canDragPadding({ paddingUnit: 'px' })).toBe(true)
    expect(canDragPadding({ paddingUnit: 'rem' })).toBe(false)
    expect(canDragPadding({ paddingUnit: '%' })).toBe(false)
  })

  it('rounds and clamps', () => {
    expect(clampPadding(12.6)).toBe(13)
    expect(clampPadding(-5)).toBe(0)
    expect(clampPadding(9999)).toBe(400)
    expect(clampPadding(Number.NaN)).toBe(0)
  })

  it('writes desktop to the base style', () => {
    expect(applyPaddingDrag({ bgColor: 'red' }, 'top', 40, 'desktop')).toEqual({ bgColor: 'red', paddingTop: 40 })
    expect(applyPaddingDrag(undefined, 'bottom', 8, 'desktop')).toEqual({ paddingBottom: 8 })
  })

  it('writes tablet and mobile to the device override, keeping other keys', () => {
    const out = applyPaddingDrag({ paddingTop: 10, tablet: { paddingBottom: 5 } }, 'top', 20, 'tablet')
    expect(out).toEqual({ paddingTop: 10, tablet: { paddingBottom: 5, paddingTop: 20 } })
    const mobile = applyPaddingDrag({ paddingBottomMobile: 7 }, 'bottom', 30, 'mobile') as Record<string, unknown>
    expect(mobile.mobile).toEqual({ paddingBottom: 30 })
    expect(mobile.paddingBottomMobile).toBeUndefined()
  })

  it('does not mutate its input', () => {
    const input = { tablet: { paddingTop: 1 } }
    applyPaddingDrag(input, 'top', 9, 'tablet')
    expect(input).toEqual({ tablet: { paddingTop: 1 } })
  })
})

describe('isPaddingMessage', () => {
  const base = { source: 've-canvas', type: 'padding', path: [0], side: 'top', value: 12, device: 'desktop' }
  it('accepts a well-formed message', () => {
    expect(isPaddingMessage(base)).toBe(true)
  })
  it('rejects bad shapes', () => {
    expect(isPaddingMessage({ ...base, source: 'x' })).toBe(false)
    expect(isPaddingMessage({ ...base, path: [0, 1] })).toBe(false)
    expect(isPaddingMessage({ ...base, side: 'left' })).toBe(false)
    expect(isPaddingMessage({ ...base, value: -1 })).toBe(false)
    expect(isPaddingMessage({ ...base, value: Number.NaN })).toBe(false)
    expect(isPaddingMessage({ ...base, device: 'tv' })).toBe(false)
    expect(isPaddingMessage(null)).toBe(false)
  })
})
