import { describe, expect, it } from 'vitest'

import { asBlockStyle, blockStyleCss, blockStyleToCss, dividerPath, DIVIDER_OPTIONS, type BlockStyle } from '@/lib/blockStyle'

describe('border sides, custom shadow and dividers (31e)', () => {
  it('per-side border widths write a four value width and fall back to the main width', () => {
    const css = blockStyleToCss({ borderWidth: 1, borderTopWidth: 4, borderBottomWidth: 0, borderStyle: 'double', borderColor: '#111111' })
    expect(css.borderWidth).toBe('4px 1px 0px 1px')
    expect(css.borderStyle).toBe('double')
  })
  it('a custom shadow replaces the preset, and inset is kept', () => {
    const css = blockStyleToCss({ boxShadow: 'sm', bsX: 2, bsY: 3, bsBlur: 4, bsSpread: 1, bsColor: '#000000', bsInset: true })
    expect(css.boxShadow).toBe('inset 2px 3px 4px 1px #000000')
  })
  it('the hover shadow becomes a scoped hover rule with a transition', () => {
    const out = blockStyleCss({ hbsY: 10, hbsBlur: 20, hbsColor: '#222222' } as BlockStyle, 'x1')
    expect(out).toContain('box-shadow:0px 10px 20px 0px #222222 !important')
    expect(out).toContain(':hover')
  })
  it('bad values are dropped on read', () => {
    const clean = asBlockStyle({ bsColor: 'url(x)', bsInset: 'yes', borderStyle: 'groove', borderTopWidth: 500 } as unknown as BlockStyle)
    expect(clean.bsColor).toBeUndefined()
    expect(clean.bsInset).toBeUndefined()
    expect(clean.borderStyle).toBeUndefined()
    expect(clean.borderTopWidth).toBe(50)
  })
  it('there are at least 18 divider shapes and each has a path', () => {
    const shapes = DIVIDER_OPTIONS.filter((o) => o.value !== 'none')
    expect(shapes.length).toBeGreaterThanOrEqual(18)
    for (const o of shapes) expect(dividerPath(o.value)).toMatch(/^M/)
  })
})
