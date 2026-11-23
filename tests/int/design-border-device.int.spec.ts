import { describe, expect, it } from 'vitest'
import { asBlockStyle, blockStyleToCss, deviceOverrideDecls } from '@/lib/blockStyle'

describe('border width per device', () => {
  it('desktop inline stays', () => {
    expect(blockStyleToCss(asBlockStyle({ borderWidth: 2, borderColor: '#123456' })).borderWidth).toBe('2px')
  })
  it('device width re-emits style and colour', () => {
    const s = asBlockStyle({ borderWidth: 2, borderStyle: 'dashed', borderColor: '#123456', mobile: { borderWidth: 6 } })
    const d = deviceOverrideDecls(s, 'mobile')
    expect(d).toContain('border-width:6px !important')
    expect(d).toContain('border-style:dashed !important')
    expect(d).toContain('border-color:#123456 !important')
  })
  it('zero removes the border on that device', () => {
    const d = deviceOverrideDecls(asBlockStyle({ borderWidth: 2, tablet: { borderWidth: 0 } }), 'tablet')
    expect(d).toContain('border-width:0px !important')
    expect(d).not.toContain('border-style')
  })
  it('clamps an oversized device width', () => {
    expect(asBlockStyle({ tablet: { borderWidth: 999 } }).tablet?.borderWidth).toBe(50)
  })
})
