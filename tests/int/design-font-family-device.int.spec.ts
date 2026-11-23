import { describe, expect, it } from 'vitest'
import { asBlockStyle, blockFontStack, deviceOverrideDecls } from '@/lib/blockStyle'
import { BUILT_IN_FONTS } from '@/features/fonts/installed'

describe('font family per device', () => {
  const key = BUILT_IN_FONTS[0].value
  it('device family overrides in the media query', () => {
    const s = asBlockStyle({ mobile: { fontFamily: key } })
    expect(s.mobile?.fontFamily).toBe(key)
    expect(deviceOverrideDecls(s, 'mobile')).toContain(`font-family:${blockFontStack(key)} !important`)
  })
  it('installed families work and unknown ones are dropped', () => {
    expect(asBlockStyle({ tablet: { fontFamily: 'family:Lora' } }).tablet?.fontFamily).toBe('family:Lora')
    expect(asBlockStyle({ tablet: { fontFamily: 'evil;}x{' } }).tablet?.fontFamily).toBeUndefined()
  })
})
