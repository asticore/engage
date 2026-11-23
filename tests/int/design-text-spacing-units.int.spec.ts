import { describe, expect, it } from 'vitest'
import { asBlockStyle, deviceOverrideDecls, typographyCss } from '@/lib/blockStyle'

describe('line height and word spacing units', () => {
  it('unitless line height and px word spacing by default', () => {
    const css = typographyCss(asBlockStyle({ lineHeight: 1.6, wordSpacing: 4 }))
    expect(css.lineHeight).toBe(1.6)
    expect(css.wordSpacing).toBe('4px')
  })
  it('applies units on desktop', () => {
    const css = typographyCss(asBlockStyle({ lineHeight: 24, lineHeightUnit: 'px', wordSpacing: 0.2, wordSpacingUnit: 'em' }))
    expect(css.lineHeight).toBe('24px')
    expect(css.wordSpacing).toBe('0.2em')
  })
  it('drops an unknown unit', () => {
    const s = asBlockStyle({ lineHeight: 2, lineHeightUnit: 'bogus' as never })
    expect(s.lineHeightUnit).toBeUndefined()
  })
  it('keeps the unit per device in the media query', () => {
    const s = asBlockStyle({ lineHeight: 1.5, mobile: { lineHeight: 30, lineHeightUnit: 'px', wordSpacing: 1, wordSpacingUnit: 'rem' } })
    expect(s.mobile?.lineHeightUnit).toBe('px')
    const css = deviceOverrideDecls(s, 'mobile')
    expect(css).toContain('line-height:30px !important')
    expect(css).toContain('word-spacing:1rem !important')
  })
})
