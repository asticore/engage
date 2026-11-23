import { describe, expect, it } from 'vitest'
import { asBlockStyle, deviceOverrideDecls, blockStyleToCss } from '@/lib/blockStyle'

describe('blend mode per device', () => {
  it('desktop value stays inline', () => {
    expect(blockStyleToCss(asBlockStyle({ blendMode: 'multiply' })).mixBlendMode).toBe('multiply')
  })
  it('tablet and mobile override in the media query, normal included', () => {
    const s = asBlockStyle({ blendMode: 'multiply', tablet: { blendMode: 'screen' }, mobile: { blendMode: 'normal' } })
    expect(deviceOverrideDecls(s, 'tablet')).toContain('mix-blend-mode:screen !important')
    expect(deviceOverrideDecls(s, 'mobile')).toContain('mix-blend-mode:normal !important')
  })
  it('drops an unknown mode on a device', () => {
    const s = asBlockStyle({ tablet: { blendMode: 'bogus' as never } })
    expect(s.tablet?.blendMode).toBeUndefined()
  })
})
