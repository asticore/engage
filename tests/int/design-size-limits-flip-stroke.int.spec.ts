import { describe, expect, it } from 'vitest'

import { blockStyleCss, blockStyleToCss, deviceOverrideDecls, asBlockStyle, type BlockStyle } from '@/lib/blockStyle'

describe('size limits, flip, justify, text stroke and shadow (31e)', () => {
  it('writes min and max limits with their units on desktop, and nothing for a 0 max', () => {
    const css = blockStyleToCss({ minWidth: 20, minWidthUnit: 'rem', maxWidth: 80, maxWidthUnit: '%', maxHeight: 0 })
    expect(css.minWidth).toBe('20rem')
    expect(css.maxWidth).toBe('80%')
    expect(css.maxHeight).toBeUndefined()
  })
  it('a device override emits the merged limit, and 0 clears an inherited max', () => {
    const style: BlockStyle = { maxWidth: 900, tablet: { maxWidth: 600, maxWidthUnit: 'vw' }, mobile: { maxWidth: 0 } }
    expect(deviceOverrideDecls(style, 'tablet')).toContain('max-width:600vw !important')
    expect(deviceOverrideDecls(style, 'mobile')).toContain('max-width:none !important')
    expect(blockStyleCss(style, 'x')).toContain('max-width:none !important')
  })
  it('flip adds scaleX and scaleY, per device, and 0 switches an inherited flip off', () => {
    expect(blockStyleToCss({ tfFlipX: 1, tfFlipY: 1 }).transform).toBe('scaleX(-1) scaleY(-1)')
    const style: BlockStyle = { tfFlipX: 1, mobile: { tfFlipX: 0 } }
    expect(deviceOverrideDecls(style, 'mobile').find((d) => d.startsWith('transform'))).toBe('transform:none !important')
  })
  it('justify is a valid alignment, on desktop and per device', () => {
    expect(blockStyleToCss({ textAlign: 'justify' }).textAlign).toBe('justify')
    const clean = asBlockStyle({ tablet: { textAlign: 'justify' } } as BlockStyle)
    expect(clean.tablet?.textAlign).toBe('justify')
  })
  it('text stroke and a custom shadow become inline CSS; bad colours are dropped', () => {
    const css = blockStyleToCss({ textStrokeWidth: 2, textStrokeColor: '#ff0000', textShadowX: 1, textShadowY: 2, textShadowBlur: 3, textShadowColor: '#000000' })
    expect(css.WebkitTextStroke).toBe('2px #ff0000')
    expect(css.textShadow).toBe('1px 2px 3px #000000')
    const clean = asBlockStyle({ textStrokeColor: 'url(x)', textStrokeWidth: 99, maxWidth: -5 } as BlockStyle)
    expect(clean.textStrokeColor).toBeUndefined()
    expect(clean.textStrokeWidth).toBe(20)
    expect(clean.maxWidth).toBe(0)
  })
  it('keeps every one of the six units in the emitted limits', () => {
    for (const u of ['px', '%', 'em', 'rem', 'vw', 'vh'] as const) expect(blockStyleToCss({ maxWidth: 5, maxWidthUnit: u }).maxWidth).toBe(`5${u}`)
  })
})
