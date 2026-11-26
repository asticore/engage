// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { COMMON_SIZES, hasSize, toggleSize } from '../../src/features/ads/sizes'
import { parseSizes } from '../../src/features/ads/validate'

describe('ad size ticks', () => {
  it('adds, removes and keeps custom sizes', () => {
    expect(toggleSize('', '300x250')).toBe('300x250')
    expect(toggleSize('300x250, 123x45', '728x90')).toBe('300x250, 123x45, 728x90')
    expect(toggleSize('300x250, 123x45', '300x250')).toBe('123x45')
    expect(hasSize('320x50 300x250', '300x250')).toBe(true)
  })
  it('every common size passes the unit validator', () => {
    for (const c of COMMON_SIZES) expect(parseSizes(c.size).error).toBeNull()
  })
})
