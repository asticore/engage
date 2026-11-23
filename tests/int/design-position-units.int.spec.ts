import { describe, expect, it } from 'vitest'
import { asBlockStyle, blockStyleToCss, deviceOverrideDecls } from '@/lib/blockStyle'

describe('position offset units', () => {
  it('px by default, unit applied on desktop', () => {
    expect(blockStyleToCss(asBlockStyle({ position: 'absolute', posTop: 10 })).top).toBe('10px')
    expect(blockStyleToCss(asBlockStyle({ position: 'absolute', posTop: 10, posUnit: 'vh', posLeft: 5 }))).toMatchObject({ top: '10vh', left: '5vh' })
  })
  it('device unit re-emits inherited offsets', () => {
    const s = asBlockStyle({ position: 'absolute', posTop: 10, mobile: { posUnit: '%' } })
    expect(deviceOverrideDecls(s, 'mobile')).toContain('top:10% !important')
  })
  it('drops an unknown unit', () => {
    expect(asBlockStyle({ posUnit: 'pt' as never }).posUnit).toBeUndefined()
  })
})
