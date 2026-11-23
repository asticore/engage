import { describe, expect, it } from 'vitest'
import { asBlockStyle, blockStyleToCss, deviceOverrideDecls } from '@/lib/blockStyle'

describe('background colour per device', () => {
  it('desktop colour stays inline', () => {
    expect(blockStyleToCss(asBlockStyle({ bgType: 'color', bgColor: '#112233' })).backgroundColor).toBe('#112233')
  })
  it('device colour overrides in the media query', () => {
    const s = asBlockStyle({ bgType: 'color', bgColor: '#112233', mobile: { bgColor: '#ffffff' } })
    expect(deviceOverrideDecls(s, 'mobile')).toContain('background-color:#ffffff !important')
  })
  it('drops an unsafe device colour', () => {
    const s = asBlockStyle({ tablet: { bgColor: 'red;} body{display:none' } })
    expect(s.tablet?.bgColor).toBeUndefined()
  })
})
